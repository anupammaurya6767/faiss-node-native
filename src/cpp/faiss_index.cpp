// Include FAISS headers FIRST, before our header
// This ensures all FAISS types are properly defined
#include <faiss/impl/FaissAssert.h>
#include <faiss/MetricType.h>
#include <faiss/Index.h>
#include <faiss/IndexFlat.h>
#include <faiss/IndexIVF.h>
#include <faiss/index_factory.h>
#include <faiss/index_io.h>
#include <faiss/impl/io.h>
#include <faiss/utils/distances.h>
#include <fstream>
#include <sstream>
#include <cstdio>
#include <cstring>

// Now include our header
#include "faiss_index.h"
#include <stdexcept>

FaissIndexWrapper::FaissIndexWrapper(int dims, const std::string& indexDescription, int metric) 
    : dims_(dims), disposed_(false) {
    if (dims <= 0) {
        throw std::invalid_argument("Dimensions must be positive");
    }
    
    // Create index using index_factory
    // Examples: "Flat" -> IndexFlatL2, "IVF100,Flat" -> IndexIVFFlat, "HNSW32" -> IndexHNSW
    faiss::MetricType metricType = static_cast<faiss::MetricType>(metric);
    index_ = std::unique_ptr<faiss::Index>(faiss::index_factory(dims, indexDescription.c_str(), metricType));
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
    faiss::IndexIVF* ivf_index = dynamic_cast<faiss::IndexIVF*>(index_.get());
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

void FaissIndexWrapper::Dispose() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (disposed_) {
        return;
    }
    
    disposed_ = true;
    index_.reset();
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
        faiss::write_index(index_.get(), filename.c_str());
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
        
        // Create wrapper with loaded index (supports any index type)
        auto wrapper = std::make_unique<FaissIndexWrapper>(loaded_index->d);
        wrapper->index_.reset(loaded_index);
        wrapper->dims_ = loaded_index->d;
        
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
        faiss::write_index(index_.get(), &writer);
        
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
        
        // Create wrapper with loaded index (supports any index type)
        auto wrapper = std::make_unique<FaissIndexWrapper>(loaded_index->d);
        wrapper->index_.reset(loaded_index);
        wrapper->dims_ = loaded_index->d;
        
        return wrapper;
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to deserialize index: ") + e.what());
    }
}

void FaissIndexWrapper::MergeFrom(const FaissIndexWrapper& other) {
    // Lock both mutexes to prevent deadlock (always lock in same order)
    // We'll use a simple approach: lock this first, then other
    // Note: This could deadlock if two threads merge in opposite directions
    // In practice, this is unlikely, but we should document it
    std::lock_guard<std::mutex> lock1(mutex_);
    std::lock_guard<std::mutex> lock2(other.mutex_);
    
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
        // FAISS merge_from copies all vectors from other index
        index_->merge_from(*(other.index_));
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to merge index: ") + e.what());
    }
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
