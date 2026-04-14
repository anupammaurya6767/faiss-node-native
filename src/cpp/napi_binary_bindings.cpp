#include <napi.h>

#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "faiss_binary_index.h"
#include "napi_binary_bindings.h"

class BinaryOwnedAsyncWorker : public Napi::AsyncWorker {
public:
    BinaryOwnedAsyncWorker(
            const Napi::Object& owner,
            Napi::Promise::Deferred deferred,
            const char* name)
        : Napi::AsyncWorker(deferred.Env(), name),
          owner_ref_(Napi::Persistent(owner)),
          deferred_(deferred) {}

protected:
    void ReleaseOwner() {
        owner_ref_.Reset();
    }

private:
    Napi::ObjectReference owner_ref_;
protected:
    Napi::Promise::Deferred deferred_;
};

class BinaryDualOwnedAsyncWorker : public Napi::AsyncWorker {
public:
    BinaryDualOwnedAsyncWorker(
            const Napi::Object& primaryOwner,
            const Napi::Object& secondaryOwner,
            Napi::Promise::Deferred deferred,
            const char* name)
        : Napi::AsyncWorker(deferred.Env(), name),
          primary_owner_ref_(Napi::Persistent(primaryOwner)),
          secondary_owner_ref_(Napi::Persistent(secondaryOwner)),
          deferred_(deferred) {}

protected:
    void ReleaseOwners() {
        primary_owner_ref_.Reset();
        secondary_owner_ref_.Reset();
    }

private:
    Napi::ObjectReference primary_owner_ref_;
    Napi::ObjectReference secondary_owner_ref_;
protected:
    Napi::Promise::Deferred deferred_;
};

class BinaryAddWorker : public BinaryOwnedAsyncWorker {
public:
    BinaryAddWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            const uint8_t* vectors,
            size_t n,
            int codeSize,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinaryAddWorker"),
          wrapper_(wrapper),
          vectors_(vectors, vectors + n * static_cast<size_t>(codeSize)),
          n_(n) {}

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
        ReleaseOwner();
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::vector<uint8_t> vectors_;
    size_t n_;
};

class BinaryTrainWorker : public BinaryOwnedAsyncWorker {
public:
    BinaryTrainWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            const uint8_t* vectors,
            size_t n,
            int codeSize,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinaryTrainWorker"),
          wrapper_(wrapper),
          vectors_(vectors, vectors + n * static_cast<size_t>(codeSize)),
          n_(n) {}

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
        ReleaseOwner();
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::vector<uint8_t> vectors_;
    size_t n_;
};

class BinarySearchWorker : public BinaryOwnedAsyncWorker {
public:
    BinarySearchWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            const uint8_t* query,
            int codeSize,
            int k,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinarySearchWorker"),
          wrapper_(wrapper),
          query_(query, query + codeSize),
          k_(k) {}

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

        Napi::Int32Array distances = Napi::Int32Array::New(env, distances_.size());
        memcpy(distances.Data(), distances_.data(), distances_.size() * sizeof(int32_t));

        Napi::Int32Array labels = Napi::Int32Array::New(env, labels_.size());
        int32_t* labelsData = labels.Data();
        for (size_t i = 0; i < labels_.size(); i++) {
            labelsData[i] = static_cast<int32_t>(labels_[i]);
        }

        result.Set("distances", distances);
        result.Set("labels", labels);
        ReleaseOwner();
        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::vector<uint8_t> query_;
    int k_;
    std::vector<int32_t> distances_;
    std::vector<faiss::idx_t> labels_;
};

class BinarySearchBatchWorker : public BinaryOwnedAsyncWorker {
public:
    BinarySearchBatchWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            const uint8_t* queries,
            size_t nq,
            int codeSize,
            int k,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinarySearchBatchWorker"),
          wrapper_(wrapper),
          queries_(queries, queries + nq * static_cast<size_t>(codeSize)),
          nq_(nq),
          k_(k) {}

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
            distances_.resize(nq_ * static_cast<size_t>(actual_k));
            labels_.resize(nq_ * static_cast<size_t>(actual_k));
            wrapper_->SearchBatch(
                queries_.data(),
                nq_,
                actual_k,
                distances_.data(),
                labels_.data());
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::Object result = Napi::Object::New(env);

