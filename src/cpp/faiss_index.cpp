// Include FAISS headers FIRST, before our header
// This ensures all FAISS types are properly defined
#if __has_include(<faiss/gpu/StandardGpuResources.h>) && __has_include(<faiss/gpu/GpuCloner.h>)
#define FAISS_NODE_HAVE_GPU 1
#endif

#include <faiss/impl/FaissAssert.h>
#include <faiss/MetricType.h>
#include <faiss/Index.h>
#include <faiss/IndexFlat.h>
#include <faiss/IndexHNSW.h>
#include <faiss/IndexIVF.h>
#include <faiss/IndexIVFPQ.h>
#include <faiss/IndexPQ.h>
#include <faiss/IndexPreTransform.h>
#include <faiss/IndexScalarQuantizer.h>
#include <faiss/VectorTransform.h>
#include <faiss/impl/IDSelector.h>
#include <faiss/invlists/DirectMap.h>
#include <faiss/index_factory.h>
#include <faiss/index_io.h>
#include <faiss/impl/io.h>
#include <faiss/impl/AuxIndexStructures.h>
#ifdef FAISS_NODE_HAVE_GPU
#include <faiss/gpu/GpuCloner.h>
#include <faiss/gpu/StandardGpuResources.h>
#endif
#include <fstream>
#include <sstream>
#include <cstdio>
#include <cstring>

// Now include our header
#include "faiss_index.h"
#include <stdexcept>

namespace {

std::string MetricToString(faiss::MetricType metric) {
    return metric == faiss::METRIC_INNER_PRODUCT ? "ip" : "l2";
}

std::string InferTransformLabel(const faiss::IndexPreTransform* pretransform) {
    if (pretransform == nullptr) {
        return "";
    }

    for (const auto* transform : pretransform->chain) {
        if (dynamic_cast<const faiss::OPQMatrix*>(transform) != nullptr) {
            return "OPQ";
        }

        const auto* pca = dynamic_cast<const faiss::PCAMatrix*>(transform);
        if (pca != nullptr) {
            return pca->random_rotation ? "PCAR" : "PCA";
        }
    }

    return "PRETRANSFORM";
}

std::string InferIndexType(const faiss::Index* index) {
    if (index == nullptr) {
        return "UNKNOWN";
    }

    const auto* pretransform = dynamic_cast<const faiss::IndexPreTransform*>(index);
    if (pretransform != nullptr) {
        const std::string transformLabel = InferTransformLabel(pretransform);
        const std::string innerLabel = InferIndexType(pretransform->index);

        if (transformLabel.empty()) {
            return innerLabel;
        }

        if (innerLabel.empty() || innerLabel == "UNKNOWN" || innerLabel == "CUSTOM") {
            return transformLabel;
        }

        return transformLabel + "_" + innerLabel;
    }

    if (dynamic_cast<const faiss::IndexIVFPQ*>(index) != nullptr) {
        return "IVF_PQ";
    }

    if (dynamic_cast<const faiss::IndexIVFScalarQuantizer*>(index) != nullptr) {
        return "IVF_SQ";
    }

    if (dynamic_cast<const faiss::IndexPQ*>(index) != nullptr) {
        return "PQ";
    }

    if (dynamic_cast<const faiss::IndexScalarQuantizer*>(index) != nullptr) {
        return "SQ";
    }

    if (dynamic_cast<const faiss::IndexHNSW*>(index) != nullptr) {
        return "HNSW";
    }

    if (dynamic_cast<const faiss::IndexIVF*>(index) != nullptr) {
        return "IVF_FLAT";
    }

    if (dynamic_cast<const faiss::IndexFlat*>(index) != nullptr) {
        return index->metric_type == faiss::METRIC_INNER_PRODUCT ? "FLAT_IP" : "FLAT_L2";
    }

    return "CUSTOM";
}

void EnableSequentialDirectMap(faiss::Index* index) {
    if (index == nullptr) {
        return;
    }

    auto* pretransform = dynamic_cast<faiss::IndexPreTransform*>(index);
    if (pretransform != nullptr) {
        EnableSequentialDirectMap(pretransform->index);
        return;
    }

    auto* ivf = dynamic_cast<faiss::IndexIVF*>(index);
    if (ivf != nullptr) {
        ivf->set_direct_map_type(faiss::DirectMap::Array);
    }
}

faiss::IndexIVF* FindIvfIndex(faiss::Index* index) {
    if (index == nullptr) {
        return nullptr;
    }

    auto* pretransform = dynamic_cast<faiss::IndexPreTransform*>(index);
    if (pretransform != nullptr) {
        return FindIvfIndex(pretransform->index);
    }

    return dynamic_cast<faiss::IndexIVF*>(index);
}

}  // namespace

