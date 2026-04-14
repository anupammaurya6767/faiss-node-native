#ifndef FAISS_NODE_BINARY_INDEX_H
#define FAISS_NODE_BINARY_INDEX_H

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#if __has_include(<faiss/gpu/StandardGpuResources.h>) && __has_include(<faiss/gpu/GpuCloner.h>)
#define FAISS_NODE_HAVE_GPU 1
#endif

namespace faiss {
    struct IndexBinary;
    using idx_t = int64_t;
#ifdef FAISS_NODE_HAVE_GPU
    namespace gpu {
        class StandardGpuResources;
    }
#endif
}

class FaissBinaryIndexWrapper {
public:
    FaissBinaryIndexWrapper(
        int dims,
        const std::string& indexDescription,
        const std::string& typeLabel = "",
        const std::string& factoryDescription = "");

    explicit FaissBinaryIndexWrapper(int dims);

    ~FaissBinaryIndexWrapper();

    FaissBinaryIndexWrapper(const FaissBinaryIndexWrapper&) = delete;
    FaissBinaryIndexWrapper& operator=(const FaissBinaryIndexWrapper&) = delete;

    void Add(const uint8_t* vectors, size_t n);
    void Search(const uint8_t* query, int k, int32_t* distances, int64_t* labels) const;
    void SearchBatch(const uint8_t* queries, size_t nq, int k, int32_t* distances, int64_t* labels) const;
    void Reconstruct(int64_t id, uint8_t* output) const;
    void ReconstructBatch(const int64_t* ids, size_t n, uint8_t* output) const;
    void Train(const uint8_t* vectors, size_t n);

    size_t GetTotalVectors() const;
    int GetDimensions() const;
    int GetCodeSize() const;
    bool IsTrained() const;
    std::string GetIndexType() const;
    std::string GetFactoryDescription() const;
    std::string GetMetricName() const;

    void SetNprobe(int nprobe);
    void SetHnswParams(int efConstruction, int efSearch);

    void ToGpu(int device);
    void ToCpu();
    bool IsGpuResident() const;
    static bool HasGpuSupport();

    void Dispose();
    bool IsDisposed() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return disposed_;
    }

    void Save(const std::string& filename) const;
    static std::unique_ptr<FaissBinaryIndexWrapper> Load(const std::string& filename);

    std::vector<uint8_t> ToBuffer() const;
    static std::unique_ptr<FaissBinaryIndexWrapper> FromBuffer(const uint8_t* data, size_t length);

    void MergeFrom(const FaissBinaryIndexWrapper& other);
    void Reset();
    size_t RemoveIds(const int64_t* ids, size_t n);

private:
    std::unique_ptr<faiss::IndexBinary> index_;
    int dims_;
    bool disposed_;
    std::string type_label_;
    std::string factory_description_;
    mutable std::mutex mutex_;
#ifdef FAISS_NODE_HAVE_GPU
    std::shared_ptr<faiss::gpu::StandardGpuResources> gpu_resources_;
    bool gpu_resident_ = false;
    int gpu_device_ = -1;
#endif
};

#endif
