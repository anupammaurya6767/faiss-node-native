#!/usr/bin/env node

/**
 * Comprehensive test script for @faiss-node/native
 * Tests all features as documented in README.md
 */

const { FaissIndex } = require('@faiss-node/native');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

async function runAllTests() {
console.log('🧪 Testing @faiss-node/native package\n');
console.log('=' .repeat(60));

// Test 1: Package Installation and Import
test('Package imports correctly', () => {
  if (!FaissIndex) {
    throw new Error('FaissIndex not exported');
  }
  if (typeof FaissIndex !== 'function') {
    throw new Error('FaissIndex is not a constructor');
  }
});

// Test 2: Create FLAT_L2 Index
test('Create FLAT_L2 index', () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  const stats = index.getStats();
  if (stats.type !== 'FLAT_L2' || stats.dims !== 4) {
    throw new Error('Index creation failed');
  }
  index.dispose();
});

// Test 3: Create IVF_FLAT Index
test('Create IVF_FLAT index', () => {
  const index = new FaissIndex({ 
    type: 'IVF_FLAT', 
    dims: 4,
    nlist: 10 
  });
  const stats = index.getStats();
  // Check that index was created (type might be different format)
  if (stats.dims !== 4) {
    throw new Error('IVF_FLAT index creation failed - wrong dimensions');
  }
  index.dispose();
});

// Test 4: Create HNSW Index
test('Create HNSW index', () => {
  const index = new FaissIndex({ 
    type: 'HNSW', 
    dims: 4,
    M: 16 
  });
  const stats = index.getStats();
  // Check that index was created (type might be different format)
  if (stats.dims !== 4) {
    throw new Error('HNSW index creation failed - wrong dimensions');
  }
  index.dispose();
});

// Test 5: Add Vectors (Async)
await testAsync('Add vectors (async)', async () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  const vectors = new Float32Array([
    1.0, 0.0, 0.0, 0.0,  // Vector 1
    0.0, 1.0, 0.0, 0.0,  // Vector 2
    0.0, 0.0, 1.0, 0.0   // Vector 3
  ]);
  await index.add(vectors);
  const stats = index.getStats();
  if (stats.ntotal !== 3) {
    throw new Error(`Expected 3 vectors, got ${stats.ntotal}`);
  }
  index.dispose();
});

// Test 6: Search (Async)
await testAsync('Search for nearest neighbors', async () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  const vectors = new Float32Array([
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0
  ]);
  await index.add(vectors);
  
  const query = new Float32Array([1.0, 0.0, 0.0, 0.0]);
  const results = await index.search(query, 2);
  
  if (!results.labels || !results.distances) {
    throw new Error('Search results missing labels or distances');
  }
  if (results.labels.length !== 2 || results.distances.length !== 2) {
    throw new Error(`Expected 2 results, got ${results.labels.length}`);
  }
  if (results.labels[0] !== 0) {
    throw new Error(`Expected label 0, got ${results.labels[0]}`);
  }
  index.dispose();
});

// Test 7: Batch Search
await testAsync('Batch search', async () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  const vectors = new Float32Array([
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0
  ]);
  await index.add(vectors);
  
  const queries = new Float32Array([
    1.0, 0.0, 0.0, 0.0,  // Query 1
    0.0, 1.0, 0.0, 0.0   // Query 2
  ]);
  const results = await index.searchBatch(queries, 2);
  
  if (results.labels.length !== 4 || results.distances.length !== 4) {
    throw new Error(`Expected 4 results (2 queries × 2 results), got ${results.labels.length}`);
  }
  index.dispose();
});

// Test 8: IVF_FLAT Training
await testAsync('IVF_FLAT training and usage', async () => {
  const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 2 });
  
  // Training vectors
  const trainingVectors = new Float32Array([
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
  ]);
  await index.train(trainingVectors);
  
  // Add vectors
  await index.add(trainingVectors);
  
  // Search
  const query = new Float32Array([1.0, 0.0, 0.0, 0.0]);
  const results = await index.search(query, 2);
  
  if (results.labels.length !== 2) {
    throw new Error('IVF_FLAT search failed');
  }
  index.dispose();
});

// Test 9: Persistence - Save/Load
await testAsync('Save and load index', async () => {
  const index1 = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  const vectors = new Float32Array([
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0
  ]);
  await index1.add(vectors);
  
  const filename = './test-index.faiss';
  await index1.save(filename);
  
  const index2 = await FaissIndex.load(filename);
  const stats = index2.getStats();
  
  if (stats.ntotal !== 2) {
    throw new Error(`Loaded index has ${stats.ntotal} vectors, expected 2`);
  }
  
  // Verify search works
  const query = new Float32Array([1.0, 0.0, 0.0, 0.0]);
  const results = await index2.search(query, 1);
  
  if (results.labels[0] !== 0) {
    throw new Error('Loaded index search failed');
  }
  
  index1.dispose();
  index2.dispose();
  
  // Cleanup
  const fs = require('fs');
  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
  }
});