        Napi::Int32Array distances = Napi::Int32Array::New(env, distances_.size());
        memcpy(distances.Data(), distances_.data(), distances_.size() * sizeof(int32_t));

        Napi::Int32Array labels = Napi::Int32Array::New(env, labels_.size());
        int32_t* labelsData = labels.Data();
        for (size_t i = 0; i < labels_.size(); i++) {
            labelsData[i] = static_cast<int32_t>(labels_[i]);
        }

        result.Set("distances", distances);
        result.Set("labels", labels);
        result.Set("nq", Napi::Number::New(env, nq_));
        result.Set("k", Napi::Number::New(env, static_cast<int>(distances_.size() / nq_)));
        ReleaseOwner();
        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::vector<uint8_t> queries_;
    size_t nq_;
    int k_;
    std::vector<int32_t> distances_;
    std::vector<faiss::idx_t> labels_;
};

class BinaryReconstructWorker : public BinaryOwnedAsyncWorker {
public:
    BinaryReconstructWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            int64_t id,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinaryReconstructWorker"),
          wrapper_(wrapper),
          id_(id) {}

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }

            output_.resize(static_cast<size_t>(wrapper_->GetCodeSize()));
            wrapper_->Reconstruct(id_, output_.data());
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::Uint8Array result = Napi::Uint8Array::New(env, output_.size());
        memcpy(result.Data(), output_.data(), output_.size() * sizeof(uint8_t));
        ReleaseOwner();
        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    int64_t id_;
    std::vector<uint8_t> output_;
};

class BinaryReconstructBatchWorker : public BinaryOwnedAsyncWorker {
public:
    BinaryReconstructBatchWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            const int32_t* ids,
            size_t n,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinaryReconstructBatchWorker"),
          wrapper_(wrapper),
          ids_(ids, ids + n) {}

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }

            output_.resize(ids_.size() * static_cast<size_t>(wrapper_->GetCodeSize()));
            std::vector<int64_t> ids64(ids_.begin(), ids_.end());
            wrapper_->ReconstructBatch(ids64.data(), ids64.size(), output_.data());
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::Uint8Array result = Napi::Uint8Array::New(env, output_.size());
        memcpy(result.Data(), output_.data(), output_.size() * sizeof(uint8_t));
        ReleaseOwner();
        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::vector<int32_t> ids_;
    std::vector<uint8_t> output_;
};

class BinaryRemoveIdsWorker : public BinaryOwnedAsyncWorker {
public:
    BinaryRemoveIdsWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            const int32_t* ids,
            size_t n,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinaryRemoveIdsWorker"),
          wrapper_(wrapper),
          ids_(ids, ids + n),
          removed_(0) {}

    void Execute() override {
        try {
            if (wrapper_->IsDisposed()) {
                SetError("Index has been disposed");
                return;
            }

            std::vector<int64_t> ids64(ids_.begin(), ids_.end());
            removed_ = wrapper_->RemoveIds(ids64.data(), ids64.size());
        } catch (const std::exception& e) {
            SetError(std::string("FAISS error: ") + e.what());
        }
    }

    void OnOK() override {
        ReleaseOwner();
        deferred_.Resolve(Napi::Number::New(Env(), removed_));
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::vector<int32_t> ids_;
    size_t removed_;
};

class BinarySaveWorker : public BinaryOwnedAsyncWorker {
public:
    BinarySaveWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            const std::string& filename,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinarySaveWorker"),
          wrapper_(wrapper),
          filename_(filename) {}

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
        ReleaseOwner();
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::string filename_;
};

class BinaryToBufferWorker : public BinaryOwnedAsyncWorker {
public:
    BinaryToBufferWorker(
            const Napi::Object& owner,
            FaissBinaryIndexWrapper* wrapper,
            Napi::Promise::Deferred deferred)
        : BinaryOwnedAsyncWorker(owner, deferred, "BinaryToBufferWorker"),
          wrapper_(wrapper) {}

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
        ReleaseOwner();
        deferred_.Resolve(nodeBuffer);
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwner();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* wrapper_;
    std::vector<uint8_t> buffer_;
};

class BinaryMergeFromWorker : public BinaryDualOwnedAsyncWorker {
public:
    BinaryMergeFromWorker(
            const Napi::Object& targetOwner,
            FaissBinaryIndexWrapper* target,
            const Napi::Object& sourceOwner,
            FaissBinaryIndexWrapper* source,
            Napi::Promise::Deferred deferred)
        : BinaryDualOwnedAsyncWorker(targetOwner, sourceOwner, deferred, "BinaryMergeFromWorker"),
          target_(target),
          source_(source) {}

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
        ReleaseOwners();
        deferred_.Resolve(Env().Undefined());
    }

