#ifndef FAISS_NODE_INDEX_H
#define FAISS_NODE_INDEX_H

#include <memory>
#include <cstdint>
#include <string>
#include <vector>
#include <mutex>

// Forward declarations - full definitions in .cpp file
namespace faiss {
    class Index;
    using idx_t = int64_t;  // idx_t is int64_t (defined in MetricType.h)
}

/**
 * Wrapper class for FAISS index that manages memory and provides
 * a clean interface for N-API bindings.
 */
class FaissIndexWrapper {
public:
    // Constructor: creates index using index_factory string
    // Examples: "Flat" for IndexFlatL2, "IVF100,Flat" for IndexIVFFlat, "HNSW32" for IndexHNSW
    FaissIndexWrapper(int dims, const std::string& indexDescription, int metric = 1);
    
    // Constructor: creates IndexFlatL2 (for backward compatibility)
    explicit FaissIndexWrapper(int dims);
    
    // Destructor: automatic cleanup via RAII
    ~FaissIndexWrapper();
    
    // Prevent copying (we own the FAISS index)
    FaissIndexWrapper(const FaissIndexWrapper&) = delete;
    FaissIndexWrapper& operator=(const FaissIndexWrapper&) = delete;
    
    // Add vectors to the index
    // vectors: pointer to float array (n * dims elements)
    // n: number of vectors
    void Add(const float* vectors, size_t n);
    
    // Search for k nearest neighbors (single query)
    // query: pointer to query vector (dims elements)
    // k: number of neighbors to return
    // distances: output array (k elements) - caller must allocate
    // labels: output array (k elements) - caller must allocate
    void Search(const float* query, int k, float* distances, int64_t* labels) const;
    
    // Batch search for k nearest neighbors (multiple queries)
    // queries: pointer to query vectors (nq * dims elements)
    // nq: number of queries
    // k: number of neighbors to return per query
    // distances: output array (nq * k elements) - caller must allocate
    // labels: output array (nq * k elements) - caller must allocate
    void SearchBatch(const float* queries, size_t nq, int k, float* distances, int64_t* labels) const;
    
    // Train the index (required for IVF indexes)
    void Train(const float* vectors, size_t n);
    
    // Get index statistics
    size_t GetTotalVectors() const;
    int GetDimensions() const;
    bool IsTrained() const;
    
    // Set nprobe for IVF indexes
    void SetNprobe(int nprobe);
    
    // Dispose: explicitly free resources
    void Dispose();
    
    // Check if disposed (thread-safe)
    bool IsDisposed() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return disposed_;
    }
    
    // Save index to file
    void Save(const std::string& filename) const;
    
    // Load index from file (static factory method)
    static std::unique_ptr<FaissIndexWrapper> Load(const std::string& filename);
    
    // Serialize index to buffer
    std::vector<uint8_t> ToBuffer() const;
    
    // Deserialize index from buffer (static factory method)
    static std::unique_ptr<FaissIndexWrapper> FromBuffer(const uint8_t* data, size_t length);
    
    // Merge vectors from another index
    // other: reference to another FaissIndexWrapper
    void MergeFrom(const FaissIndexWrapper& other);

private:
    std::unique_ptr<faiss::Index> index_;  // Base Index pointer (can hold any index type)
    int dims_;
    bool disposed_;
    mutable std::mutex mutex_;  // Protect concurrent access
};

#endif // FAISS_NODE_INDEX_H
