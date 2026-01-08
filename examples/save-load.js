/**
 * Save/Load example - Demonstrates persistence features
 * Incorporated from ewfian/faiss-node
 */

const { FaissIndex } = require('../src/js/index');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Creating and populating index...');
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  
  const vectors = new Float32Array([
    1, 0, 0, 0,  // Vector 0
    0, 1, 0, 0,  // Vector 1
    0, 0, 1, 0,  // Vector 2
    0, 0, 0, 1   // Vector 3
  ]);
  
  await index.add(vectors);
  console.log(`Added ${index.getStats().ntotal} vectors`);
  
  // Save to disk
  const filename = path.join(__dirname, 'saved-index.faiss');
  console.log(`\nSaving index to ${filename}...`);
  await index.save(filename);
  console.log('Index saved successfully');
  
  // Load from disk
  console.log(`\nLoading index from ${filename}...`);
  const loadedIndex = await FaissIndex.load(filename);
  console.log(`Loaded index with ${loadedIndex.getStats().ntotal} vectors`);
  
  // Verify it works
  const query = new Float32Array([1, 0, 0, 0]);
  const results = await loadedIndex.search(query, 2);
  console.log('\nSearch results from loaded index:');
  console.log('Labels:', Array.from(results.labels));
  console.log('Distances:', Array.from(results.distances));
  
  // Serialization example
  console.log('\n\nSerialization example:');
  const buffer = await index.toBuffer();
  console.log(`Serialized to buffer: ${buffer.length} bytes`);
  
  const deserializedIndex = await FaissIndex.fromBuffer(buffer);
  console.log(`Deserialized index with ${deserializedIndex.getStats().ntotal} vectors`);
  
  // Clean up
  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
    console.log('\nCleaned up test file');
  }
}

main().catch(console.error);
