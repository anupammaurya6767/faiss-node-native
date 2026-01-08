cmake_minimum_required(VERSION 3.15)
project(faiss_node)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find FAISS
find_path(FAISS_INCLUDE_DIR 
    NAMES faiss/IndexFlat.h
    PATHS 
        /opt/homebrew/include
        /usr/local/include
        ${CMAKE_SOURCE_DIR}/third_party/faiss/include
)

find_library(FAISS_LIBRARY
    NAMES faiss
    PATHS
        /opt/homebrew/lib
        /usr/local/lib
        ${CMAKE_SOURCE_DIR}/third_party/faiss/lib
)

# Find OpenBLAS
find_library(OPENBLAS_LIBRARY
    NAMES openblas
    PATHS
        /opt/homebrew/lib
        /usr/local/lib
)

if(NOT FAISS_INCLUDE_DIR)
    message(FATAL_ERROR "FAISS include directory not found. Install with: brew install faiss")
endif()

if(NOT FAISS_LIBRARY)
    message(FATAL_ERROR "FAISS library not found. Install with: brew install faiss")
endif()

# Node.js addon
add_library(${PROJECT_NAME} SHARED
    src/cpp/faiss_index.cpp
    src/cpp/napi_bindings.cpp
)

target_include_directories(${PROJECT_NAME} PRIVATE
    ${FAISS_INCLUDE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/node_modules/node-addon-api
)

target_link_libraries(${PROJECT_NAME}
    ${FAISS_LIBRARY}
    ${OPENBLAS_LIBRARY}
)

target_compile_definitions(${PROJECT_NAME} PRIVATE
    NAPI_VERSION=8
)

set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    POSITION_INDEPENDENT_CODE ON
)
