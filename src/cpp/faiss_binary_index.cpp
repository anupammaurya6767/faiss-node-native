#if __has_include(<faiss/gpu/StandardGpuResources.h>) && __has_include(<faiss/gpu/GpuCloner.h>)
#define FAISS_NODE_HAVE_GPU 1
#endif

#include <faiss/IndexBinary.h>
#include <faiss/IndexBinaryFlat.h>
#include <faiss/IndexBinaryHash.h>
#include <faiss/IndexBinaryHNSW.h>
#include <faiss/IndexBinaryIVF.h>
#include <faiss/impl/AuxIndexStructures.h>
#include <faiss/impl/IDSelector.h>
#include <faiss/impl/io.h>
#include <faiss/index_factory.h>
#include <faiss/index_io.h>
#include <faiss/invlists/DirectMap.h>
#ifdef FAISS_NODE_HAVE_GPU
#include <faiss/gpu/GpuCloner.h>
#include <faiss/gpu/StandardGpuResources.h>
#endif

#include <cstring>
#include <stdexcept>

#include "faiss_binary_index.h"

namespace {

std::string InferBinaryIndexType(const faiss::IndexBinary* index) {
    if (index == nullptr) {
        return "UNKNOWN";
    }

    if (dynamic_cast<const faiss::IndexBinaryHNSW*>(index) != nullptr) {
        return "BINARY_HNSW";
    }

    if (dynamic_cast<const faiss::IndexBinaryIVF*>(index) != nullptr) {
        return "BINARY_IVF";
    }

    if (dynamic_cast<const faiss::IndexBinaryMultiHash*>(index) != nullptr) {
        return "BINARY_MULTI_HASH";
    }

    if (dynamic_cast<const faiss::IndexBinaryHash*>(index) != nullptr) {
        return "BINARY_HASH";
    }

    if (dynamic_cast<const faiss::IndexBinaryFlat*>(index) != nullptr) {
        return "BINARY_FLAT";
    }

    return "CUSTOM";
}

void EnableSequentialDirectMap(faiss::IndexBinary* index) {
    if (index == nullptr) {
        return;
    }

    auto* ivf = dynamic_cast<faiss::IndexBinaryIVF*>(index);
    if (ivf != nullptr) {
        ivf->set_direct_map_type(faiss::DirectMap::Array);
    }
}

faiss::IndexBinaryIVF* FindBinaryIvfIndex(faiss::IndexBinary* index) {
    if (index == nullptr) {
        return nullptr;
    }

    return dynamic_cast<faiss::IndexBinaryIVF*>(index);
}

#ifdef FAISS_NODE_HAVE_GPU
bool SupportsBinaryGpu(const faiss::IndexBinary* index) {
    return dynamic_cast<const faiss::IndexBinaryFlat*>(index) != nullptr;
}
#endif

size_t GetEffectiveBinaryCodeSize(const faiss::IndexBinary* index, int dims) {
    if (index != nullptr && index->code_size > 0) {
        return static_cast<size_t>(index->code_size);
    }

    return static_cast<size_t>(dims / 8);
}

}  // namespace

FaissBinaryIndexWrapper::FaissBinaryIndexWrapper(
        int dims,
        const std::string& indexDescription,
        const std::string& typeLabel,
        const std::string& factoryDescription)
    : dims_(dims),
      disposed_(false),
      type_label_(typeLabel),
      factory_description_(factoryDescription.empty() ? indexDescription : factoryDescription) {
    if (dims <= 0) {
        throw std::invalid_argument("Dimensions must be positive");
    }

    if (dims % 8 != 0) {
        throw std::invalid_argument("Binary index dimensions must be divisible by 8");
    }

    index_ = std::unique_ptr<faiss::IndexBinary>(
        faiss::index_binary_factory(dims, indexDescription.c_str()));
    EnableSequentialDirectMap(index_.get());

    if (type_label_.empty()) {
        type_label_ = InferBinaryIndexType(index_.get());
    }
}

FaissBinaryIndexWrapper::FaissBinaryIndexWrapper(int dims)
    : FaissBinaryIndexWrapper(dims, "BFlat", "BINARY_FLAT") {}

FaissBinaryIndexWrapper::~FaissBinaryIndexWrapper() {
    if (!disposed_) {
        Dispose();
    }
}

void FaissBinaryIndexWrapper::Add(const uint8_t* vectors, size_t n) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    if (vectors == nullptr) {
        throw std::invalid_argument("Vectors pointer cannot be null");
    }

    if (n == 0) {
        return;
    }

    index_->add(n, vectors);
}

void FaissBinaryIndexWrapper::Search(
        const uint8_t* query,
        int k,
        int32_t* distances,
        int64_t* labels) const {
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

    int actual_k = (k > static_cast<int>(ntotal)) ? static_cast<int>(ntotal) : k;
    index_->search(1, query, actual_k, distances, reinterpret_cast<faiss::idx_t*>(labels));
}