FaissIndexWrapper::FaissIndexWrapper(
        int dims,
        const std::string& indexDescription,
        int metric,
        const std::string& typeLabel,
        const std::string& factoryDescription)
    : dims_(dims),
      disposed_(false),
      type_label_(typeLabel),
      factory_description_(factoryDescription.empty() ? indexDescription : factoryDescription) {
    if (dims <= 0) {
        throw std::invalid_argument("Dimensions must be positive");
    }
    
    // Create index using index_factory
    // Examples: "Flat" -> IndexFlatL2, "IVF100,Flat" -> IndexIVFFlat, "HNSW32" -> IndexHNSW
    faiss::MetricType metricType = static_cast<faiss::MetricType>(metric);
    index_ = std::unique_ptr<faiss::Index>(faiss::index_factory(dims, indexDescription.c_str(), metricType));
    EnableSequentialDirectMap(index_.get());

    if (type_label_.empty()) {
        type_label_ = InferIndexType(index_.get());
    }
}

FaissIndexWrapper::FaissIndexWrapper(int dims) 
    : FaissIndexWrapper(dims, "Flat", 1) {  // Default to IndexFlatL2 with L2 metric
}

FaissIndexWrapper::~FaissIndexWrapper() {
    if (!disposed_) {
        Dispose();
    }
}

void FaissIndexWrapper::Add(const float* vectors, size_t n) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    if (vectors == nullptr) {
        throw std::invalid_argument("Vectors pointer cannot be null");
    }
    
    if (n == 0) {
        return; // Nothing to add
    }
    
    // FAISS expects vectors as a flat array: [v1[0..d-1], v2[0..d-1], ...]
    // This matches how Float32Array is laid out in memory
    index_->add(n, vectors);
}

void FaissIndexWrapper::Search(const float* query, int k, float* distances, int64_t* labels) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    if (query == nullptr) {
        throw std::invalid_argument("Query pointer cannot be null");
    }
    
    if (distances == nullptr || labels == nullptr) {
        throw std::invalid_argument("Output arrays cannot be null");
    }
    
    if (k <= 0) {
        throw std::invalid_argument("k must be positive");
    }
    
    size_t ntotal = index_->ntotal;
    if (ntotal == 0) {
        throw std::runtime_error("Cannot search empty index");
    }
    
    // Clamp k to available vectors
    int actual_k = (k > static_cast<int>(ntotal)) ? static_cast<int>(ntotal) : k;
    
    // FAISS search: nq=1 (single query), k neighbors
    // Cast labels to faiss::idx_t* for FAISS API
    index_->search(1, query, actual_k, distances, reinterpret_cast<faiss::idx_t*>(labels));
}

void FaissIndexWrapper::SearchBatch(const float* queries, size_t nq, int k, float* distances, int64_t* labels) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    if (queries == nullptr) {
        throw std::invalid_argument("Queries pointer cannot be null");
    }
    
    if (distances == nullptr || labels == nullptr) {
        throw std::invalid_argument("Output arrays cannot be null");
    }
    
    if (nq == 0) {
        throw std::invalid_argument("Number of queries must be positive");
    }
    
    if (k <= 0) {
        throw std::invalid_argument("k must be positive");
    }
    
    size_t ntotal = index_->ntotal;
    if (ntotal == 0) {
        throw std::runtime_error("Cannot search empty index");
    }
    
    // Clamp k to available vectors
    int actual_k = (k > static_cast<int>(ntotal)) ? static_cast<int>(ntotal) : k;
    
    // FAISS batch search: nq queries, k neighbors per query
    // Results are stored as: [q1_results, q2_results, ..., qn_results]
    // Each query's results: [k distances, k labels]
    // Cast labels to faiss::idx_t* for FAISS API
    index_->search(nq, queries, actual_k, distances, reinterpret_cast<faiss::idx_t*>(labels));
}

