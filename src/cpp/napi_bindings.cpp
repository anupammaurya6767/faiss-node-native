#include <napi.h>
// Include FAISS headers for idx_t
#include <faiss/MetricType.h>
#include "faiss_index.h"
#include <vector>
#include <memory>
#include <cstring>
#include <string>

// Forward declaration
class FaissIndexWrapperJS;

// ============================================================================
// Async Workers for Non-Blocking Operations
// ============================================================================

// Add Worker
class AddWorker : public Napi::AsyncWorker {
public:
    AddWorker(FaissIndexWrapper* wrapper, const float* vectors, size_t n, int dims, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "AddWorker"),
          wrapper_(wrapper),
          vectors_(vectors, vectors + n * dims),
          n_(n),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }
            wrapper_->Add(vectors_.data(), n_);
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* wrapper_;
    std::vector<float> vectors_;
    size_t n_;
    Napi::Promise::Deferred deferred_;
};

// Train Worker
class TrainWorker : public Napi::AsyncWorker {
public:
    TrainWorker(FaissIndexWrapper* wrapper, const float* vectors, size_t n, int dims, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "TrainWorker"),
          wrapper_(wrapper),
          vectors_(vectors, vectors + n * dims),
          n_(n),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }
            wrapper_->Train(vectors_.data(), n_);
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* wrapper_;
    std::vector<float> vectors_;
    size_t n_;
    Napi::Promise::Deferred deferred_;
};

// Search Worker
class SearchWorker : public Napi::AsyncWorker {
public:
    SearchWorker(FaissIndexWrapper* wrapper, const float* query, int k, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "SearchWorker"),
          wrapper_(wrapper),
          query_(query, query + wrapper->GetDimensions()),
          k_(k),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }
            
            size_t ntotal = wrapper_->GetTotalVectors();
            if (ntotal == 0) {
                SetError("Cannot search empty index");
                return;
            }
            
            int actual_k = (k_ > static_cast<int>(ntotal)) ? static_cast<int>(ntotal) : k_;
            distances_.resize(actual_k);
            labels_.resize(actual_k);
            
            wrapper_->Search(query_.data(), actual_k, distances_.data(), labels_.data());
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::Object result = Napi::Object::New(env);
        
        Napi::Float32Array distances = Napi::Float32Array::New(env, distances_.size());
        memcpy(distances.Data(), distances_.data(), distances_.size() * sizeof(float));
        
        Napi::Int32Array labels = Napi::Int32Array::New(env, labels_.size());
        int32_t* labelsData = labels.Data();
        for (size_t i = 0; i < labels_.size(); i++) {
            labelsData[i] = static_cast<int32_t>(labels_[i]);
        }
        
        result.Set("distances", distances);
        result.Set("labels", labels);
        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* wrapper_;
    std::vector<float> query_;
    int k_;
    std::vector<float> distances_;
    std::vector<faiss::idx_t> labels_;
    Napi::Promise::Deferred deferred_;
};

// RangeSearch Worker
class RangeSearchWorker : public Napi::AsyncWorker {
public:
    RangeSearchWorker(FaissIndexWrapper* wrapper, const float* query, float radius, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "RangeSearchWorker"),
          wrapper_(wrapper),
          query_(query, query + wrapper->GetDimensions()),
          radius_(radius),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }
            
            size_t ntotal = wrapper_->GetTotalVectors();
            if (ntotal == 0) {
                SetError("Cannot search empty index");
                return;
            }
            
            wrapper_->RangeSearch(query_.data(), radius_, distances_, labels_, lims_);
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::Object result = Napi::Object::New(env);
        
        Napi::Float32Array distances = Napi::Float32Array::New(env, distances_.size());
        memcpy(distances.Data(), distances_.data(), distances_.size() * sizeof(float));
        
        Napi::Int32Array labels = Napi::Int32Array::New(env, labels_.size());
        int32_t* labelsData = labels.Data();
        for (size_t i = 0; i < labels_.size(); i++) {
            labelsData[i] = static_cast<int32_t>(labels_[i]);
        }
        
        Napi::Uint32Array lims = Napi::Uint32Array::New(env, lims_.size());
        uint32_t* limsData = lims.Data();
        for (size_t i = 0; i < lims_.size(); i++) {
            limsData[i] = static_cast<uint32_t>(lims_[i]);
        }
        
        result.Set("distances", distances);
        result.Set("labels", labels);
        result.Set("nq", Napi::Number::New(env, 1));
        result.Set("lims", lims);
        
        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* wrapper_;
    std::vector<float> query_;
    float radius_;
    std::vector<float> distances_;
    std::vector<int64_t> labels_;
    std::vector<size_t> lims_;
    Napi::Promise::Deferred deferred_;
};