void FaissBinaryIndexWrapper::SearchBatch(
        const uint8_t* queries,
        size_t nq,
        int k,
        int32_t* distances,
        int64_t* labels) const {
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

    int actual_k = (k > static_cast<int>(ntotal)) ? static_cast<int>(ntotal) : k;
    index_->search(nq, queries, actual_k, distances, reinterpret_cast<faiss::idx_t*>(labels));
}

void FaissBinaryIndexWrapper::Reconstruct(int64_t id, uint8_t* output) const {
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

void FaissBinaryIndexWrapper::ReconstructBatch(
        const int64_t* ids,
        size_t n,
        uint8_t* output) const {
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

    const size_t codeSize = GetEffectiveBinaryCodeSize(index_.get(), dims_);
    for (size_t i = 0; i < n; i++) {
        if (ids[i] < 0 || ids[i] >= static_cast<int64_t>(index_->ntotal)) {
            throw std::out_of_range("Vector id is out of range");
        }
        index_->reconstruct(ids[i], output + (i * codeSize));
    }
}

void FaissBinaryIndexWrapper::Train(const uint8_t* vectors, size_t n) {
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

size_t FaissBinaryIndexWrapper::GetTotalVectors() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return 0;
    }
    return index_->ntotal;
}

int FaissBinaryIndexWrapper::GetDimensions() const {
    return dims_;
}

int FaissBinaryIndexWrapper::GetCodeSize() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_ || index_ == nullptr) {
        return dims_ / 8;
    }
    return static_cast<int>(GetEffectiveBinaryCodeSize(index_.get(), dims_));
}

bool FaissBinaryIndexWrapper::IsTrained() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return false;
    }
    return index_->is_trained;
}

std::string FaissBinaryIndexWrapper::GetIndexType() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return "UNKNOWN";
    }
    return type_label_.empty() ? InferBinaryIndexType(index_.get()) : type_label_;
}

std::string FaissBinaryIndexWrapper::GetFactoryDescription() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return "";
    }
    return factory_description_;
}

std::string FaissBinaryIndexWrapper::GetMetricName() const {
    return "hamming";
}

void FaissBinaryIndexWrapper::SetNprobe(int nprobe) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    auto* ivf = dynamic_cast<faiss::IndexBinaryIVF*>(index_.get());
    if (ivf != nullptr) {
        ivf->nprobe = static_cast<size_t>(nprobe);
    }
}

void FaissBinaryIndexWrapper::SetHnswParams(int efConstruction, int efSearch) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    auto* hnsw = dynamic_cast<faiss::IndexBinaryHNSW*>(index_.get());
    if (hnsw == nullptr) {
        return;
    }

    if (efConstruction > 0) {
        hnsw->hnsw.efConstruction = efConstruction;
    }

    if (efSearch > 0) {
        hnsw->hnsw.efSearch = efSearch;
    }
}

void FaissBinaryIndexWrapper::ToGpu(int device) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    if (device < 0) {
        throw std::invalid_argument("GPU device must be non-negative");
    }

#ifdef FAISS_NODE_HAVE_GPU
    try {
        std::unique_ptr<faiss::IndexBinary> cpuClone;
        const faiss::IndexBinary* sourceIndex = index_.get();
        if (gpu_resident_) {
            cpuClone.reset(faiss::gpu::index_binary_gpu_to_cpu(index_.get()));
            EnableSequentialDirectMap(cpuClone.get());
            sourceIndex = cpuClone.get();
        }

        if (!SupportsBinaryGpu(sourceIndex)) {
            throw std::runtime_error(
                "Unsupported binary GPU index type. Only BINARY_FLAT indexes are currently supported on GPU. "
                "Keep BINARY_HNSW, BINARY_IVF, and BINARY_HASH indexes on CPU.");
        }

        auto resources = std::make_shared<faiss::gpu::StandardGpuResources>();
        std::unique_ptr<faiss::IndexBinary> gpuIndex(
            faiss::gpu::index_binary_cpu_to_gpu(resources.get(), device, sourceIndex));

        index_ = std::move(gpuIndex);
        gpu_resources_ = std::move(resources);
        gpu_resident_ = true;
        gpu_device_ = device;
    } catch (const std::exception& e) {
        throw std::runtime_error(
            std::string("Failed to move binary index to GPU: ") + e.what());
    }
#else
    (void)device;
    throw std::runtime_error("GPU support not available in this build");
#endif
}

void FaissBinaryIndexWrapper::ToCpu() {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

#ifdef FAISS_NODE_HAVE_GPU
    if (!gpu_resident_) {
        return;
    }

    try {
        std::unique_ptr<faiss::IndexBinary> cpuIndex(
            faiss::gpu::index_binary_gpu_to_cpu(index_.get()));
        EnableSequentialDirectMap(cpuIndex.get());
        index_ = std::move(cpuIndex);
        gpu_resources_.reset();
        gpu_resident_ = false;
        gpu_device_ = -1;
    } catch (const std::exception& e) {
        throw std::runtime_error(
            std::string("Failed to move binary index to CPU: ") + e.what());
    }
#endif
}