    void OnError(const Napi::Error& e) override {
        ReleaseOwners();
        deferred_.Reject(e.Value());
    }

private:
    FaissBinaryIndexWrapper* target_;
    FaissBinaryIndexWrapper* source_;
};

class FaissBinaryIndexWrapperJS : public Napi::ObjectWrap<FaissBinaryIndexWrapperJS> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    FaissBinaryIndexWrapperJS(const Napi::CallbackInfo& info);
    ~FaissBinaryIndexWrapperJS();

private:
    static Napi::FunctionReference constructor;
    std::unique_ptr<FaissBinaryIndexWrapper> wrapper_;
    int dims_;

    Napi::Value Add(const Napi::CallbackInfo& info);
    Napi::Value Train(const Napi::CallbackInfo& info);
    Napi::Value Search(const Napi::CallbackInfo& info);
    Napi::Value SearchBatch(const Napi::CallbackInfo& info);
    Napi::Value Reconstruct(const Napi::CallbackInfo& info);
    Napi::Value ReconstructBatch(const Napi::CallbackInfo& info);
    Napi::Value RemoveIds(const Napi::CallbackInfo& info);
    Napi::Value GetStats(const Napi::CallbackInfo& info);
    Napi::Value Dispose(const Napi::CallbackInfo& info);
    Napi::Value Save(const Napi::CallbackInfo& info);
    Napi::Value ToBuffer(const Napi::CallbackInfo& info);
    Napi::Value MergeFrom(const Napi::CallbackInfo& info);
    Napi::Value SetNprobe(const Napi::CallbackInfo& info);
    Napi::Value ToGpu(const Napi::CallbackInfo& info);
    Napi::Value ToCpu(const Napi::CallbackInfo& info);
    Napi::Value Reset(const Napi::CallbackInfo& info);

    static Napi::Value Load(const Napi::CallbackInfo& info);
    static Napi::Value FromBuffer(const Napi::CallbackInfo& info);
    static Napi::Value GpuSupport(const Napi::CallbackInfo& info);

    void ValidateNotDisposed(Napi::Env env) const;
};

Napi::FunctionReference FaissBinaryIndexWrapperJS::constructor;

Napi::Object FaissBinaryIndexWrapperJS::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "FaissBinaryIndexWrapper", {
        InstanceMethod("add", &FaissBinaryIndexWrapperJS::Add),
        InstanceMethod("train", &FaissBinaryIndexWrapperJS::Train),
        InstanceMethod("search", &FaissBinaryIndexWrapperJS::Search),
        InstanceMethod("searchBatch", &FaissBinaryIndexWrapperJS::SearchBatch),
        InstanceMethod("reconstruct", &FaissBinaryIndexWrapperJS::Reconstruct),
        InstanceMethod("reconstructBatch", &FaissBinaryIndexWrapperJS::ReconstructBatch),
        InstanceMethod("removeIds", &FaissBinaryIndexWrapperJS::RemoveIds),
        InstanceMethod("getStats", &FaissBinaryIndexWrapperJS::GetStats),
        InstanceMethod("dispose", &FaissBinaryIndexWrapperJS::Dispose),
        InstanceMethod("save", &FaissBinaryIndexWrapperJS::Save),
        InstanceMethod("toBuffer", &FaissBinaryIndexWrapperJS::ToBuffer),
        InstanceMethod("mergeFrom", &FaissBinaryIndexWrapperJS::MergeFrom),
        InstanceMethod("setNprobe", &FaissBinaryIndexWrapperJS::SetNprobe),
        InstanceMethod("toGpu", &FaissBinaryIndexWrapperJS::ToGpu),
        InstanceMethod("toCpu", &FaissBinaryIndexWrapperJS::ToCpu),
        InstanceMethod("reset", &FaissBinaryIndexWrapperJS::Reset),
        StaticMethod("load", &FaissBinaryIndexWrapperJS::Load),
        StaticMethod("fromBuffer", &FaissBinaryIndexWrapperJS::FromBuffer),
        StaticMethod("gpuSupport", &FaissBinaryIndexWrapperJS::GpuSupport),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("FaissBinaryIndexWrapper", func);
    return exports;
}