// SearchBatch Worker
class SearchBatchWorker : public Napi::AsyncWorker {
public:
    SearchBatchWorker(FaissIndexWrapper* wrapper, const float* queries, size_t nq, int k, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "SearchBatchWorker"),
          wrapper_(wrapper),
          queries_(queries, queries + nq * wrapper->GetDimensions()),
          nq_(nq),
          k_(k),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }
            
            size_t ntotal = wrapper_->GetTotalVectors();
            if (ntotal == 0) {
                SetError("Cannot search empty index");
                return;
            }
            
            int actual_k = (k_ > static_cast<int>(ntotal)) ? static_cast<int>(ntotal) : k_;
            distances_.resize(nq_ * actual_k);
            labels_.resize(nq_ * actual_k);
            
            wrapper_->SearchBatch(queries_.data(), nq_, actual_k, distances_.data(), labels_.data());
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::Object result = Napi::Object::New(env);
        
        Napi::Float32Array distances = Napi::Float32Array::New(env, distances_.size());
        memcpy(distances.Data(), distances_.data(), distances_.size() * sizeof(float));
        
        Napi::Int32Array labels = Napi::Int32Array::New(env, labels_.size());
        int32_t* labelsData = labels.Data();
        for (size_t i = 0; i < labels_.size(); i++) {
            labelsData[i] = static_cast<int32_t>(labels_[i]);
        }
        
        result.Set("distances", distances);
        result.Set("labels", labels);
        result.Set("nq", Napi::Number::New(env, nq_));
        result.Set("k", Napi::Number::New(env, static_cast<int>(distances_.size() / nq_)));
        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* wrapper_;
    std::vector<float> queries_;
    size_t nq_;
    int k_;
    std::vector<float> distances_;
    std::vector<faiss::idx_t> labels_;
    Napi::Promise::Deferred deferred_;
};

// Save Worker
class SaveWorker : public Napi::AsyncWorker {
public:
    SaveWorker(FaissIndexWrapper* wrapper, const std::string& filename, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "SaveWorker"),
          wrapper_(wrapper),
          filename_(filename),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }
            wrapper_->Save(filename_);
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* wrapper_;
    std::string filename_;
    Napi::Promise::Deferred deferred_;
};

// ToBuffer Worker
class ToBufferWorker : public Napi::AsyncWorker {
public:
    ToBufferWorker(FaissIndexWrapper* wrapper, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "ToBufferWorker"),
          wrapper_(wrapper),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }
            buffer_ = wrapper_->ToBuffer();
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::Buffer<uint8_t> nodeBuffer = Napi::Buffer<uint8_t>::Copy(env, buffer_.data(), buffer_.size());
        deferred_.Resolve(nodeBuffer);
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* wrapper_;
    std::vector<uint8_t> buffer_;
    Napi::Promise::Deferred deferred_;
};