void FaissIndexWrapper::Reconstruct(int64_t id, float* output) const {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    if (output == nullptr) {
        throw std::invalid_argument("Output buffer cannot be null");
    }

    if (id < 0 || id >= static_cast<int64_t>(index_->ntotal)) {
        throw std::out_of_range("Vector id is out of range");
    }

    index_->reconstruct(id, output);
}

void FaissIndexWrapper::ReconstructBatch(const int64_t* ids, size_t n, float* output) const {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    if (ids == nullptr) {
        throw std::invalid_argument("Ids pointer cannot be null");
    }

    if (output == nullptr) {
        throw std::invalid_argument("Output buffer cannot be null");
    }

    for (size_t i = 0; i < n; i++) {
        if (ids[i] < 0 || ids[i] >= static_cast<int64_t>(index_->ntotal)) {
            throw std::out_of_range("Vector id is out of range");
        }
        index_->reconstruct(ids[i], output + (i * dims_));
    }
}

size_t FaissIndexWrapper::GetTotalVectors() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return 0;
    }
    return index_->ntotal;
}

int FaissIndexWrapper::GetDimensions() const {
    return dims_;
}

void FaissIndexWrapper::Train(const float* vectors, size_t n) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    if (vectors == nullptr) {
        throw std::invalid_argument("Vectors pointer cannot be null");
    }
    
    if (n == 0) {
        throw std::invalid_argument("Number of training vectors must be positive");
    }
    
    index_->train(n, vectors);
}

void FaissIndexWrapper::SetNprobe(int nprobe) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    // Try to cast to IndexIVF to set nprobe
    // This is safe even if not an IVF index (will just do nothing)
    faiss::IndexIVF* ivf_index = FindIvfIndex(index_.get());
    if (ivf_index) {
        ivf_index->nprobe = nprobe;
    }
}

bool FaissIndexWrapper::IsTrained() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return false;
    }
    return index_->is_trained;
}

std::string FaissIndexWrapper::GetIndexType() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return "UNKNOWN";
    }
    return type_label_.empty() ? InferIndexType(index_.get()) : type_label_;
}

std::string FaissIndexWrapper::GetFactoryDescription() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return "";
    }
    return factory_description_;
}

std::string FaissIndexWrapper::GetMetricName() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return "l2";
    }
    return MetricToString(index_->metric_type);
}

void FaissIndexWrapper::Dispose() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return;
    }
    
    disposed_ = true;
    index_.reset();
#ifdef FAISS_NODE_HAVE_GPU
    gpu_resident_ = false;
    gpu_device_ = -1;
    gpu_resources_.reset();
#endif
}

void FaissIndexWrapper::Save(const std::string& filename) const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    if (filename.empty()) {
        throw std::invalid_argument("Filename cannot be empty");
    }
    
    try {
#ifdef FAISS_NODE_HAVE_GPU
        std::unique_ptr<faiss::Index> cpuClone;
        const faiss::Index* savableIndex = index_.get();
        if (gpu_resident_) {
            cpuClone.reset(faiss::gpu::index_gpu_to_cpu(index_.get()));
            EnableSequentialDirectMap(cpuClone.get());
            savableIndex = cpuClone.get();
        }
        faiss::write_index(savableIndex, filename.c_str());
#else
        faiss::write_index(index_.get(), filename.c_str());
#endif
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to save index: ") + e.what());
    }
}