FaissBinaryIndexWrapperJS::FaissBinaryIndexWrapperJS(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<FaissBinaryIndexWrapperJS>(info), dims_(0) {
    Napi::Env env = info.Env();

    try {
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
        if (dims_ % 8 != 0) {
            throw Napi::RangeError::New(env, "Binary index dimensions must be divisible by 8");
        }

        std::string indexDescription = "BFlat";
        std::string typeLabel = "BINARY_FLAT";
        bool isHnsw = false;
        int efConstruction = 200;
        int efSearch = 50;
        std::string factoryDescription;

        auto readPositiveInt = [&](const char* key, int defaultValue) -> int {
            if (!config.Has(key)) {
                return defaultValue;
            }

            if (!config.Get(key).IsNumber()) {
                throw Napi::TypeError::New(env, std::string("Expected number for ") + key);
            }

            int value = config.Get(key).As<Napi::Number>().Int32Value();
            if (value <= 0) {
                throw Napi::RangeError::New(env, std::string(key) + " must be positive");
            }

            return value;
        };

        auto readNonNegativeInt = [&](const char* key, int defaultValue) -> int {
            if (!config.Has(key)) {
                return defaultValue;
            }

            if (!config.Get(key).IsNumber()) {
                throw Napi::TypeError::New(env, std::string("Expected number for ") + key);
            }

            int value = config.Get(key).As<Napi::Number>().Int32Value();
            if (value < 0) {
                throw Napi::RangeError::New(env, std::string(key) + " must be non-negative");
            }

            return value;
        };

        if (config.Has("factory")) {
            if (!config.Get("factory").IsString()) {
                throw Napi::TypeError::New(env, "Expected string for factory");
            }

            indexDescription = config.Get("factory").As<Napi::String>().Utf8Value();
            factoryDescription = indexDescription;
            typeLabel.clear();
        } else if (config.Has("type") && config.Get("type").IsString()) {
            std::string type = config.Get("type").As<Napi::String>().Utf8Value();
            typeLabel = type;

            if (type == "BINARY_FLAT") {
                indexDescription = "BFlat";
            } else if (type == "BINARY_HNSW") {
                isHnsw = true;
                int M = readPositiveInt("M", 32);
                indexDescription = "BHNSW" + std::to_string(M);
                if (config.Has("efConstruction")) {
                    efConstruction = readPositiveInt("efConstruction", efConstruction);
                }
                if (config.Has("efSearch")) {
                    efSearch = readPositiveInt("efSearch", efSearch);
                }
            } else if (type == "BINARY_IVF") {
                int nlist = readPositiveInt("nlist", 100);
                indexDescription = "BIVF" + std::to_string(nlist);
            } else if (type == "BINARY_HASH") {
                int hashBits = readPositiveInt("hashBits", 64);
                int hashNflip = readNonNegativeInt("hashNflip", -1);
                indexDescription = "BHash" + std::to_string(hashBits);
                if (hashNflip >= 0) {
                    indexDescription += "x" + std::to_string(hashNflip);
                }
            } else {
                throw Napi::TypeError::New(
                    env,
                    "Unsupported binary index type: " + type +
                        ". Supported: BINARY_FLAT, BINARY_HNSW, BINARY_IVF, BINARY_HASH");
            }
        }

        wrapper_ = std::make_unique<FaissBinaryIndexWrapper>(
            dims_,
            indexDescription,
            typeLabel,
            factoryDescription);

        if (isHnsw) {
            wrapper_->SetHnswParams(efConstruction, efSearch);
        }

        if (config.Has("nprobe") && config.Get("nprobe").IsNumber()) {
            int nprobe = config.Get("nprobe").As<Napi::Number>().Int32Value();
            if (nprobe <= 0) {
                throw Napi::RangeError::New(env, "nprobe must be positive");
            }
            wrapper_->SetNprobe(nprobe);
        }
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error creating binary index");
    }
}

FaissBinaryIndexWrapperJS::~FaissBinaryIndexWrapperJS() {
    if (wrapper_ && !wrapper_->IsDisposed()) {
        wrapper_->Dispose();
    }
}

void FaissBinaryIndexWrapperJS::ValidateNotDisposed(Napi::Env env) const {
    if (!wrapper_ || wrapper_->IsDisposed()) {
        throw Napi::Error::New(env, "Index has been disposed");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::Add(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected at least 1 argument: vectors (Uint8Array)");
        }

        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Uint8Array");
        }

        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_uint8_array) {
            throw Napi::TypeError::New(env, "Expected Uint8Array");
        }

        Napi::Uint8Array vectorArr = arr.As<Napi::Uint8Array>();
        size_t length = vectorArr.ElementLength();
        size_t codeSize = static_cast<size_t>(wrapper_->GetCodeSize());

        if (length % codeSize != 0) {
            throw Napi::RangeError::New(
                env,
                "Binary vector length must be a multiple of bytes-per-vector. Got " +
                    std::to_string(length) + ", expected multiple of " + std::to_string(codeSize));
        }

        size_t n = length / codeSize;
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinaryAddWorker* worker =
            new BinaryAddWorker(
                Value(),
                wrapper_.get(),
                vectorArr.Data(),
                n,
                static_cast<int>(codeSize),
                deferred);
        worker->Queue();

        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in add()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::Train(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: vectors (Uint8Array)");
        }

        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Uint8Array");
        }

        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_uint8_array) {
            throw Napi::TypeError::New(env, "Expected Uint8Array");
        }

        Napi::Uint8Array vectorArr = arr.As<Napi::Uint8Array>();
        size_t length = vectorArr.ElementLength();
        size_t codeSize = static_cast<size_t>(wrapper_->GetCodeSize());

        if (length % codeSize != 0) {
            throw Napi::RangeError::New(
                env,
                "Binary vector length must be a multiple of bytes-per-vector. Got " +
                    std::to_string(length) + ", expected multiple of " + std::to_string(codeSize));
        }

        size_t n = length / codeSize;
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinaryTrainWorker* worker =
            new BinaryTrainWorker(
                Value(),
                wrapper_.get(),
                vectorArr.Data(),
                n,
                static_cast<int>(codeSize),
                deferred);
        worker->Queue();

        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in train()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::Search(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 2) {
            throw Napi::TypeError::New(env, "Expected 2 arguments: query (Uint8Array), k (number)");
        }

        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Uint8Array for query");
        }

        if (!info[1].IsNumber()) {
            throw Napi::TypeError::New(env, "Expected number for k");
        }

        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_uint8_array) {
            throw Napi::TypeError::New(env, "Expected Uint8Array for query");
        }

        Napi::Uint8Array queryArr = arr.As<Napi::Uint8Array>();
        size_t codeSize = static_cast<size_t>(wrapper_->GetCodeSize());
        int k = info[1].As<Napi::Number>().Int32Value();

        if (queryArr.ElementLength() != codeSize) {
            throw Napi::RangeError::New(
                env,
                "Query length must match bytes-per-vector. Got " +
                    std::to_string(queryArr.ElementLength()) + ", expected " + std::to_string(codeSize));
        }

        if (k <= 0) {
            throw Napi::RangeError::New(env, "k must be positive");
        }

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinarySearchWorker* worker =
            new BinarySearchWorker(
                Value(),
                wrapper_.get(),
                queryArr.Data(),
                static_cast<int>(codeSize),
                k,
                deferred);
        worker->Queue();

        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in search()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::SearchBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 2) {
            throw Napi::TypeError::New(env, "Expected 2 arguments: queries (Uint8Array), k (number)");
        }

        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Uint8Array for queries");
        }

        if (!info[1].IsNumber()) {
            throw Napi::TypeError::New(env, "Expected number for k");
        }

        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_uint8_array) {
            throw Napi::TypeError::New(env, "Expected Uint8Array for queries");
        }

        Napi::Uint8Array queriesArr = arr.As<Napi::Uint8Array>();
        size_t totalBytes = queriesArr.ElementLength();
        size_t codeSize = static_cast<size_t>(wrapper_->GetCodeSize());
        int k = info[1].As<Napi::Number>().Int32Value();

        if (totalBytes == 0) {
            throw Napi::RangeError::New(env, "Queries array cannot be empty");
        }

        if (totalBytes % codeSize != 0) {
            throw Napi::RangeError::New(
                env,
                "Queries array length must be a multiple of bytes-per-vector. Got " +
                    std::to_string(totalBytes) + ", expected multiple of " + std::to_string(codeSize));
        }

        if (k <= 0) {
            throw Napi::RangeError::New(env, "k must be positive");
        }

        size_t nq = totalBytes / codeSize;
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinarySearchBatchWorker* worker = new BinarySearchBatchWorker(
            Value(),
            wrapper_.get(),
            queriesArr.Data(),
            nq,
            static_cast<int>(codeSize),
            k,
            deferred);
        worker->Queue();

        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in searchBatch()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::Reconstruct(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: id (number)");
        }

        if (!info[0].IsNumber()) {
            throw Napi::TypeError::New(env, "Expected number for id");
        }

        int64_t id = static_cast<int64_t>(info[0].As<Napi::Number>().Int64Value());
        if (id < 0) {
            throw Napi::RangeError::New(env, "id must be non-negative");
        }

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinaryReconstructWorker* worker = new BinaryReconstructWorker(Value(), wrapper_.get(), id, deferred);
        worker->Queue();
        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in reconstruct()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::ReconstructBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: ids (Int32Array)");
        }

        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Int32Array for ids");
        }

        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_int32_array) {
            throw Napi::TypeError::New(env, "Expected Int32Array for ids");
        }

        Napi::Int32Array idsArr = arr.As<Napi::Int32Array>();
        if (idsArr.ElementLength() == 0) {
            throw Napi::RangeError::New(env, "ids array cannot be empty");
        }

        for (size_t i = 0; i < idsArr.ElementLength(); i++) {
            if (idsArr[i] < 0) {
                throw Napi::RangeError::New(env, "ids must be non-negative");
            }
        }

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinaryReconstructBatchWorker* worker =
            new BinaryReconstructBatchWorker(
                Value(),
                wrapper_.get(),
                idsArr.Data(),
                idsArr.ElementLength(),
                deferred);
        worker->Queue();

        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in reconstructBatch()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::RemoveIds(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: ids (Int32Array)");
        }

        if (!info[0].IsTypedArray()) {
            throw Napi::TypeError::New(env, "Expected Int32Array for ids");
        }

        Napi::TypedArray arr = info[0].As<Napi::TypedArray>();
        if (arr.TypedArrayType() != napi_int32_array) {
            throw Napi::TypeError::New(env, "Expected Int32Array for ids");
        }

        Napi::Int32Array idsArr = arr.As<Napi::Int32Array>();
        if (idsArr.ElementLength() == 0) {
            throw Napi::RangeError::New(env, "ids array cannot be empty");
        }

        for (size_t i = 0; i < idsArr.ElementLength(); i++) {
            if (idsArr[i] < 0) {
                throw Napi::RangeError::New(env, "ids must be non-negative");
            }
        }

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinaryRemoveIdsWorker* worker =
            new BinaryRemoveIdsWorker(
                Value(),
                wrapper_.get(),
                idsArr.Data(),
                idsArr.ElementLength(),
                deferred);
        worker->Queue();

        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in removeIds()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::GetStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        Napi::Object stats = Napi::Object::New(env);
        stats.Set("ntotal", Napi::Number::New(env, wrapper_->GetTotalVectors()));
        stats.Set("dims", Napi::Number::New(env, wrapper_->GetDimensions()));
        stats.Set("bytesPerVector", Napi::Number::New(env, wrapper_->GetCodeSize()));
        stats.Set("isTrained", Napi::Boolean::New(env, wrapper_->IsTrained()));
        stats.Set("type", Napi::String::New(env, wrapper_->GetIndexType()));
        stats.Set("factory", Napi::String::New(env, wrapper_->GetFactoryDescription()));
        stats.Set("metric", Napi::String::New(env, wrapper_->GetMetricName()));

        return stats;
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in getStats()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::Dispose(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (wrapper_ && !wrapper_->IsDisposed()) {
        wrapper_->Dispose();
    }
    return env.Undefined();
}

