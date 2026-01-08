# @faiss-node/native

High-performance Node.js native bindings for Facebook FAISS - the industry-standard vector similarity search library. Built with ❤️ for production-ready semantic search, RAG applications, and vector databases.

I created this package because I needed a fast, reliable, and well-tested FAISS binding for Node.js. After working with various vector search solutions, I decided to build something that combines the power of FAISS with a clean, modern JavaScript API.

## Current Status: Phase 2 Complete ✅

Right now, the project supports:
- ✅ **IndexFlatL2** - Brute-force exact search
- ✅ **IndexIVFFlat** - Fast approximate search with clustering
- ✅ **IndexHNSW** - State-of-the-art approximate search
- ✅ Async operations (non-blocking)
- ✅ Save/load and serialization
- ✅ Thread-safe concurrent operations
- ✅ Comprehensive test coverage (1000+ tests)

## Installation

### Prerequisites

**macOS:**
```bash
brew install cmake libomp openblas faiss
```

**Linux:**
```bash
sudo apt-get install cmake libopenblas-dev
# Build FAISS from source (no official packages)
```

### Install

```bash
npm install
npm run build
```

## Quick Start

```javascript
const { FaissIndex } = require('./src/js/index');

// Create index
const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });

// Add vectors
const vectors = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0
]);
await index.add(vectors);

// Search
const query = new Float32Array([1, 0, 0, 0]);
const results = await index.search(query, 1);

console.log(results.labels[0]);    // 0
console.log(results.distances[0]);  // ~0
```

## API

### Constructor

```javascript
// FLAT_L2 - Exact search (fastest for small datasets)
const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });

// IVF_FLAT - Approximate search (requires training)
const ivfIndex = new FaissIndex({ 
  type: 'IVF_FLAT', 
  dims: 128,
  nlist: 100,    // Number of clusters
  nprobe: 10     // Clusters to search
});
await ivfIndex.train(trainingVectors);  // Must train first!

// HNSW - State-of-the-art approximate search (no training needed)
const hnswIndex = new FaissIndex({ 
  type: 'HNSW', 
  dims: 128,
  M: 16  // Connections per node
});
```

### Methods

#### `add(vectors: Float32Array): Promise<void>`

Add vectors to the index. Can add a single vector or batch of vectors.

```javascript
// Single vector
await index.add(new Float32Array([1, 0, 0, 0]));

// Batch (4 vectors of 4 dimensions each)
await index.add(new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]));
```

#### `search(query: Float32Array, k: number): Promise<{distances: Float32Array, labels: Int32Array}>`

Search for k nearest neighbors.

```javascript
const query = new Float32Array([1, 0, 0, 0]);
const results = await index.search(query, 5);

// results.distances: Float32Array of distances
// results.labels: Int32Array of vector indices
```

#### `getStats(): Object`

Get index statistics.

```javascript
const stats = index.getStats();
// {
//   ntotal: number,      // Total vectors
//   dims: number,        // Dimensions
//   isTrained: boolean,  // Training status
//   type: string         // Index type
// }
```

#### `dispose(): void`

Explicitly dispose of the index (optional, automatic on GC).

#### `save(filename: string): Promise<void>`

Save index to disk.

```javascript
await index.save('./my-index.faiss');
```

#### `toBuffer(): Promise<Buffer>`

Serialize index to a Node.js Buffer.

```javascript
const buffer = await index.toBuffer();
// Can be stored in database, sent over network, etc.
```

#### `static load(filename: string): Promise<FaissIndex>`

Load index from disk (static method).

```javascript
const index = await FaissIndex.load('./my-index.faiss');
```

#### `static fromBuffer(buffer: Buffer): Promise<FaissIndex>`

Deserialize index from Buffer (static method).

```javascript
const index = await FaissIndex.fromBuffer(buffer);
```

## Development

```bash
# Build native addon
npm run build

# Run all tests
npm test

# Run CI tests (unit + integration only)
npm run test:ci

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Generate documentation
npm run docs

# Serve documentation locally
npm run docs:serve
```

## Features

