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
# Set library path for runtime (critical for native module to find libgomp, libfaiss, etc.)
# Use explicit path without variable expansion to avoid Docker warning
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/lib/x86_64-linux-gnu
# Verify libraries are accessible
RUN ldconfig -p | grep -E "(libgomp|libfaiss|libopenblas)" || echo "Warning: Some libraries not in ldconfig cache"
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
