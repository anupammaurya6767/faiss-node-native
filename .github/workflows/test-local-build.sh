#!/bin/bash
# Local test script to verify FAISS build works
# This simulates what GitHub Actions does

set -e

echo "🧪 Testing FAISS build locally..."

# Install dependencies (if not already installed)
if ! command -v cmake &> /dev/null; then
    echo "Installing cmake..."
    brew install cmake
fi

if ! brew list libomp &> /dev/null; then
    echo "Installing libomp..."
    brew install libomp
fi

if ! brew list openblas &> /dev/null; then
    echo "Installing openblas..."
    brew install openblas
fi

# Build FAISS from source
echo "Cloning FAISS..."
cd /tmp
rm -rf faiss-test
git clone https://github.com/facebookresearch/faiss.git faiss-test
cd faiss-test

echo "Configuring FAISS with OpenMP..."
# Set OpenMP paths for CMake (both C and CXX)
export OpenMP_CXX_FLAGS="-Xpreprocessor -fopenmp -lomp"
export OpenMP_CXX_LIB_NAMES="omp"
export OpenMP_omp_LIBRARY=$(brew --prefix libomp)/lib/libomp.dylib
export OpenMP_C_FLAGS="-Xpreprocessor -fopenmp -lomp"
export OpenMP_C_LIB_NAMES="omp"
export OpenMP_gomp_LIBRARY=$(brew --prefix libomp)/lib/libomp.dylib

cmake -B build \
  -DFAISS_ENABLE_GPU=OFF \
  -DFAISS_ENABLE_PYTHON=OFF \
  -DBUILD_TESTING=OFF \
  -DOpenMP_CXX_FLAGS="-Xpreprocessor -fopenmp -lomp" \
  -DOpenMP_CXX_LIB_NAMES="omp" \
  -DOpenMP_omp_LIBRARY=$(brew --prefix libomp)/lib/libomp.dylib \
  -DOpenMP_C_FLAGS="-Xpreprocessor -fopenmp -lomp" \
  -DOpenMP_C_LIB_NAMES="omp" \
  -DOpenMP_gomp_LIBRARY=$(brew --prefix libomp)/lib/libomp.dylib

echo "Building FAISS..."
cmake --build build -j$(sysctl -n hw.ncpu)

echo "Installing FAISS..."
sudo cmake --install build

echo "✅ FAISS build test passed!"