// MergeFrom Worker
class MergeFromWorker : public Napi::AsyncWorker {
public:
    MergeFromWorker(FaissIndexWrapper* target, FaissIndexWrapper* source, Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(deferred.Env(), "MergeFromWorker"),
          target_(target),
          source_(source),
          deferred_(deferred) {
    }

    void Execute() override {
        try {
            if (target_->IsDisposed()) {
                SetError("Target index has been disposed");
                return;
            }
            if (source_->IsDisposed()) {
                SetError("Source index has been disposed");
                return;
            }
            target_->MergeFrom(*source_);
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    FaissIndexWrapper* target_;
    FaissIndexWrapper* source_;
    Napi::Promise::Deferred deferred_;
};

// Wrapper class that bridges N-API and our C++ wrapper
class FaissIndexWrapperJS : public Napi::ObjectWrap<FaissIndexWrapperJS> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    FaissIndexWrapperJS(const Napi::CallbackInfo& info);
    ~FaissIndexWrapperJS();

private:
    static Napi::FunctionReference constructor;
    std::unique_ptr<FaissIndexWrapper> wrapper_;
    int dims_;
    
    // Methods
    Napi::Value Add(const Napi::CallbackInfo& info);
    Napi::Value Train(const Napi::CallbackInfo& info);
    Napi::Value Search(const Napi::CallbackInfo& info);
    Napi::Value SearchBatch(const Napi::CallbackInfo& info);
    Napi::Value RangeSearch(const Napi::CallbackInfo& info);
    Napi::Value GetStats(const Napi::CallbackInfo& info);
    Napi::Value Dispose(const Napi::CallbackInfo& info);
    Napi::Value Save(const Napi::CallbackInfo& info);
    Napi::Value ToBuffer(const Napi::CallbackInfo& info);
    Napi::Value MergeFrom(const Napi::CallbackInfo& info);
    Napi::Value SetNprobe(const Napi::CallbackInfo& info);
    Napi::Value Reset(const Napi::CallbackInfo& info);
    
    // Static methods
    static Napi::Value Load(const Napi::CallbackInfo& info);
    static Napi::Value FromBuffer(const Napi::CallbackInfo& info);
    
    // Helper methods
    void ValidateNotDisposed(Napi::Env env) const;
    Napi::Float32Array CreateFloat32Array(Napi::Env env, size_t length, const float* data);
    Napi::Int32Array CreateInt32Array(Napi::Env env, size_t length, const faiss::idx_t* data);
};

// Static constructor reference
Napi::FunctionReference FaissIndexWrapperJS::constructor;

Napi::Object FaissIndexWrapperJS::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "FaissIndexWrapper", {
        InstanceMethod("add", &FaissIndexWrapperJS::Add),
        InstanceMethod("train", &FaissIndexWrapperJS::Train),
        InstanceMethod("search", &FaissIndexWrapperJS::Search),
        InstanceMethod("searchBatch", &FaissIndexWrapperJS::SearchBatch),
        InstanceMethod("rangeSearch", &FaissIndexWrapperJS::RangeSearch),
        InstanceMethod("getStats", &FaissIndexWrapperJS::GetStats),
        InstanceMethod("dispose", &FaissIndexWrapperJS::Dispose),
        InstanceMethod("save", &FaissIndexWrapperJS::Save),
        InstanceMethod("toBuffer", &FaissIndexWrapperJS::ToBuffer),
        InstanceMethod("mergeFrom", &FaissIndexWrapperJS::MergeFrom),
        InstanceMethod("setNprobe", &FaissIndexWrapperJS::SetNprobe),
        InstanceMethod("reset", &FaissIndexWrapperJS::Reset),
        StaticMethod("load", &FaissIndexWrapperJS::Load),
        StaticMethod("fromBuffer", &FaissIndexWrapperJS::FromBuffer),
    });
    
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    
    exports.Set("FaissIndexWrapper", func);
    return exports;
}

FaissIndexWrapperJS::FaissIndexWrapperJS(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<FaissIndexWrapperJS>(info), dims_(0) {
    Napi::Env env = info.Env();
    
    try {
        // Validate constructor arguments
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: { dims: number }");
        }
        
        if (!info[0].IsObject()) {
            throw Napi::TypeError::New(env, "Expected object with 'dims' property");
        }
        
        Napi::Object config = info[0].As<Napi::Object>();
        
        if (!config.Has("dims") || !config.Get("dims").IsNumber()) {
            throw Napi::TypeError::New(env, "Config must have 'dims' as a number");
        }
        
        dims_ = config.Get("dims").As<Napi::Number>().Int32Value();
        
        if (dims_ <= 0) {
            throw Napi::RangeError::New(env, "Dimensions must be positive");
        }
        
        // Get index type (default to "FLAT_L2" -> "Flat")
        std::string indexDescription = "Flat";  // Default: IndexFlatL2
        int metric = 1;  // Default: METRIC_L2
        
        if (config.Has("type") && config.Get("type").IsString()) {
            std::string type = config.Get("type").As<Napi::String>().Utf8Value();
            
            if (type == "FLAT_L2") {
                indexDescription = "Flat";
                metric = 1;  // METRIC_L2
            } else if (type == "FLAT_IP") {
                indexDescription = "Flat";
                metric = 0;  // METRIC_INNER_PRODUCT
            } else if (type == "IVF_FLAT") {
                // Build IVF string: "IVF{nlist},Flat"
                int nlist = 100;  // Default number of clusters
                if (config.Has("nlist") && config.Get("nlist").IsNumber()) {
                    nlist = config.Get("nlist").As<Napi::Number>().Int32Value();
                }
                indexDescription = "IVF" + std::to_string(nlist) + ",Flat";
                metric = 1;  // METRIC_L2
            } else if (type == "HNSW") {
                // Build HNSW string: "HNSW{M}"
                int M = 16;  // Default connections per node
                if (config.Has("M") && config.Get("M").IsNumber()) {
                    M = config.Get("M").As<Napi::Number>().Int32Value();
                }
                indexDescription = "HNSW" + std::to_string(M);
                metric = 1;  // METRIC_L2
            } else {
                throw Napi::TypeError::New(env, "Unsupported index type: " + type + ". Supported: FLAT_L2, FLAT_IP, IVF_FLAT, HNSW");
            }
        }
        
        // Create the C++ wrapper with index_factory
        wrapper_ = std::make_unique<FaissIndexWrapper>(dims_, indexDescription, metric);
        
        // Set nprobe for IVF indexes
        if (config.Has("nprobe") && config.Get("nprobe").IsNumber()) {
            int nprobe = config.Get("nprobe").As<Napi::Number>().Int32Value();
            wrapper_->SetNprobe(nprobe);
        }
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error creating index");
    }
}

