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
    # Remove perf_tests directory to avoid gflags dependency
    rm -rf perf_tests && \
    cmake -B build \
        -DFAISS_ENABLE_GPU=OFF \
        -DFAISS_ENABLE_PYTHON=OFF \
        -DBUILD_TESTING=OFF \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/usr/local && \
    cmake --build build -j$(nproc) && \
    cmake --install build && \
    cd / && \
    rm -rf /tmp/faiss

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build native module
RUN npm run build

# Test stage
FROM builder AS test
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

# Set library path
ENV LD_LIBRARY_PATH=/usr/local/lib:${LD_LIBRARY_PATH}

CMD ["node"]
