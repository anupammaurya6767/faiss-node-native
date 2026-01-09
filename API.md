# API Reference

Complete API documentation for `@faiss-node/native`.

## Table of Contents

- [FaissIndex Class](#faissindex-class)
- [Index Types](#index-types)
- [Methods](#methods)
- [Types](#types)
- [Examples](#examples)

## FaissIndex Class

The main class for creating and managing FAISS indexes.

### Constructor

```typescript
new FaissIndex(config: FaissIndexConfig): FaissIndex
```

Creates a new FAISS index with the specified configuration.

**Parameters:**

- `config.type` (string, required): Index type
  - `'FLAT_L2'` - Exact search, brute force
  - `'IVF_FLAT'` - Fast approximate search with clustering
  - `'HNSW'` - State-of-the-art approximate search
- `config.dims` (number, required): Vector dimensions (must be positive integer)
- `config.nlist` (number, optional): Number of clusters for IVF_FLAT (default: 100)
- `config.nprobe` (number, optional): Clusters to search for IVF_FLAT (default: 10)
- `config.M` (number, optional): Connections per node for HNSW (default: 16)
- `config.efConstruction` (number, optional): HNSW construction parameter (default: 200)
- `config.efSearch` (number, optional): HNSW search parameter (default: 50)

**Example:**

```javascript
const index = new FaissIndex({ type: 'HNSW', dims: 768 });
```

## Index Types

### FLAT_L2 (IndexFlatL2)

Exact search using brute-force L2 distance calculation.

**Best for:**
- Small datasets (< 10k vectors)
- When 100% recall is required
- Prototyping and testing

**Performance:**
- Search: O(n) - linear scan
- Memory: 4 × dims × n bytes
- Accuracy: 100% recall

**Example:**

```javascript
const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
```

### IVF_FLAT (IndexIVFFlat)

Fast approximate search using inverted file index with flat vectors.

**Best for:**
- Medium datasets (10k - 1M vectors)
- When 90-95% recall is acceptable
- Production systems with medium-sized datasets

**Performance:**
- Search: O(nprobe × n/nlist) - much faster than FLAT
- Memory: Similar to FLAT + cluster overhead
- Accuracy: ~90-95% recall (configurable)

**Requirements:**
- Must call `train()` before adding vectors
- Training typically requires 10k-100k sample vectors

**Example:**

```javascript
const index = new FaissIndex({ 
  type: 'IVF_FLAT', 
  dims: 768,
  nlist: 100,    // Number of clusters
  nprobe: 10     // Clusters to search
});

// Must train before adding vectors
await index.train(trainingVectors);
await index.add(dataVectors);
```

### HNSW (IndexHNSW)

Hierarchical Navigable Small World graph - state-of-the-art approximate search.

**Best for:**
- Large datasets (> 100k vectors)
- Best speed/accuracy tradeoff
- Production systems requiring high performance

**Performance:**
- Search: O(log n) - logarithmic search
- Memory: ~1.5-2× more than FLAT
- Accuracy: ~95-99% recall (configurable)

**No training required** - ready to use immediately.

**Example:**

```javascript
const index = new FaissIndex({ 
  type: 'HNSW', 
  dims: 1536,
  M: 16,              // Connections per node
  efConstruction: 200, // Construction parameter
  efSearch: 50        // Search parameter
});
```

## Methods

### add(vectors: Float32Array): Promise<void>

Add vectors to the index. Can add a single vector or a batch of vectors.

**Parameters:**
- `vectors` (Float32Array): Vector data. For batch operations, vectors must be concatenated: `[v1[0..d-1], v2[0..d-1], ...]`

**Example:**

```javascript
// Single vector
await index.add(new Float32Array([1, 2, 3, 4]));

// Batch of 4 vectors (each 4 dimensions)
await index.add(new Float32Array([
  1, 0, 0, 0,  // Vector 1
  0, 1, 0, 0,  // Vector 2
  0, 0, 1, 0,  // Vector 3
  0, 0, 0, 1   // Vector 4
]));
```

**Throws:**
- `Error` if index is disposed
- `Error` if vector dimensions don't match index dimensions
- `Error` if IVF_FLAT index is not trained

### search(query: Float32Array, k: number): Promise<SearchResults>

Search for k nearest neighbors.

**Parameters:**
- `query` (Float32Array): Query vector (must match index dimensions)
- `k` (number): Number of nearest neighbors to return

**Returns:**
- `Promise<SearchResults>`: Object containing:
  - `distances` (Float32Array): L2 distances to nearest neighbors
  - `labels` (Int32Array): Indices of nearest neighbors

**Example:**

```javascript
const query = new Float32Array([1, 0, 0, 0]);
const results = await index.search(query, 5);

console.log('Nearest neighbors:', results.labels);
console.log('Distances:', results.distances);
```

**Throws:**
- `Error` if index is disposed
- `Error` if query dimensions don't match
- `Error` if k is invalid

### searchBatch(queries: Float32Array, k: number): Promise<SearchResults>

Perform batch search for multiple queries efficiently.

**Parameters:**
- `queries` (Float32Array): Query vectors concatenated: `[q1[0..d-1], q2[0..d-1], ...]`
- `k` (number): Number of nearest neighbors per query

**Returns:**
- `Promise<SearchResults>`: Object containing:
  - `distances` (Float32Array): Shape `[nq * k]` - distances for all queries
  - `labels` (Int32Array): Shape `[nq * k]` - labels for all queries

**Example:**

```javascript
// 3 queries of 4 dimensions each
const queries = new Float32Array([
  1, 0, 0, 0,  // Query 1
  0, 1, 0, 0,  // Query 2
  0, 0, 1, 0   // Query 3
]);
const results = await index.searchBatch(queries, 5);

// results.distances[0..4] = distances for query 1
// results.distances[5..9] = distances for query 2
// results.distances[10..14] = distances for query 3
```

### train(vectors: Float32Array): Promise<void>

Train an IVF_FLAT index. Required before adding vectors.

**Parameters:**
- `vectors` (Float32Array): Training vectors (typically 10k-100k vectors)

**Example:**

```javascript
const trainingVectors = new Float32Array(/* 10k vectors */);
await ivfIndex.train(trainingVectors);
await ivfIndex.add(dataVectors);  // Now you can add vectors
```

**Throws:**
- `Error` if index is not IVF_FLAT
- `Error` if index is disposed

### setNprobe(nprobe: number): Promise<void>

Set the number of clusters to search for IVF_FLAT indexes.

**Parameters:**
- `nprobe` (number): Number of clusters to search (higher = more accurate, slower)

**Example:**

```javascript
await ivfIndex.setNprobe(20);  // Search more clusters
```

**Throws:**
- `Error` if index is not IVF_FLAT
- `Error` if index is disposed

### getStats(): IndexStats

Get index statistics.

**Returns:**
- `IndexStats`: Object containing:
  - `ntotal` (number): Total vectors in index
  - `dims` (number): Vector dimensions
  - `isTrained` (boolean): Whether index is trained (IVF only)
  - `type` (string): Index type

**Example:**

```javascript
const stats = index.getStats();
console.log(`Index has ${stats.ntotal} vectors of ${stats.dims} dimensions`);
```

### save(filename: string): Promise<void>

Save index to disk.

**Parameters:**
- `filename` (string): File path to save index

**Example:**

```javascript
await index.save('./my-index.faiss');
```

**Throws:**
- `Error` if index is disposed
- `Error` if file cannot be written

### static load(filename: string): Promise<FaissIndex>

Load index from disk.

**Parameters:**
- `filename` (string): File path to load index from

**Returns:**
- `Promise<FaissIndex>`: Loaded index instance

**Example:**

```javascript
const index = await FaissIndex.load('./my-index.faiss');
```

**Throws:**
- `Error` if file cannot be read
- `Error` if file is not a valid FAISS index

### toBuffer(): Promise<Buffer>

Serialize index to a Node.js Buffer.

**Returns:**
- `Promise<Buffer>`: Serialized index data

**Example:**

```javascript
const buffer = await index.toBuffer();
// Store in database, send over network, etc.
```

**Throws:**
- `Error` if index is disposed

### static fromBuffer(buffer: Buffer): Promise<FaissIndex>

Deserialize index from Buffer.

**Parameters:**
- `buffer` (Buffer): Serialized index data

**Returns:**
- `Promise<FaissIndex>`: Deserialized index instance

**Example:**

```javascript
const index = await FaissIndex.fromBuffer(buffer);
```

**Throws:**
- `Error` if buffer is not valid FAISS index data

### mergeFrom(otherIndex: FaissIndex): Promise<void>

Merge vectors from another index into this index.

**Parameters:**
- `otherIndex` (FaissIndex): Index to merge from

**Example:**

```javascript
const index1 = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
const index2 = new FaissIndex({ type: 'FLAT_L2', dims: 128 });

await index1.add(vectors1);
await index2.add(vectors2);

await index1.mergeFrom(index2);  // index1 now contains vectors from both
// Note: index2 is now empty (FAISS behavior)
```

**Throws:**
- `Error` if index is disposed
- `Error` if otherIndex is disposed
- `Error` if dimensions don't match

### dispose(): void

Explicitly dispose of the index and free resources.

**Example:**

```javascript
index.dispose();
// Index is now unusable - all operations will throw errors
```

**Note:** Disposal is automatic on garbage collection, but explicit disposal is recommended for immediate resource cleanup.

## Types

### FaissIndexConfig

```typescript
interface FaissIndexConfig {
  type: 'FLAT_L2' | 'IVF_FLAT' | 'HNSW';
  dims: number;
  nlist?: number;
  nprobe?: number;
  M?: number;
  efConstruction?: number;
  efSearch?: number;
}
```

### SearchResults

```typescript
interface SearchResults {
  distances: Float32Array;
  labels: Int32Array;
}
```

### IndexStats

```typescript
interface IndexStats {
  ntotal: number;
  dims: number;
  isTrained: boolean;
  type: string;
}
```

## Examples

See the [README.md](./README.md#examples) for complete usage examples.