FaissIndexWrapperJS::~FaissIndexWrapperJS() {
    // RAII: wrapper_ will be automatically destroyed
    // But we can explicitly dispose if needed
    if (wrapper_ && !wrapper_->IsDisposed()) {
        wrapper_->Dispose();
    }
}

void FaissIndexWrapperJS::ValidateNotDisposed(Napi::Env env) const {
    if (!wrapper_ || wrapper_->IsDisposed()) {
        throw Napi::Error::New(env, "Index has been disposed");
    }
}

Napi::Value FaissIndexWrapperJS::Add(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected at least 1 argument: vectors (Float32Array)");
        }
        
        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Float32Array");
        }
        
        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        
        if (arr.TypedArrayType() != napi_float32_array) {
            throw Napi::TypeError::New(env, "Expected Float32Array");
        }
        
        Napi::Float32Array floatArr = arr.As<Napi::Float32Array>();
        size_t length = floatArr.ElementLength();
        
        // Validate dimensions
        if (length % dims_ != 0) {
            throw Napi::RangeError::New(env, 
                "Vector length must be a multiple of dimensions. Got " + 
                std::to_string(length) + ", expected multiple of " + std::to_string(dims_));
        }
        
        size_t n = length / dims_;
        
        // Get pointer to data (zero-copy read) - copy data for async worker
        const float* data = floatArr.Data();
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        AddWorker* worker = new AddWorker(wrapper_.get(), data, n, dims_, deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in add()");
    }
}

Napi::Value FaissIndexWrapperJS::Train(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: vectors (Float32Array)");
        }
        
        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Float32Array");
        }
        
        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        
        if (arr.TypedArrayType() != napi_float32_array) {
            throw Napi::TypeError::New(env, "Expected Float32Array");
        }
        
        Napi::Float32Array floatArr = arr.As<Napi::Float32Array>();
        size_t length = floatArr.ElementLength();
        
        // Validate dimensions
        if (length % dims_ != 0) {
            throw Napi::RangeError::New(env, 
                "Vector length must be a multiple of dimensions. Got " + 
                std::to_string(length) + ", expected multiple of " + std::to_string(dims_));
        }
        
        size_t n = length / dims_;
        
        // Get pointer to data (zero-copy read) - copy data for async worker
        const float* data = floatArr.Data();
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        TrainWorker* worker = new TrainWorker(wrapper_.get(), data, n, dims_, deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in train()");
    }
}

Napi::Value FaissIndexWrapperJS::SetNprobe(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: nprobe (number)");
        }
        
        if (!info[0].IsNumber()) {
            throw Napi::TypeError::New(env, "Expected number for nprobe");
        }
        
        int nprobe = info[0].As<Napi::Number>().Int32Value();
        
        if (nprobe <= 0) {
            throw Napi::RangeError::New(env, "nprobe must be positive");
        }
        
        wrapper_->SetNprobe(nprobe);
        return env.Undefined();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in setNprobe()");
    }
}