### Phase 1 ✅ Complete
- ✅ IndexFlatL2 (brute-force exact search)
- ✅ `create()`, `add()`, `search()` operations
- ✅ Float32Array input handling
- ✅ Memory-safe C++ wrapper with RAII
- ✅ macOS support
- ✅ Save/Load to disk
- ✅ Serialization (toBuffer/fromBuffer)

### Phase 2 ✅ Complete
- ✅ IndexIVFFlat (fast approximate search)
- ✅ IndexHNSW (state-of-the-art approximate search)
- ✅ Async operations (non-blocking)
- ✅ Thread-safe concurrent operations
- ✅ Training support for IVF indexes
- ✅ Comprehensive test coverage (1000+ tests)

### Phase 3 ✅ Complete
- ✅ GitHub Actions CI/CD
- ✅ Docker support
- ✅ Automated documentation (Doxygen)
- ✅ Automated npm publishing
- ✅ GitHub releases with prebuilt binaries

## Why I Built This

I created this package (`@faiss-node/native`) because I wanted:
- **Cleaner API**: High-level `FaissIndex` wrapper instead of direct FAISS classes
- **Better error handling**: Comprehensive validation and user-friendly errors
- **Comprehensive testing**: 1000+ tests covering all edge cases
- **Modern JavaScript**: Promise-based async API
- **Thread-safe**: Mutex-protected concurrent operations
- **Multiple index types**: FLAT_L2, IVF_FLAT, HNSW
- **Automated CI/CD**: GitHub Actions for testing and releases
- **Docker support**: Multi-stage builds for testing and production

## CI/CD

I've set up GitHub Actions for automated testing, building, and publishing:

- **CI Workflow**: Tests on macOS and Linux with Node.js 18, 20, 22
- **Docker Workflow**: Builds and tests Docker images
- **Release Workflow**: Builds prebuilt binaries and publishes to npm automatically
- **Documentation Workflow**: Auto-generates and deploys Doxygen docs

See `.github/workflows/` for details.

### npm Publishing

The package is automatically published to npm when you create a version tag (e.g., `v0.1.0`). The workflow:
1. Builds on all platforms (macOS arm64/x64, Linux x64)
2. Runs all tests
3. Publishes to npm as `@faiss-node/native`
4. Creates a GitHub release with prebuilt binaries

**Setup**: Add your npm token as `NPM_TOKEN` secret in GitHub repository settings.

See `.github/NPM_PUBLISHING.md` for detailed setup instructions.

## Docker

```bash
# Build Docker image
docker build -t faiss-node:test --target test .

# Run tests in Docker
docker run --rm faiss-node:test npm run test:ci

# Build production image
docker build -t faiss-node:latest --target production .
```

## Documentation

I've set up automated documentation generation using Doxygen, which gets deployed to GitHub Pages automatically.

### Viewing Documentation

- **Online**: [GitHub Pages](https://<username>.github.io/<repo>/docs/) (after first deployment)
- **Local**: Run `npm run docs:serve` and visit http://localhost:8000

### Generating Locally

```bash
npm run docs        # Generate documentation
npm run docs:serve  # Serve locally at http://localhost:8000
```

### Auto-Deployment

Documentation is automatically deployed to GitHub Pages when:
- Code is pushed to `main` branch
- Source files (`src/**`) or `Doxyfile` are modified
- Manual trigger via GitHub Actions UI

**Setup**: Enable GitHub Pages in repository Settings → Pages → Source: "GitHub Actions"

See `.github/PAGES_SETUP.md` for detailed setup instructions.

**Note**: This package uses a different name (`@faiss-node/native`) to avoid conflicts with the existing `faiss-node` package on npm.

## License

MIT

## Author

**Anupam Maurya**

- GitHub: [@anupammaurya6767](https://github.com/anupammaurya6767)
- Email: anupammaurya6767@gmail.com

## Acknowledgments

- Built on top of [Facebook FAISS](https://github.com/facebookresearch/faiss) - the amazing vector similarity search library
- Inspired by the need for high-performance vector search in Node.js applications
- Thanks to the open-source community for their contributions and feedback

---

Made with ❤️ for the Node.js community