bool FaissBinaryIndexWrapper::IsGpuResident() const {
#ifdef FAISS_NODE_HAVE_GPU
    std::lock_guard<std::mutex> lock(mutex_);
    return !disposed_ && gpu_resident_;
#else
    return false;
#endif
}

bool FaissBinaryIndexWrapper::HasGpuSupport() {
#ifdef FAISS_NODE_HAVE_GPU
    return true;
#else
    return false;
#endif
}

void FaissBinaryIndexWrapper::Dispose() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return;
    }

    disposed_ = true;
#ifdef FAISS_NODE_HAVE_GPU
    gpu_resources_.reset();
    gpu_resident_ = false;
    gpu_device_ = -1;
#endif
    index_.reset();
}

void FaissBinaryIndexWrapper::Save(const std::string& filename) const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    if (filename.empty()) {
        throw std::invalid_argument("Filename cannot be empty");
    }

    try {
#ifdef FAISS_NODE_HAVE_GPU
        std::unique_ptr<faiss::IndexBinary> cpuClone;
        const faiss::IndexBinary* savableIndex = index_.get();
        if (gpu_resident_) {
            cpuClone.reset(faiss::gpu::index_binary_gpu_to_cpu(index_.get()));
            EnableSequentialDirectMap(cpuClone.get());
            savableIndex = cpuClone.get();
        }
        faiss::write_index_binary(savableIndex, filename.c_str());
#else
        faiss::write_index_binary(index_.get(), filename.c_str());
#endif
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to save binary index: ") + e.what());
    }
}

std::unique_ptr<FaissBinaryIndexWrapper> FaissBinaryIndexWrapper::Load(const std::string& filename) {
    if (filename.empty()) {
        throw std::invalid_argument("Filename cannot be empty");
    }

    try {
        std::unique_ptr<faiss::IndexBinary> loaded_index(faiss::read_index_binary(filename.c_str()));
        EnableSequentialDirectMap(loaded_index.get());

        auto wrapper = std::make_unique<FaissBinaryIndexWrapper>(static_cast<int>(loaded_index->d));
        wrapper->index_ = std::move(loaded_index);
        wrapper->dims_ = static_cast<int>(wrapper->index_->d);
        wrapper->type_label_ = InferBinaryIndexType(wrapper->index_.get());
        wrapper->factory_description_.clear();

        return wrapper;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to load binary index: ") + e.what());
    }
}

std::vector<uint8_t> FaissBinaryIndexWrapper::ToBuffer() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    try {
        faiss::VectorIOWriter writer;
#ifdef FAISS_NODE_HAVE_GPU
        std::unique_ptr<faiss::IndexBinary> cpuClone;
        const faiss::IndexBinary* serializableIndex = index_.get();
        if (gpu_resident_) {
            cpuClone.reset(faiss::gpu::index_binary_gpu_to_cpu(index_.get()));
            EnableSequentialDirectMap(cpuClone.get());
            serializableIndex = cpuClone.get();
        }
        faiss::write_index_binary(serializableIndex, &writer);
#else
        faiss::write_index_binary(index_.get(), &writer);
#endif
        return writer.data;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to serialize binary index: ") + e.what());
    }
}

std::unique_ptr<FaissBinaryIndexWrapper> FaissBinaryIndexWrapper::FromBuffer(
        const uint8_t* data,
        size_t length) {
    if (data == nullptr || length == 0) {
        throw std::invalid_argument("Invalid buffer data");
    }

    try {
        faiss::VectorIOReader reader;
        reader.data.assign(data, data + length);

        std::unique_ptr<faiss::IndexBinary> loaded_index(faiss::read_index_binary(&reader));
        EnableSequentialDirectMap(loaded_index.get());

        auto wrapper = std::make_unique<FaissBinaryIndexWrapper>(static_cast<int>(loaded_index->d));
        wrapper->index_ = std::move(loaded_index);
        wrapper->dims_ = static_cast<int>(wrapper->index_->d);
        wrapper->type_label_ = InferBinaryIndexType(wrapper->index_.get());
        wrapper->factory_description_.clear();

        return wrapper;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to deserialize binary index: ") + e.what());
    }
}

void FaissBinaryIndexWrapper::MergeFrom(const FaissBinaryIndexWrapper& other) {
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
        index_->merge_from(*(other.index_));
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to merge binary index: ") + e.what());
    }
}

void FaissBinaryIndexWrapper::Reset() {
    std::lock_guard<std::mutex> lock(mutex_);

    if (disposed_) {
        throw std::runtime_error("Index has been disposed");
    }

    try {
        index_->reset();
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to reset binary index: ") + e.what());
    }
}

size_t FaissBinaryIndexWrapper::RemoveIds(const int64_t* ids, size_t n) {
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
        faiss::IndexBinaryIVF* ivf = FindBinaryIvfIndex(index_.get());
        const std::string message = e.what();
        if (ivf != nullptr && message.find("direct_map format") != std::string::npos) {
            ivf->set_direct_map_type(faiss::DirectMap::NoMap);
            size_t removed = index_->remove_ids(selector);
            ivf->set_direct_map_type(faiss::DirectMap::Hashtable);
            return removed;
        }
        throw;
    }
}