Napi::Value FaissIndexWrapperJS::Search(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 2) {
            throw Napi::TypeError::New(env, "Expected 2 arguments: query (Float32Array), k (number)");
        }
        
        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Float32Array for query");
        }
        
        if (!info[1].IsNumber()) {
            throw Napi::TypeError::New(env, "Expected number for k");
        }
        
        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_float32_array) {
            throw Napi::TypeError::New(env, "Expected Float32Array for query");
        }
        
        Napi::Float32Array queryArr = arr.As<Napi::Float32Array>();
        int k = info[1].As<Napi::Number>().Int32Value();
        
        if (static_cast<int>(queryArr.ElementLength()) != dims_) {
            throw Napi::RangeError::New(env, 
                "Query vector length must match index dimensions. Got " + 
                std::to_string(queryArr.ElementLength()) + ", expected " + std::to_string(dims_));
        }
        
        if (k <= 0) {
            throw Napi::RangeError::New(env, "k must be positive");
        }
        
        // Get query pointer (zero-copy read) - copy data for async worker
        const float* query = queryArr.Data();
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        SearchWorker* worker = new SearchWorker(wrapper_.get(), query, k, deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in search()");
    }
}

Napi::Value FaissIndexWrapperJS::SearchBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 2) {
            throw Napi::TypeError::New(env, "Expected 2 arguments: queries (Float32Array), k (number)");
        }
        
        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Float32Array for queries");
        }
        
        if (!info[1].IsNumber()) {
            throw Napi::TypeError::New(env, "Expected number for k");
        }
        
        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_float32_array) {
            throw Napi::TypeError::New(env, "Expected Float32Array for queries");
        }
        
        Napi::Float32Array queriesArr = arr.As<Napi::Float32Array>();
        size_t totalElements = queriesArr.ElementLength();
        int k = info[1].As<Napi::Number>().Int32Value();
        
        if (totalElements == 0) {
            throw Napi::RangeError::New(env, "Queries array cannot be empty");
        }
        
        if (totalElements % dims_ != 0) {
            throw Napi::RangeError::New(env,
                "Queries array length must be a multiple of index dimensions. Got " +
                std::to_string(totalElements) + ", expected multiple of " + std::to_string(dims_));
        }
        
        size_t nq = totalElements / dims_;
        
        if (k <= 0) {
            throw Napi::RangeError::New(env, "k must be positive");
        }
        
        // Get queries pointer (zero-copy read) - copy data for async worker
        const float* queries = queriesArr.Data();
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        SearchBatchWorker* worker = new SearchBatchWorker(wrapper_.get(), queries, nq, k, deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in searchBatch()");
    }
}

Napi::Value FaissIndexWrapperJS::RangeSearch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 2) {
            throw Napi::TypeError::New(env, "Expected 2 arguments: query (Float32Array), radius (number)");
        }
        
        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Float32Array for query");
        }
        
        if (!info[1].IsNumber()) {
            throw Napi::TypeError::New(env, "Expected number for radius");
        }
        
        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_float32_array) {
            throw Napi::TypeError::New(env, "Expected Float32Array for query");
        }
        
        Napi::Float32Array queryArr = arr.As<Napi::Float32Array>();
        float radius = info[1].As<Napi::Number>().FloatValue();
        
        if (static_cast<int>(queryArr.ElementLength()) != dims_) {
            throw Napi::RangeError::New(env, 
                "Query vector length must match index dimensions. Got " + 
                std::to_string(queryArr.ElementLength()) + ", expected " + std::to_string(dims_));
        }
        
        if (radius < 0) {
            throw Napi::RangeError::New(env, "Radius must be non-negative");
        }
        
        // Get query pointer (zero-copy read) - copy data for async worker
        const float* query = queryArr.Data();
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        RangeSearchWorker* worker = new RangeSearchWorker(wrapper_.get(), query, radius, deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in rangeSearch()");
    }
}

Napi::Value FaissIndexWrapperJS::GetStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        Napi::Object stats = Napi::Object::New(env);
        stats.Set("ntotal", Napi::Number::New(env, wrapper_->GetTotalVectors()));
        stats.Set("dims", Napi::Number::New(env, wrapper_->GetDimensions()));
        stats.Set("isTrained", Napi::Boolean::New(env, wrapper_->IsTrained()));
        stats.Set("type", Napi::String::New(env, "FLAT_L2"));
        
        return stats;
        
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in getStats()");
    }
}

Napi::Value FaissIndexWrapperJS::Dispose(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (wrapper_ && !wrapper_->IsDisposed()) {
        wrapper_->Dispose();
    }
    
    return env.Undefined();
}

Napi::Value FaissIndexWrapperJS::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        // Reset is synchronous (clears vectors, keeps index structure)
        wrapper_->Reset();
        
        return env.Undefined();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in reset()");
    }
}

Napi::Float32Array FaissIndexWrapperJS::CreateFloat32Array(Napi::Env env, size_t length, const float* data) {
    Napi::Float32Array arr = Napi::Float32Array::New(env, length);
    memcpy(arr.Data(), data, length * sizeof(float));
    return arr;
}

