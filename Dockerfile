# Multi-stage Dockerfile for building FAISS-Node
FROM node:18-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    libopenblas-dev \
    libomp-dev \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Build FAISS from source
RUN git clone https://github.com/facebookresearch/faiss.git /tmp/faiss && \
    cd /tmp/faiss && \
    cmake -B build \
        -DFAISS_ENABLE_GPU=OFF \
        -DFAISS_ENABLE_PYTHON=OFF \
        -DBUILD_TESTING=OFF \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/usr/local \
        -DCMAKE_CXX_FLAGS="-fopenmp" \
        -DCMAKE_C_FLAGS="-fopenmp" && \
          cmake --build build -j$(nproc) && \
          cmake --install build && \
          # Update library cache so runtime can find FAISS libraries
          ldconfig && \
          # Verify FAISS headers are installed (critical check)
          test -f /usr/local/include/faiss/impl/FaissAssert.h || (echo "ERROR: FAISS headers not found" && ls -la /usr/local/include/faiss/ && exit 1) && \
          echo "✅ FAISS headers verified" && \
          cd / && \
          rm -rf /tmp/faiss

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Verify FAISS headers before building native module
RUN test -f /usr/local/include/faiss/impl/FaissAssert.h || (echo "ERROR: FAISS headers missing before build" && ls -la /usr/local/include/faiss/ && exit 1) && \
    echo "✅ FAISS headers verified before native module build"

# Build native module
RUN npm run build

# Test stage
FROM builder AS test
# Test files should already be copied with COPY . . above
# But .dockerignore was excluding them, so we explicitly copy them
COPY test ./test
COPY jest.config.js jest.ci.config.js ./
# Update library cache after FAISS installation (CRITICAL for runtime)
RUN ldconfig
# Set library path for runtime (critical for native module to find libgomp, libfaiss, etc.)
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/lib/x86_64-linux-gnu
# Verify libraries are accessible and in cache
RUN echo "=== Checking library cache ===" && \
    ldconfig -p | grep -E "(libgomp|libfaiss|libopenblas)" && echo "✅ Libraries found in cache" || (echo "❌ Libraries not in cache" && ldconfig -p | head -20)
# Verify native module exists and can find its dependencies
RUN echo "=== Checking native module dependencies ===" && \
    test -f build/Release/faiss_node.node && echo "✅ Native module exists" || (echo "❌ Native module missing" && ls -la build/Release/ 2>&1) && \
    ldd build/Release/faiss_node.node 2>&1 | head -30 && \
    ldd build/Release/faiss_node.node | grep -E "(libgomp|libfaiss|libopenblas)" && echo "✅ All dependencies found" || echo "⚠️ Some dependencies may be missing"
# Test native module can be loaded by Node.js (critical check before Jest)
RUN echo "=== Testing native module load ===" && \
    node -e "try { const mod = require('./build/Release/faiss_node.node'); console.log('✅ Native module loaded successfully'); } catch(e) { console.error('❌ Failed to load:', e.message); process.exit(1); }" || (echo "❌ Native module load test failed" && exit 1)
# Run tests with single worker to avoid conflicts
RUN npm run test:ci

# Production stage
FROM node:18-bookworm-slim AS production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libopenblas0 \
    libomp5 \
    && rm -rf /var/lib/apt/lists/*

# Copy FAISS libraries (if needed)
COPY --from=builder /usr/local/lib/libfaiss* /usr/local/lib/
COPY --from=builder /usr/local/include/faiss /usr/local/include/faiss

# Copy application files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/build/Release/faiss_node.node ./build/Release/

# Install production dependencies only
RUN npm ci --production --ignore-scripts

# Set library path (use explicit path to avoid undefined variable warning)
ENV LD_LIBRARY_PATH=/usr/local/lib

CMD ["node"]