std::unique_ptr<FaissIndexWrapper> FaissIndexWrapper::Load(const std::string& filename) {
    if (filename.empty()) {
        throw std::invalid_argument("Filename cannot be empty");
    }
    
    try {
        faiss::Index* loaded_index = faiss::read_index(filename.c_str());
        EnableSequentialDirectMap(loaded_index);
        
        // Create wrapper with loaded index (supports any index type)
        auto wrapper = std::make_unique<FaissIndexWrapper>(loaded_index->d);
        wrapper->index_.reset(loaded_index);
        wrapper->dims_ = loaded_index->d;
        wrapper->type_label_ = InferIndexType(loaded_index);
        wrapper->factory_description_.clear();
        
        return wrapper;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to load index: ") + e.what());
    }
}

std::vector<uint8_t> FaissIndexWrapper::ToBuffer() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    try {
        // Use FAISS VectorIOWriter for direct memory serialization (no temp files)
        // This is the same approach used by ewfian/faiss-node
        faiss::VectorIOWriter writer;
#ifdef FAISS_NODE_HAVE_GPU
        std::unique_ptr<faiss::Index> cpuClone;
        const faiss::Index* serializableIndex = index_.get();
        if (gpu_resident_) {
            cpuClone.reset(faiss::gpu::index_gpu_to_cpu(index_.get()));
            EnableSequentialDirectMap(cpuClone.get());
            serializableIndex = cpuClone.get();
        }
        faiss::write_index(serializableIndex, &writer);
#else
        faiss::write_index(index_.get(), &writer);
#endif
        
        // Return the buffer directly
        return writer.data;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to serialize index: ") + e.what());
    }
}

std::unique_ptr<FaissIndexWrapper> FaissIndexWrapper::FromBuffer(const uint8_t* data, size_t length) {
    if (data == nullptr || length == 0) {
        throw std::invalid_argument("Invalid buffer data");
    }
    
    try {
        // Use FAISS VectorIOReader for direct memory deserialization (no temp files)
        // This is the same approach used by ewfian/faiss-node
        faiss::VectorIOReader reader;
        reader.data.assign(data, data + length);
        
        faiss::Index* loaded_index = faiss::read_index(&reader);
        EnableSequentialDirectMap(loaded_index);
        
        // Create wrapper with loaded index (supports any index type)
        auto wrapper = std::make_unique<FaissIndexWrapper>(loaded_index->d);
        wrapper->index_.reset(loaded_index);
        wrapper->dims_ = loaded_index->d;
        wrapper->type_label_ = InferIndexType(loaded_index);
        wrapper->factory_description_.clear();
        
        return wrapper;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to deserialize index: ") + e.what());
    }
}

void FaissIndexWrapper::MergeFrom(const FaissIndexWrapper& other) {
    if (this == &other) {
        throw std::invalid_argument("Cannot merge an index into itself");
    }

    std::scoped_lock lock(mutex_, other.mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    if (other.disposed_) {
        throw std::runtime_error("Cannot merge from disposed index");
    }
    
    if (other.dims_ != dims_) {
        throw std::invalid_argument("Merging index must have the same dimensions");
    }
    
    try {
        // FAISS merge_from transfers vectors from the source index into the target.
        index_->merge_from(*(other.index_));
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to merge index: ") + e.what());
    }
}

void FaissIndexWrapper::SetHnswParams(int efConstruction, int efSearch) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    faiss::IndexHNSW* hnsw_index = dynamic_cast<faiss::IndexHNSW*>(index_.get());
    if (hnsw_index == nullptr) {
        return;
    }

    if (efConstruction > 0) {
        hnsw_index->hnsw.efConstruction = efConstruction;
    }

    if (efSearch > 0) {
        hnsw_index->hnsw.efSearch = efSearch;
    }
}

void FaissIndexWrapper::ToGpu(int device) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    if (device < 0) {
        throw std::invalid_argument("GPU device must be non-negative");
    }

#ifdef FAISS_NODE_HAVE_GPU
    try {
        std::unique_ptr<faiss::Index> cpuClone;
        const faiss::Index* sourceIndex = index_.get();
        if (gpu_resident_) {
            cpuClone.reset(faiss::gpu::index_gpu_to_cpu(index_.get()));
            EnableSequentialDirectMap(cpuClone.get());
            sourceIndex = cpuClone.get();
        }

        auto resources = std::make_shared<faiss::gpu::StandardGpuResources>();
        std::unique_ptr<faiss::Index> gpuIndex(
            faiss::gpu::index_cpu_to_gpu(resources.get(), device, sourceIndex));

        index_ = std::move(gpuIndex);
        gpu_resources_ = std::move(resources);
        gpu_resident_ = true;
        gpu_device_ = device;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to move index to GPU: ") + e.what());
    }