Napi::Int32Array FaissIndexWrapperJS::CreateInt32Array(Napi::Env env, size_t length, const faiss::idx_t* data) {
    Napi::Int32Array arr = Napi::Int32Array::New(env, length);
    // faiss::idx_t is typically int64_t, but we'll cast to int32_t for JS
    // Use direct pointer access for better performance
    int32_t* arrData = arr.Data();
    for (size_t i = 0; i < length; i++) {
        arrData[i] = static_cast<int32_t>(data[i]);
    }
    return arr;
}

Napi::Value FaissIndexWrapperJS::Save(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: filename (string)");
        }
        
        if (!info[0].IsString()) {
            throw Napi::TypeError::New(env, "Expected string for filename");
        }
        
        std::string filename = info[0].As<Napi::String>().Utf8Value();
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        SaveWorker* worker = new SaveWorker(wrapper_.get(), filename, deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in save()");
    }
}

Napi::Value FaissIndexWrapperJS::ToBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        ToBufferWorker* worker = new ToBufferWorker(wrapper_.get(), deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in toBuffer()");
    }
}

Napi::Value FaissIndexWrapperJS::MergeFrom(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        ValidateNotDisposed(env);
        
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: otherIndex (FaissIndex)");
        }
        
        if (!info[0].IsObject()) {
            throw Napi::TypeError::New(env, "Expected FaissIndex object");
        }
        
        // Get the other index instance
        Napi::Object otherObj = info[0].As<Napi::Object>();
        FaissIndexWrapperJS* otherInstance = Napi::ObjectWrap<FaissIndexWrapperJS>::Unwrap(otherObj);
        
        if (!otherInstance || !otherInstance->wrapper_) {
            throw Napi::Error::New(env, "Invalid index object");
        }
        
        if (otherInstance->wrapper_->IsDisposed()) {
            throw Napi::Error::New(env, "Cannot merge from disposed index");
        }
        
        // Create promise and async worker
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        MergeFromWorker* worker = new MergeFromWorker(wrapper_.get(), otherInstance->wrapper_.get(), deferred);
        worker->Queue();
        
        return deferred.Promise();
        
    } catch (const Napi::Error& e) {
        throw; // Re-throw N-API errors
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in mergeFrom()");
    }
}

Napi::Value FaissIndexWrapperJS::Load(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: filename (string)");
        }
        
        if (!info[0].IsString()) {
            throw Napi::TypeError::New(env, "Expected string for filename");
        }
        
        std::string filename = info[0].As<Napi::String>().Utf8Value();
        auto loaded_wrapper = FaissIndexWrapper::Load(filename);
        
        // Create new JS instance with dummy config (will be replaced)
        int dims = loaded_wrapper->GetDimensions();
        Napi::Object config = Napi::Object::New(env);
        config.Set("dims", Napi::Number::New(env, dims));
        Napi::Object obj = constructor.New({config});
        FaissIndexWrapperJS* instance = Napi::ObjectWrap<FaissIndexWrapperJS>::Unwrap(obj);
        
        // Replace the wrapper with the loaded one
        instance->wrapper_ = std::move(loaded_wrapper);
        instance->dims_ = dims;
        
        return obj;
        
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in load()");
    }
}

Napi::Value FaissIndexWrapperJS::FromBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: buffer (Buffer)");
        }
        
        if (!info[0].IsBuffer()) {
            throw Napi::TypeError::New(env, "Expected Buffer");
        }
        
        Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
        const uint8_t* data = buffer.Data();
        size_t length = buffer.Length();
        
        auto loaded_wrapper = FaissIndexWrapper::FromBuffer(data, length);
        
        // Create new JS instance with dummy config (will be replaced)
        int dims = loaded_wrapper->GetDimensions();
        Napi::Object config = Napi::Object::New(env);
        config.Set("dims", Napi::Number::New(env, dims));
        Napi::Object obj = constructor.New({config});
        FaissIndexWrapperJS* instance = Napi::ObjectWrap<FaissIndexWrapperJS>::Unwrap(obj);
        
        // Replace the wrapper with the loaded one
        instance->wrapper_ = std::move(loaded_wrapper);
        instance->dims_ = dims;
        
        return obj;
        
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in fromBuffer()");
    }
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    FaissIndexWrapperJS::Init(env, exports);
    return exports;
}

NODE_API_MODULE(faiss_node, Init)