Napi::Value FaissBinaryIndexWrapperJS::Save(const Napi::CallbackInfo& info) {
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
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinarySaveWorker* worker = new BinarySaveWorker(Value(), wrapper_.get(), filename, deferred);
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

Napi::Value FaissBinaryIndexWrapperJS::ToBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinaryToBufferWorker* worker = new BinaryToBufferWorker(Value(), wrapper_.get(), deferred);
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

Napi::Value FaissBinaryIndexWrapperJS::MergeFrom(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: otherIndex (FaissBinaryIndex)");
        }

        if (!info[0].IsObject()) {
            throw Napi::TypeError::New(env, "Expected FaissBinaryIndex object");
        }

        Napi::Object otherObj = info[0].As<Napi::Object>();
        FaissBinaryIndexWrapperJS* otherInstance =
            Napi::ObjectWrap<FaissBinaryIndexWrapperJS>::Unwrap(otherObj);

        if (!otherInstance || !otherInstance->wrapper_) {
            throw Napi::Error::New(env, "Invalid index object");
        }

        if (otherInstance->wrapper_->IsDisposed()) {
            throw Napi::Error::New(env, "Cannot merge from disposed index");
        }

        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        BinaryMergeFromWorker* worker =
            new BinaryMergeFromWorker(
                Value(),
                wrapper_.get(),
                otherInstance->Value(),
                otherInstance->wrapper_.get(),
                deferred);
        worker->Queue();

        return deferred.Promise();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in mergeFrom()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::SetNprobe(const Napi::CallbackInfo& info) {
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
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in setNprobe()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::ToGpu(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);

        int device = 0;
        if (info.Length() >= 1) {
            if (!info[0].IsNumber()) {
                throw Napi::TypeError::New(env, "Expected number for device");
            }

            device = info[0].As<Napi::Number>().Int32Value();
            if (device < 0) {
                throw Napi::RangeError::New(env, "device must be non-negative");
            }
        }

        wrapper_->ToGpu(device);
        return env.Undefined();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in toGpu()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::ToCpu(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);
        wrapper_->ToCpu();
        return env.Undefined();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in toCpu()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        ValidateNotDisposed(env);
        wrapper_->Reset();
        return env.Undefined();
    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, std::string("FAISS error: ") + e.what());
    } catch (...) {
        throw Napi::Error::New(env, "Unknown error in reset()");
    }
}

