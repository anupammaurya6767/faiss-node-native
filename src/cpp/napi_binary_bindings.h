#ifndef FAISS_NODE_NAPI_BINARY_BINDINGS_H
#define FAISS_NODE_NAPI_BINARY_BINDINGS_H

#include <napi.h>

Napi::Object InitFaissBinaryIndexWrapper(Napi::Env env, Napi::Object exports);

#endif