#else
    (void)device;
    throw std::runtime_error("GPU support not available in this build");
#endif
}

void FaissIndexWrapper::ToCpu() {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

#ifdef FAISS_NODE_HAVE_GPU
    if (!gpu_resident_) {
        return;
    }

    try {
        std::unique_ptr<faiss::Index> cpuIndex(faiss::gpu::index_gpu_to_cpu(index_.get()));
        EnableSequentialDirectMap(cpuIndex.get());
        index_ = std::move(cpuIndex);
        gpu_resources_.reset();
        gpu_resident_ = false;
        gpu_device_ = -1;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to move index to CPU: ") + e.what());
    }
#endif
}

bool FaissIndexWrapper::IsGpuResident() const {
#ifdef FAISS_NODE_HAVE_GPU
    std::lock_guard<std::mutex> lock(mutex_);
    return !disposed_ && gpu_resident_;
#else
    return false;
#endif
}

bool FaissIndexWrapper::HasGpuSupport() {
#ifdef FAISS_NODE_HAVE_GPU
    return true;
#else
    return false;
#endif
}

void FaissIndexWrapper::Reset() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    try {
        // FAISS reset() clears all vectors but keeps the index structure
        index_->reset();
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to reset index: ") + e.what());
    }
}

size_t FaissIndexWrapper::RemoveIds(const int64_t* ids, size_t n) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    if (ids == nullptr) {
        throw std::invalid_argument("Ids pointer cannot be null");
    }

    if (n == 0) {
        return 0;
    }

    std::vector<faiss::idx_t> faissIds(n);
    for (size_t i = 0; i < n; i++) {
        if (ids[i] < 0) {
            throw std::invalid_argument("Ids must be non-negative");
        }
        faissIds[i] = static_cast<faiss::idx_t>(ids[i]);
    }

    faiss::IDSelectorBatch selector(n, faissIds.data());
    try {
        return index_->remove_ids(selector);
    } catch (const std::exception& e) {
        faiss::IndexIVF* ivf = FindIvfIndex(index_.get());
        const std::string message = e.what();
        if (ivf != nullptr && message.find("direct_map format") != std::string::npos) {
            const auto previous_type = ivf->direct_map.type;
            ivf->set_direct_map_type(faiss::DirectMap::NoMap);
            try {
                size_t removed = index_->remove_ids(selector);
                ivf->set_direct_map_type(faiss::DirectMap::Hashtable);
                return removed;
            } catch (...) {
                ivf->set_direct_map_type(previous_type);
                throw;
            }
        }
        throw;
    }
}

size_t FaissIndexWrapper::RangeSearch(const float* query, float radius,
                                      std::vector<float>& distances,
                                      std::vector<int64_t>& labels,
                                      std::vector<size_t>& lims) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }
    
    if (query == nullptr) {
        throw std::invalid_argument("Query pointer cannot be null");
    }
    
    if (radius < 0) {
        throw std::invalid_argument("Radius must be non-negative");
    }
    
    size_t ntotal = index_->ntotal;
    if (ntotal == 0) {
        throw std::runtime_error("Cannot search empty index");
    }
    
    try {
        // FAISS range_search returns RangeSearchResult
        faiss::RangeSearchResult result(1);  // nq=1 (single query)
        
        // Perform range search (nq=1, single query)
        index_->range_search(1, query, radius, &result);
        
        // Extract results
        size_t total = result.lims[1];  // Total results for query 0
        distances.resize(total);
        labels.resize(total);
        lims.resize(2);  // [0, total]
        
        // Copy distances and labels
        for (size_t i = 0; i < total; i++) {
            distances[i] = result.distances[i];
            labels[i] = result.labels[i];
        }
        
        lims[0] = 0;
        lims[1] = total;
        
        return total;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to range search: ") + e.what());
    }
}