Napi::Value FaissBinaryIndexWrapperJS::Load(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: filename (string)");
        }

        if (!info[0].IsString()) {
            throw Napi::TypeError::New(env, "Expected string for filename");
        }

        std::string filename = info[0].As<Napi::String>().Utf8Value();
        auto loadedWrapper = FaissBinaryIndexWrapper::Load(filename);

        int dims = loadedWrapper->GetDimensions();
        Napi::Object config = Napi::Object::New(env);
        config.Set("dims", Napi::Number::New(env, dims));
        Napi::Object obj = constructor.New({config});
        FaissBinaryIndexWrapperJS* instance = Napi::ObjectWrap<FaissBinaryIndexWrapperJS>::Unwrap(obj);

        instance->wrapper_ = std::move(loadedWrapper);
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

Napi::Value FaissBinaryIndexWrapperJS::FromBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        if (info.Length() < 1) {
            throw Napi::TypeError::New(env, "Expected 1 argument: buffer (Buffer)");
        }

        if (!info[0].IsBuffer()) {
            throw Napi::TypeError::New(env, "Expected Buffer");
        }

        Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
        auto loadedWrapper = FaissBinaryIndexWrapper::FromBuffer(buffer.Data(), buffer.Length());

        int dims = loadedWrapper->GetDimensions();
        Napi::Object config = Napi::Object::New(env);
        config.Set("dims", Napi::Number::New(env, dims));
        Napi::Object obj = constructor.New({config});
        FaissBinaryIndexWrapperJS* instance = Napi::ObjectWrap<FaissBinaryIndexWrapperJS>::Unwrap(obj);

        instance->wrapper_ = std::move(loadedWrapper);
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

Napi::Value FaissBinaryIndexWrapperJS::GpuSupport(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);
    const bool compiled = FaissBinaryIndexWrapper::HasGpuSupport();
    result.Set("compiled", Napi::Boolean::New(env, compiled));
    result.Set("available", Napi::Boolean::New(env, compiled));
    result.Set(
        "reason",
        Napi::String::New(
            env,
            compiled
                ? "CUDA-enabled FAISS GPU support is compiled into this addon for supported binary index types (currently BINARY_FLAT)."
                : "This binary was built without CUDA-enabled FAISS GPU support."));
    return result;
}

Napi::Object InitFaissBinaryIndexWrapper(Napi::Env env, Napi::Object exports) {
    return FaissBinaryIndexWrapperJS::Init(env, exports);
}
