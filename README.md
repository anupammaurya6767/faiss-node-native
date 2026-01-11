# @faiss-node/native

[![npm version](https://img.shields.io/npm/v/@faiss-node/native.svg)](https://www.npmjs.com/package/@faiss-node/native)
[![Node.js Version](https://img.shields.io/node/v/@faiss-node/native)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://anupammaurya6767.github.io/faiss-node-native/)

High-performance Node.js native bindings for [Facebook FAISS](https://github.com/facebookresearch/faiss) - the industry-standard vector similarity search library. Built for semantic search, RAG applications, and vector databases.

## Features

- 🚀 **Async Operations** - Non-blocking Promise-based API that never blocks the event loop
- 🔒 **Thread-Safe** - Mutex-protected concurrent operations for production workloads
- 📦 **Multiple Index Types** - FLAT_L2, FLAT_IP (cosine similarity), IVF_FLAT, and HNSW with optimized defaults
- 💾 **Persistence** - Save/load indexes to disk or serialize to buffers
- ⚡ **High Performance** - Direct C++ bindings with zero-copy data transfer
- 📚 **TypeScript Support** - Full type definitions included

## Installation

### Quick Install

```bash
npm install @faiss-node/native
```

### Prerequisites

**macOS:**
```bash
brew install cmake libomp openblas faiss
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y cmake libopenblas-dev libomp-dev
# Build FAISS from source (see below)
```

**Windows:**
Windows native builds require FAISS to be installed, which can be complex. We recommend using one of these approaches:

1. **WSL2 (Recommended)**: Use Windows Subsystem for Linux 2 - see [WINDOWS.md](WINDOWS.md#option-1-wsl2-setup-recommended)
   - After installing WSL2, follow the Linux instructions above
   - Works seamlessly from Windows Terminal and VS Code

2. **VS Code Dev Container**: Use the included `.devcontainer` configuration - see [WINDOWS.md](WINDOWS.md#option-2-vs-code-dev-container)
   - Best for teams and consistent development environments
   - No manual setup required - just "Reopen in Container"

3. **Docker Desktop**: Run the project in a container - see [WINDOWS.md](WINDOWS.md#option-3-docker-desktop-manual)
   - Full control over the container environment
   - Works with any IDE or editor

**Note for npm users:** The npm package (`@faiss-node/native`) works on Windows when installed in WSL2, Dev Containers, or Docker. For Windows native development, see [WINDOWS.md](WINDOWS.md) for detailed setup instructions.

**Building FAISS from Source (Linux/WSL2):**
```bash
git clone https://github.com/facebookresearch/faiss.git
cd faiss
cmake -B build -DFAISS_ENABLE_GPU=OFF -DFAISS_ENABLE_PYTHON=OFF
cmake --build build -j$(nproc)
sudo cmake --install build
```

### Build Native Module

After installing prerequisites:

```bash
npm run build
```

## Quick Start

```javascript
const { FaissIndex } = require('@faiss-node/native');

// Create an index
const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });

// Add vectors (single or batch)
const vectors = new Float32Array([
  1.0, 0.0, 0.0, 0.0,  // Vector 1
  0.0, 1.0, 0.0, 0.0,  // Vector 2
  0.0, 0.0, 1.0, 0.0   // Vector 3
]);
await index.add(vectors);

// Search for nearest neighbors
const query = new Float32Array([1.0, 0.0, 0.0, 0.0]);
const results = await index.search(query, 2);

console.log('Labels:', results.labels);     // Int32Array: [0, 1]
console.log('Distances:', results.distances); // Float32Array: [0, 2]

// Cleanup
index.dispose();
```

## API Reference

### Constructor

Create a new FAISS index with the specified configuration.

```javascript
const index = new FaissIndex(config);
```

**Parameters:**
- `config.type` (string, required): Index type - `'FLAT_L2'`, `'IVF_FLAT'`, or `'HNSW'`
- `config.dims` (number, required): Vector dimensions (must be positive integer)
- `config.nlist` (number, optional): Number of clusters for IVF_FLAT (default: 100)
- `config.nprobe` (number, optional): Clusters to search for IVF_FLAT (default: 10)
- `config.M` (number, optional): Connections per node for HNSW (default: 16)
- `config.efConstruction` (number, optional): HNSW construction parameter (default: 200)
- `config.efSearch` (number, optional): HNSW search parameter (default: 50)

**Examples:**

```javascript
// FLAT_L2 - Exact search (best for small datasets < 10k vectors)
const flatIndex = new FaissIndex({ type: 'FLAT_L2', dims: 128 });

// FLAT_IP - Inner Product (for cosine similarity with normalized vectors)
const flatIPIndex = new FaissIndex({ type: 'FLAT_IP', dims: 1536 });
// Note: Vectors must be L2-normalized for cosine similarity
// For normalized vectors: cosine_similarity(a, b) = dot_product(a, b) = inner_product(a, b)

// IVF_FLAT - Fast approximate search (best for 10k - 1M vectors)
const ivfIndex = new FaissIndex({ 
  type: 'IVF_FLAT', 
  dims: 768,
  nlist: 100,    // Number of clusters
  nprobe: 10     // Clusters to search (higher = more accurate, slower)
});
await ivfIndex.train(trainingVectors);  // Must train before adding vectors!

// HNSW - State-of-the-art approximate search (best for large datasets)
const hnswIndex = new FaissIndex({ 
  type: 'HNSW', 
  dims: 1536,
  M: 16,              // Connections per node (higher = more accurate, slower)
  efConstruction: 200, // Construction parameter
  efSearch: 50        // Search parameter (higher = more accurate, slower)
});
```

### Methods

#### `add(vectors: Float32Array): Promise<void>`

Add vectors to the index. Can add a single vector or a batch of vectors.

```javascript
// Single vector
await index.add(new Float32Array([1, 2, 3, 4]));

// Batch of vectors (4 vectors of 4 dimensions each)
await index.add(new Float32Array([
  1, 0, 0, 0,  // Vector 1
  0, 1, 0, 0,  // Vector 2
  0, 0, 1, 0,  // Vector 3
  0, 0, 0, 1   // Vector 4
]));
```

**Note:** For IVF_FLAT indexes, you must call `train()` before adding vectors.

#### `search(query: Float32Array, k: number): Promise<SearchResults>`

Search for k nearest neighbors.

```javascript
const query = new Float32Array([1, 0, 0, 0]);
const results = await index.search(query, 5);

// results.distances: Float32Array of L2 distances
// results.labels: Int32Array of vector indices
```

**Returns:**
- `distances` (Float32Array): L2 distances to nearest neighbors
- `labels` (Int32Array): Indices of nearest neighbors

#### `searchBatch(queries: Float32Array, k: number): Promise<SearchResults>`

Batch search for k nearest neighbors (multiple queries).

```javascript
// Multiple queries
const queries = new Float32Array([
  1, 0, 0, 0,  // Query 1
  0, 1, 0, 0   // Query 2
]);
const results = await index.searchBatch(queries, 5);

// results.distances: Float32Array of shape [nq * k]
// results.labels: Int32Array of shape [nq * k]
// results.nq: number of queries
// results.k: number of neighbors per query
```

#### `rangeSearch(query: Float32Array, radius: number): Promise<RangeSearchResults>`

Find all vectors within a distance threshold (range search). Useful for filtering by distance or clustering.

```javascript
const query = new Float32Array([1, 0, 0, 0]);
const radius = 2.0;  // Maximum distance threshold
const results = await index.rangeSearch(query, radius);

// results.distances: Float32Array of distances
// results.labels: Int32Array of vector indices
// results.nq: number of queries (always 1 for single query)
// results.lims: Uint32Array [0, n] where n is total number of results
// Results are sorted by distance (closest first)

// Example: Extract results for a single query
const nResults = results.lims[1];
for (let i = 0; i < nResults; i++) {
  const label = results.labels[i];
  const distance = results.distances[i];
  console.log(`Vector ${label} at distance ${distance}`);
}
```

**Note:** Range search returns a variable number of results (all vectors within radius), unlike `search()` which always returns exactly `k` results.

Perform batch search for multiple queries efficiently.

```javascript
// 3 queries of 4 dimensions each
const queries = new Float32Array([
  1, 0, 0, 0,  // Query 1
  0, 1, 0, 0,  // Query 2
  0, 0, 1, 0   // Query 3
]);
const results = await index.searchBatch(queries, 5);

// results.distances: Float32Array of shape [3 * 5]
// results.labels: Int32Array of shape [3 * 5]
```

#### `train(vectors: Float32Array): Promise<void>`

Train an IVF_FLAT index. Required before adding vectors.

```javascript
// Training vectors (typically 10k-100k vectors)
const trainingVectors = new Float32Array(/* ... */);
await ivfIndex.train(trainingVectors);
await ivfIndex.add(dataVectors);  // Now you can add vectors
```

#### `setNprobe(nprobe: number): Promise<void>`

Set the number of clusters to search for IVF_FLAT indexes.

```javascript
await ivfIndex.setNprobe(20);  // Search more clusters (more accurate, slower)
```

#### `getStats(): IndexStats`

Get index statistics.

```javascript
const stats = index.getStats();
// {
//   ntotal: number,      // Total vectors in index
//   dims: number,        // Vector dimensions
//   isTrained: boolean,  // Whether index is trained (IVF only)
//   type: string         // Index type
// }
```

#### `save(filename: string): Promise<void>`

Save index to disk.

```javascript
await index.save('./my-index.faiss');
```

#### `static load(filename: string): Promise<FaissIndex>`

Load index from disk.

```javascript
const index = await FaissIndex.load('./my-index.faiss');
```

#### `toBuffer(): Promise<Buffer>`

Serialize index to a Node.js Buffer (useful for databases, network transfer, etc.).

```javascript
const buffer = await index.toBuffer();
// Store in database, send over network, etc.
```

#### `static fromBuffer(buffer: Buffer): Promise<FaissIndex>`

Deserialize index from Buffer.

```javascript
const index = await FaissIndex.fromBuffer(buffer);
```

#### `mergeFrom(otherIndex: FaissIndex): Promise<void>`

Merge vectors from another index into this index.

```javascript
const index1 = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
const index2 = new FaissIndex({ type: 'FLAT_L2', dims: 128 });

await index1.add(vectors1);
await index2.add(vectors2);

await index1.mergeFrom(index2);  // index1 now contains vectors from both
// Note: index2 is now empty (FAISS behavior)
```

#### `dispose(): void`

Explicitly dispose of the index and free resources. Optional - automatic on garbage collection.

```javascript
index.dispose();
// Index is now unusable - all operations will throw errors
```

## Choosing the Right Index Type

### FLAT_L2 (IndexFlatL2)
- **Best for:** Small datasets (< 10k vectors), exact search required
- **Speed:** O(n) per query - linear scan
- **Accuracy:** 100% recall (exact results)
- **Memory:** 4 × dims × n bytes
- **Use case:** Prototyping, small production datasets, when accuracy is critical

### IVF_FLAT (IndexIVFFlat)
- **Best for:** Medium datasets (10k - 1M vectors), can tolerate ~90-95% recall
- **Speed:** O(nprobe × n/nlist) per query - much faster than FLAT
- **Accuracy:** ~90-95% recall (configurable via nprobe)
- **Memory:** Similar to FLAT + cluster overhead
- **Requires:** Training on sample data before use
- **Use case:** Production systems with medium-sized datasets

### HNSW (IndexHNSW)
- **Best for:** Large datasets (> 100k vectors), best speed/accuracy tradeoff
- **Speed:** O(log n) per query - logarithmic search
- **Accuracy:** ~95-99% recall (configurable via efSearch)
- **Memory:** ~1.5-2× more than FLAT
- **No training required**
- **Use case:** Large-scale production systems, best overall performance

## Examples

### Basic Semantic Search

```javascript
const { FaissIndex } = require('@faiss-node/native');

// Create index for 768-dimensional embeddings (e.g., OpenAI)
const index = new FaissIndex({ type: 'HNSW', dims: 768 });

// Add document embeddings
const documents = [
  { id: 0, text: "JavaScript is a programming language" },
  { id: 1, text: "Python is great for data science" },
  { id: 2, text: "Node.js runs JavaScript on the server" }
];

const embeddings = new Float32Array(/* ... your embeddings ... */);
await index.add(embeddings);

// Search for similar documents
const queryEmbedding = new Float32Array(/* ... query embedding ... */);
const results = await index.search(queryEmbedding, 3);

console.log('Most similar documents:', results.labels);
```

### RAG Pipeline

```javascript
const { FaissIndex } = require('@faiss-node/native');

class RAGSystem {
  constructor() {
    this.index = new FaissIndex({ type: 'HNSW', dims: 1536 });
    this.documents = [];
  }

  async addDocuments(docs, embeddings) {
    this.documents.push(...docs);
    await this.index.add(embeddings);
  }

  async search(queryEmbedding, k = 5) {
    const results = await this.index.search(queryEmbedding, k);
    return results.labels.map(idx => this.documents[idx]);
  }

  async save(path) {
    await this.index.save(path);
    // Also save documents mapping
  }
}
```

### Persistence

```javascript
const { FaissIndex } = require('@faiss-node/native');

// Save to disk
const index = new FaissIndex({ type: 'HNSW', dims: 128 });
await index.add(vectors);
await index.save('./index.faiss');

// Load from disk
const loadedIndex = await FaissIndex.load('./index.faiss');

// Or serialize to buffer (for databases)
const buffer = await index.toBuffer();
// Store in MongoDB, Redis, etc.
const restoredIndex = await FaissIndex.fromBuffer(buffer);
```

## Migration Guide

### From Python FAISS

If you're familiar with Python FAISS, migrating to `@faiss-node/native` is straightforward. Here are common patterns translated from Python to Node.js:

#### Basic Index Creation and Search

**Python FAISS:**
```python
import faiss
import numpy as np

# Create index
d = 128  # dimensions
index = faiss.IndexFlatL2(d)

# Add vectors (numpy array)
vectors = np.random.random((1000, d)).astype('float32')
index.add(vectors)

# Search
query = np.random.random((1, d)).astype('float32')
k = 10
distances, labels = index.search(query, k)

print(distances)  # [[0.1, 0.2, ...]]
print(labels)     # [[0, 1, ...]]
```

**Node.js (@faiss-node/native):**
```javascript
const { FaissIndex } = require('@faiss-node/native');

// Create index
const d = 128;  // dimensions
const index = new FaissIndex({ type: 'FLAT_L2', dims: d });

// Add vectors (Float32Array)
const vectors = new Float32Array(1000 * d);
for (let i = 0; i < vectors.length; i++) {
  vectors[i] = Math.random();
}
await index.add(vectors);

// Search
const query = new Float32Array(d);
for (let i = 0; i < d; i++) {
  query[i] = Math.random();
}
const k = 10;
const results = await index.search(query, k);

console.log(results.distances);  // Float32Array: [0.1, 0.2, ...]
console.log(results.labels);     // Int32Array: [0, 1, ...]
```

#### IVF_FLAT Index (with Training)

**Python FAISS:**
```python
import faiss

d = 768
nlist = 100
index = faiss.IndexIVFFlat(faiss.IndexFlatL2(d), d, nlist)

# Train on sample data
training_vectors = np.random.random((10000, d)).astype('float32')
index.train(training_vectors)

# Add vectors
vectors = np.random.random((100000, d)).astype('float32')
index.add(vectors)

# Set nprobe for search
index.nprobe = 10
distances, labels = index.search(query, k)
```

**Node.js (@faiss-node/native):**
```javascript
const { FaissIndex } = require('@faiss-node/native');

const d = 768;
const nlist = 100;
const index = new FaissIndex({ 
  type: 'IVF_FLAT', 
  dims: d, 
  nlist: nlist 
});

// Train on sample data
const trainingVectors = new Float32Array(10000 * d);
for (let i = 0; i < trainingVectors.length; i++) {
  trainingVectors[i] = Math.random();
}
await index.train(trainingVectors);

// Add vectors
const vectors = new Float32Array(100000 * d);
for (let i = 0; i < vectors.length; i++) {
  vectors[i] = Math.random();
}
await index.add(vectors);

// Set nprobe for search
index.setNprobe(10);
const results = await index.search(query, k);
```

#### HNSW Index

**Python FAISS:**
```python
import faiss

d = 1536
M = 16
index = faiss.IndexHNSWFlat(d, M)

# Add vectors (no training needed)
vectors = np.random.random((1000000, d)).astype('float32')
index.add(vectors)

# Search with ef parameter
index.hnsw.efSearch = 50
distances, labels = index.search(query, k)
```

**Node.js (@faiss-node/native):**
```javascript
const { FaissIndex } = require('@faiss-node/native');

const d = 1536;
const index = new FaissIndex({ 
  type: 'HNSW', 
  dims: d,
  M: 16,              // Connections per node
  efSearch: 50       // Search parameter (equivalent to index.hnsw.efSearch)
});

// Add vectors (no training needed)
const vectors = new Float32Array(1000000 * d);
for (let i = 0; i < vectors.length; i++) {
  vectors[i] = Math.random();
}
await index.add(vectors);

// Search (efSearch already set in constructor)
const results = await index.search(query, k);
```

#### Save and Load Index

**Python FAISS:**
```python
# Save to disk
faiss.write_index(index, "index.faiss")

# Load from disk
loaded_index = faiss.read_index("index.faiss")
```

**Node.js (@faiss-node/native):**
```javascript
// Save to disk (async)
await index.save("index.faiss");

// Load from disk (static method, async)
const loadedIndex = await FaissIndex.load("index.faiss");
```

#### Batch Search (Multiple Queries)

**Python FAISS:**
```python
# Multiple queries (nq queries)
queries = np.random.random((100, d)).astype('float32')
distances, labels = index.search(queries, k)
# distances shape: (100, k)
# labels shape: (100, k)
```

**Node.js (@faiss-node/native):**
```javascript
// Multiple queries (nq queries)
const queries = new Float32Array(100 * d);
for (let i = 0; i < queries.length; i++) {
  queries[i] = Math.random();
}
const results = await index.searchBatch(queries, k);
// results.distances: Float32Array of shape [100 * k]
// results.labels: Int32Array of shape [100 * k]
// results.nq: 100
// results.k: k
```

#### Key Differences

| Feature | Python FAISS | Node.js (@faiss-node/native) |
|---------|-------------|------------------------------|
| **Index Creation** | `faiss.IndexFlatL2(d)` | `new FaissIndex({ type: 'FLAT_L2', dims: d })` |
| **Add Vectors** | `index.add(vectors)` (synchronous) | `await index.add(vectors)` (async) |
| **Search** | `index.search(queries, k)` (synchronous) | `await index.search(query, k)` (async) |
| **Batch Search** | `index.search(queries, k)` (same method) | `await index.searchBatch(queries, k)` (separate method) |
| **Training** | `index.train(vectors)` (synchronous) | `await index.train(vectors)` (async) |
| **Save/Load** | `faiss.write_index()` / `faiss.read_index()` (synchronous) | `await index.save()` / `await FaissIndex.load()` (async) |
| **nprobe (IVF)** | `index.nprobe = 10` | `index.setNprobe(10)` |
| **efSearch (HNSW)** | `index.hnsw.efSearch = 50` | Set in constructor or use `efSearch` config |
| **Vector Format** | `numpy.ndarray` (float32) | `Float32Array` |
| **Results Format** | Tuple `(distances, labels)` as numpy arrays | Object `{ distances: Float32Array, labels: Int32Array }` |

#### Common Patterns

**Pattern 1: Converting numpy arrays to Float32Array**

If you have Python code that generates embeddings and want to use them in Node.js:

```python
# Python: Save embeddings
import numpy as np
embeddings = model.encode(texts)  # numpy array, shape (n, d)
np.save('embeddings.npy', embeddings)
```

```javascript
// Node.js: Load embeddings
const fs = require('fs');
// Assuming you converted .npy to binary format
const embeddingsBuffer = fs.readFileSync('embeddings.bin');
const embeddings = new Float32Array(embeddingsBuffer.buffer);
await index.add(embeddings);
```

**Pattern 2: Chunked Add Operations**

**Python FAISS:**
```python
batch_size = 10000
for i in range(0, len(vectors), batch_size):
    batch = vectors[i:i+batch_size]
    index.add(batch)
```

**Node.js (@faiss-node/native):**
```javascript
const batchSize = 10000;
for (let i = 0; i < vectors.length; i += batchSize * dims) {
  const batch = vectors.slice(i, i + batchSize * dims);
  await index.add(batch);
}
```

**Pattern 3: Memory Management**

**Python FAISS:**
```python
# Index is automatically garbage collected
# But you can delete explicitly:
del index
```

**Node.js (@faiss-node/native):**
```javascript
// Explicitly dispose to free native memory
index.dispose();

// Or let garbage collector handle it
// (but explicit dispose is recommended for large indexes)
```

#### Migration Checklist

- [ ] Replace `import faiss` with `require('@faiss-node/native')`
- [ ] Convert `numpy.ndarray` to `Float32Array`
- [ ] Add `await` to all async operations (add, search, train, save, load)
- [ ] Replace `index.search(queries, k)` for batch with `index.searchBatch(queries, k)`
- [ ] Use constructor config object instead of direct index instantiation
- [ ] Replace `index.nprobe = X` with `index.setNprobe(X)` for IVF
- [ ] Set `efSearch` in constructor config for HNSW instead of `index.hnsw.efSearch`
- [ ] Handle results as `{ distances, labels }` object instead of tuple
- [ ] Add `index.dispose()` when done with large indexes (optional but recommended)

## Performance Tips

1. **Use HNSW for large datasets** - Best overall performance
2. **Batch operations** - Use `searchBatch()` for multiple queries
3. **Train IVF properly** - Use 10k-100k training vectors
4. **Tune parameters** - Increase `nprobe` (IVF) or `efSearch` (HNSW) for accuracy
5. **Reuse indexes** - Save/load instead of recreating

For detailed benchmarks and performance comparisons, see `examples/benchmark.js`.

## Thread Safety

All operations are thread-safe and can be called concurrently:

```javascript
// Safe to call from multiple async operations
await Promise.all([
  index.add(vectors1),
  index.add(vectors2),
  index.search(query1),
  index.search(query2)
]);
```

The implementation uses mutex locks to ensure FAISS operations are serialized safely.

## Error Handling

All methods throw JavaScript errors (not C++ exceptions):

```javascript
try {
  await index.add(vectors);
} catch (error) {
  if (error.message.includes('disposed')) {
    console.error('Index was disposed');
  } else if (error.message.includes('dimensions')) {
    console.error('Vector dimensions mismatch');
  }
}
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { FaissIndex, FaissIndexConfig, SearchResults } from '@faiss-node/native';

const config: FaissIndexConfig = {
  type: 'HNSW',
  dims: 768
};

const index = new FaissIndex(config);
const results: SearchResults = await index.search(query, 10);
```

## Updating

To update to the latest version:

```bash
npm update @faiss-node/native
```

Or install a specific version:

```bash
npm install @faiss-node/native@0.1.2
```

## Development

### Building from Source

**macOS/Linux:**
```bash
# Clone repository
git clone https://github.com/anupammaurya6767/faiss-node-native.git
cd faiss-node-native

# Install dependencies
npm install

# Build native module
npm run build

# Run tests
npm test
```

**Windows:**
Windows users should use WSL2 or VS Code Dev Container. See [WINDOWS.md](WINDOWS.md) for detailed setup instructions.

**VS Code Dev Container (All Platforms):**
```bash
# Open in VS Code and select "Reopen in Container"
# Or from command palette: "Dev Containers: Reopen in Container"
# First build will take 5-10 minutes (compiles FAISS)
```

### Running Tests

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:ci       # CI tests (faster, no manual tests)
```

### Generating Documentation

```bash
npm run docs          # Generate Doxygen documentation
npm run docs:serve    # Serve docs locally at http://localhost:8000
```

## Documentation

- **API Documentation**: [GitHub Pages](https://anupammaurya6767.github.io/faiss-node-native/)
- **Examples**: See `examples/` directory
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Troubleshooting

### Build Errors

**macOS: "library not found"**
```bash
# Ensure FAISS is installed
brew install faiss

# Check installation
ls /usr/local/lib/libfaiss*
```

**Linux: "faiss/Index.h: No such file or directory"**
```bash
# Build and install FAISS from source (see Prerequisites)
# Ensure CMAKE_INSTALL_PREFIX=/usr/local
# Run ldconfig after installation
sudo ldconfig
```

**Windows: Build errors or missing dependencies**
- Use WSL2 instead of native Windows - see [WINDOWS.md](WINDOWS.md#option-1-wsl2-setup-recommended)
- Or use VS Code Dev Container - see [WINDOWS.md](WINDOWS.md#option-2-vs-code-dev-container)
- Ensure Docker Desktop uses WSL2 backend if using containers

### Runtime Errors

**"Index has been disposed"**
- You called `dispose()` or the index was garbage collected
- Create a new index or don't dispose until done

**"Vector dimensions don't match"**
- Check that your vectors are the correct size
- For batch operations: `vectors.length % dims === 0`

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Author

**Anupam Maurya**

- GitHub: [@anupammaurya6767](https://github.com/anupammaurya6767)
- Email: anupammaurya6767@gmail.com

## Acknowledgments

- Built on [Facebook FAISS](https://github.com/facebookresearch/faiss) - the amazing vector similarity search library
- Inspired by the need for high-performance vector search in Node.js
- Thanks to the open-source community for feedback and contributions

---

Made with ❤️ for the Node.js community

