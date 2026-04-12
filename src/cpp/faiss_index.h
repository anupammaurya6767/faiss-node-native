#ifndef FAISS_NODE_INDEX_H
#define FAISS_NODE_INDEX_H

#include <memory>
#include <cstdint>
#include <string>
#include <vector>
#include <mutex>

#if __has_include(<faiss/gpu/StandardGpuResources.h>) && __has_include(<faiss/gpu/GpuCloner.h>)
#define FAISS_NODE_HAVE_GPU 1
#endif

// Forward declarations - full definitions in .cpp file
namespace faiss {
    struct Index;  // FAISS defines Index as struct, not class
    using idx_t = int64_t;  // idx_t is int64_t (defined in MetricType.h)
#ifdef FAISS_NODE_HAVE_GPU
    namespace gpu {
        class StandardGpuResources;
    }
#endif
}

/**
 * Wrapper class for FAISS index that manages memory and provides
 * a clean interface for N-API bindings.
 */
class FaissIndexWrapper {
public:
    // Constructor: creates index using index_factory string
    // Examples: "Flat" for IndexFlatL2, "IVF100,Flat" for IndexIVFFlat, "HNSW32" for IndexHNSW
    FaissIndexWrapper(
        int dims,
        const std::string& indexDescription,
        int metric = 1,
        const std::string& typeLabel = "",
        const std::string& factoryDescription = "");
    
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

    // Reconstruct a stored vector by its internal id
    void Reconstruct(int64_t id, float* output) const;

    // Reconstruct a batch of stored vectors by their internal ids
    void ReconstructBatch(const int64_t* ids, size_t n, float* output) const;
    
    // Train the index (required for IVF indexes)
    void Train(const float* vectors, size_t n);
    
    // Get index statistics
    size_t GetTotalVectors() const;
    int GetDimensions() const;
    bool IsTrained() const;
    std::string GetIndexType() const;
    std::string GetFactoryDescription() const;
    std::string GetMetricName() const;
    
    // Set nprobe for IVF indexes
    void SetNprobe(int nprobe);
    
    // Configure HNSW-specific parameters after index construction
    void SetHnswParams(int efConstruction, int efSearch);

    // Convert the wrapped index between CPU and GPU when FAISS GPU support is available.
    void ToGpu(int device);
    void ToCpu();
    bool IsGpuResident() const;
    static bool HasGpuSupport();
    
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
    
    // Reset: clear all vectors from the index (reuse index object)
    void Reset();

    // Remove specific vector ids from the index.
    // Returns the number of removed vectors.
    size_t RemoveIds(const int64_t* ids, size_t n);
    
    // Range search: find all vectors within radius
    // query: pointer to query vector (dims elements)
    // radius: maximum distance threshold
    // distances: output array (variable length, caller must allocate buffer)
    // labels: output array (variable length, caller must allocate buffer)
    // lims: output array (nq+1 elements) - limits for each query result
    // Returns: total number of results found
    size_t RangeSearch(const float* query, float radius, 
                       std::vector<float>& distances, 
                       std::vector<int64_t>& labels,
                       std::vector<size_t>& lims) const;

private:
    std::unique_ptr<faiss::Index> index_;  // Base Index pointer (can hold any index type)
    int dims_;
    bool disposed_;
    std::string type_label_;
    std::string factory_description_;
    mutable std::mutex mutex_;  // Protect concurrent access
#ifdef FAISS_NODE_HAVE_GPU
    std::shared_ptr<faiss::gpu::StandardGpuResources> gpu_resources_;
    bool gpu_resident_ = false;
    int gpu_device_ = -1;
#endif
};

#endif // FAISS_NODE_INDEX_H
