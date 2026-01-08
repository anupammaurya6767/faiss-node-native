/**
 * Basic search example - Phase 1
 */

const { FaissIndex } = require('../src/js/index');

async function main() {
  console.log('Creating FAISS index...');
  const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
  
  console.log('Adding vectors...');
  const vectors = new Float32Array([
    1, 0, 0, 0,  // Vector 0: [1, 0, 0, 0]
    0, 1, 0, 0,  // Vector 1: [0, 1, 0, 0]
    0, 0, 1, 0,  // Vector 2: [0, 0, 1, 0]
    0, 0, 0, 1   // Vector 3: [0, 0, 0, 1]
  ]);
  
  await index.add(vectors);
  console.log(`Added ${index.getStats().ntotal} vectors`);
  
  console.log('Searching...');
  const query = new Float32Array([1, 0, 0, 0]);
  const results = await index.search(query, 2);
  
  console.log('\nSearch Results:');
  console.log('Query:', Array.from(query));
  for (let i = 0; i < results.labels.length; i++) {
    console.log(`  ${i + 1}. Vector ${results.labels[i]} (distance: ${results.distances[i].toFixed(4)})`);
  }
  
  console.log('\nIndex Stats:');
  console.log(index.getStats());
}

main().catch(console.error);