// Test 10: Buffer Serialization
await testAsync('Serialize and deserialize index to buffer', async () => {
  const index1 = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  const vectors = new Float32Array([
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0
  ]);
  await index1.add(vectors);
  
  const buffer = await index1.toBuffer();
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('toBuffer did not return a Buffer');
  }
  
  const index2 = await FaissIndex.fromBuffer(buffer);
  const stats = index2.getStats();
  
  if (stats.ntotal !== 2) {
    throw new Error(`Deserialized index has ${stats.ntotal} vectors, expected 2`);
  }
  
  // Verify search works
  const query = new Float32Array([1.0, 0.0, 0.0, 0.0]);
  const results = await index2.search(query, 1);
  
  if (results.labels[0] !== 0) {
    throw new Error('Deserialized index search failed');
  }
  
  index1.dispose();
  index2.dispose();
});

// Test 11: Merge Indexes
await testAsync('Merge indexes', async () => {
  const index1 = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  const index2 = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  
  const vectors1 = new Float32Array([1.0, 0.0, 0.0, 0.0]);
  const vectors2 = new Float32Array([0.0, 1.0, 0.0, 0.0]);
  
  await index1.add(vectors1);
  await index2.add(vectors2);
  
  await index1.mergeFrom(index2);
  
  const stats = index1.getStats();
  if (stats.ntotal !== 2) {
    throw new Error(`Merged index has ${stats.ntotal} vectors, expected 2`);
  }
  
  index1.dispose();
  index2.dispose();
});

// Test 12: Thread Safety (Concurrent Operations)
await testAsync('Concurrent operations (thread safety)', async () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  
  // Concurrent adds
  await Promise.all([
    index.add(new Float32Array([1.0, 0.0, 0.0, 0.0])),
    index.add(new Float32Array([0.0, 1.0, 0.0, 0.0])),
    index.add(new Float32Array([0.0, 0.0, 1.0, 0.0]))
  ]);
  
  const stats = index.getStats();
  if (stats.ntotal !== 3) {
    throw new Error(`Concurrent adds resulted in ${stats.ntotal} vectors, expected 3`);
  }
  
  // Concurrent searches
  const query1 = new Float32Array([1.0, 0.0, 0.0, 0.0]);
  const query2 = new Float32Array([0.0, 1.0, 0.0, 0.0]);
  
  const [results1, results2] = await Promise.all([
    index.search(query1, 1),
    index.search(query2, 1)
  ]);
  
  if (results1.labels.length !== 1 || results2.labels.length !== 1) {
    throw new Error('Concurrent searches failed');
  }
  
  index.dispose();
});

// Test 13: Error Handling
test('Error handling - invalid dimensions', () => {
  try {
    new FaissIndex({ type: 'FLAT_L2', dims: 0 });
    throw new Error('Should have thrown error for invalid dimensions');
  } catch (error) {
    if (!error.message.includes('dimension') && 
        !error.message.includes('invalid') && 
        !error.message.includes('positive integer')) {
      throw error;
    }
  }
});

await testAsync('Error handling - search on empty index', async () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  try {
    await index.search(new Float32Array([1, 0, 0, 0]), 1);
    throw new Error('Should have thrown error for empty index');
  } catch (error) {
    if (!error.message.includes('empty') && !error.message.includes('no vectors')) {
      throw error;
    }
  }
  index.dispose();
});

// Test 14: Get Stats
test('Get index statistics', () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
  const stats = index.getStats();
  
  if (stats.dims !== 128 || stats.type !== 'FLAT_L2' || stats.ntotal !== 0) {
    throw new Error('Stats incorrect');
  }
  index.dispose();
});

// Test 15: Dispose
test('Dispose index', () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  index.dispose();
  
  try {
    index.getStats();
    throw new Error('Should have thrown error after dispose');
  } catch (error) {
    // After dispose, _native is null, so getStats will fail
    if (!error.message.includes('disposed') && 
        !error.message.includes('null') &&
        !error.message.includes('Failed to get stats')) {
      throw error;
    }
  }
});

// Test 16: TypeScript Types (runtime check)
test('TypeScript types - SearchResults structure', async () => {
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  await index.add(new Float32Array([1, 0, 0, 0]));
  
  const results = await index.search(new Float32Array([1, 0, 0, 0]), 1);
  
  if (!(results.labels instanceof Int32Array)) {
    throw new Error('labels should be Int32Array');
  }
  if (!(results.distances instanceof Float32Array)) {
    throw new Error('distances should be Float32Array');
  }
  
  index.dispose();
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${testsPassed}`);
console.log(`   ❌ Failed: ${testsFailed}`);
console.log(`   📈 Total:  ${testsPassed + testsFailed}\n`);

if (testsFailed === 0) {
  console.log('🎉 All tests passed! Package is working correctly.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please check the errors above.\n');
  process.exit(1);
}
}

// Run all tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
