/**
 * Performance Benchmark Example
 * 
 * This example benchmarks the performance of different FAISS index types
 * and compares them against the targets specified in the project requirements.
 * 
 * Performance Targets (from project_idea.txt):
 * - Add 10k vectors (768d): < 100ms (FLAT), < 500ms (HNSW)
 * - Search 1 query (k=10): < 1ms (FLAT on 10k), < 0.1ms (HNSW)
 * - JS → C++ overhead: < 0.01ms (negligible)
 */

const { FaissIndex } = require('../src/js/index');

// Generate realistic vectors for benchmarking
// Real embeddings are L2-normalized with Gaussian-like distributions
function generateRealisticVectors(count, dims) {
  const vectors = new Float32Array(count * dims);
  
  // Generate vectors with realistic embedding characteristics:
  // 1. Gaussian-like distribution (mean ~0, std ~0.15)
  // 2. L2-normalized (magnitude ~1)
  // 3. Values in range [-1, 1] (typical for normalized embeddings)
  
  for (let v = 0; v < count; v++) {
    // Generate vector with Gaussian-like distribution
    let magnitude = 0;
    
    for (let i = 0; i < dims; i++) {
      // Box-Muller transform for Gaussian distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
      
      // Scale to match real embedding distribution (mean 0, std ~0.15)
      const value = z * 0.15;
      vectors[v * dims + i] = value;
      magnitude += value * value;
    }
    
    // L2 normalize (real embeddings are normalized)
    magnitude = Math.sqrt(magnitude);
    if (magnitude > 0) {
      for (let i = 0; i < dims; i++) {
        vectors[v * dims + i] /= magnitude;
      }
    }
  }
  
  return vectors;
}

function generateRealisticQuery(dims) {
  // Generate a single realistic query vector
  const query = new Float32Array(dims);
  let magnitude = 0;
  
  // Generate with Gaussian-like distribution
  for (let i = 0; i < dims; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    const value = z * 0.15;
    query[i] = value;
    magnitude += value * value;
  }
  
  // L2 normalize
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (let i = 0; i < dims; i++) {
      query[i] /= magnitude;
    }
  }
  
  return query;
}

async function benchmarkAdd(indexType, vectorCount, dims) {
  console.log(`\n  Benchmarking ADD operation:`);
  console.log(`    Index Type: ${indexType}`);
  console.log(`    Vectors: ${vectorCount.toLocaleString()}`);
  console.log(`    Dimensions: ${dims}`);
  
  let index;
  if (indexType === 'IVF_FLAT') {
    index = new FaissIndex({
      type: 'IVF_FLAT',
      dims: dims,
      nlist: Math.min(100, Math.floor(Math.sqrt(vectorCount)))
    });
    
    // For IVF_FLAT, we need to train first
    console.log(`    Training IVF index...`);
    const trainingVectors = generateRealisticVectors(Math.min(vectorCount, 1000), dims);
    const trainStart = process.hrtime.bigint();
    await index.train(trainingVectors);
    const trainTime = Number(process.hrtime.bigint() - trainStart) / 1e6;
    console.log(`    Training completed in ${trainTime.toFixed(2)}ms`);
  } else {
    index = new FaissIndex({
      type: indexType,
      dims: dims,
      // HNSW parameters
      ...(indexType === 'HNSW' && {
        M: 16,
        efConstruction: 200
      })
    });
  }
  
  // Use realistic vectors (L2-normalized, Gaussian distribution)
  const vectors = generateRealisticVectors(vectorCount, dims);
  
  // Warmup (first operation can be slower)
  if (indexType !== 'IVF_FLAT') {
    const warmupVectors = generateRealisticVectors(Math.min(100, vectorCount), dims);
    await index.add(warmupVectors);
  }
  
  // Actual benchmark
  const start = process.hrtime.bigint();
  await index.add(vectors);
  const end = process.hrtime.bigint();
  const timeMs = Number(end - start) / 1e6;
  
  const stats = index.getStats();
  const vectorsPerMs = vectorCount / timeMs;
  const msPerVector = timeMs / vectorCount;
  
  console.log(`    ✅ Add time: ${timeMs.toFixed(2)}ms`);
  console.log(`    Throughput: ${vectorsPerMs.toFixed(2)} vectors/ms`);
  console.log(`    Latency: ${msPerVector.toFixed(4)}ms per vector`);
  
  // Check against targets (for 10k vectors, 768d)
  if (vectorCount === 10000 && dims === 768) {
    if (indexType === 'FLAT_L2' && timeMs > 100) {
      console.log(`    ⚠️  Target: < 100ms (actual: ${timeMs.toFixed(2)}ms)`);
    } else if (indexType === 'HNSW' && timeMs > 500) {
      console.log(`    ⚠️  Target: < 500ms (actual: ${timeMs.toFixed(2)}ms)`);
    } else {
      console.log(`    ✅ Meets target`);
    }
  }
  
  return { index, timeMs, stats };
}

async function benchmarkSearch(index, indexType, queryCount, k) {
  console.log(`\n  Benchmarking SEARCH operation:`);
  console.log(`    Index Type: ${indexType}`);
  console.log(`    Queries: ${queryCount}`);
  console.log(`    K (neighbors): ${k}`);
  
  const stats = index.getStats();
  console.log(`    Index size: ${stats.ntotal.toLocaleString()} vectors`);
  
  const dims = stats.dims;
  const queries = generateRealisticVectors(queryCount, dims);
  
  // Warmup
  const warmupQuery = generateRealisticQuery(dims);
  await index.search(warmupQuery, k);
  
  // Single query benchmark (if queryCount === 1)
  if (queryCount === 1) {
    const query = generateRealisticQuery(dims);
    const start = process.hrtime.bigint();
    const results = await index.search(query, k);
    const end = process.hrtime.bigint();
    const timeMs = Number(end - start) / 1e6;
    const timeUs = timeMs * 1000;
    
    console.log(`    ✅ Search time: ${timeMs.toFixed(3)}ms (${timeUs.toFixed(2)}μs)`);
    console.log(`    Results returned: ${results.labels.length}`);
    
    // Check against targets (for 1 query, k=10, on 10k vectors)
    if (stats.ntotal === 10000 && k === 10) {
      if (indexType === 'FLAT_L2' && timeMs > 1) {
        console.log(`    ⚠️  Target: < 1ms (actual: ${timeMs.toFixed(3)}ms)`);
      } else if (indexType === 'HNSW' && timeMs > 0.1) {
        console.log(`    ⚠️  Target: < 0.1ms (actual: ${timeMs.toFixed(3)}ms)`);
      } else {
        console.log(`    ✅ Meets target`);
      }
    }
    
    return { timeMs, results };
  }
  
  // Batch query benchmark
  const start = process.hrtime.bigint();
  const results = await index.searchBatch(queries, k);
  const end = process.hrtime.bigint();
  const totalTimeMs = Number(end - start) / 1e6;
  const avgTimeMs = totalTimeMs / queryCount;
  const queriesPerSecond = (queryCount / totalTimeMs) * 1000;
  
  console.log(`    ✅ Total time: ${totalTimeMs.toFixed(2)}ms`);
  console.log(`    Average per query: ${avgTimeMs.toFixed(3)}ms`);
  console.log(`    Throughput: ${queriesPerSecond.toFixed(2)} queries/second`);
  
  return { timeMs: avgTimeMs, totalTimeMs, results };
}

async function benchmarkJSOverhead() {
  console.log(`\n  Benchmarking JS → C++ overhead:`);
  console.log(`    Using realistic L2-normalized vectors (matching production embeddings)`);
  
  const dims = 768;
  const k = 10;
  
  // Create a small index with realistic vectors
  const index = new FaissIndex({ type: 'FLAT_L2', dims: dims });
  const vectors = generateRealisticVectors(100, dims);
  await index.add(vectors);
  
  // Measure JS call overhead (minimum overhead test)
  const query = generateRealisticQuery(dims);
  const iterations = 1000;
  
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    // This measures the overhead of JS→C++ calls
    // Note: This is an approximation since we can't fully isolate JS overhead
    await index.search(query, k);
  }
  const end = process.hrtime.bigint();
  
  const totalTimeMs = Number(end - start) / 1e6;
  const avgTimeMs = totalTimeMs / iterations;
  const avgTimeUs = avgTimeMs * 1000;
  
  console.log(`    Iterations: ${iterations}`);
  console.log(`    Average time per call: ${avgTimeMs.toFixed(4)}ms (${avgTimeUs.toFixed(2)}μs)`);
  
  // The actual JS overhead is much less than this (most time is in C++)
  // This is an upper bound measurement
  if (avgTimeUs < 10) {
    console.log(`    ✅ Overhead appears negligible (< 0.01ms target)`);
  } else {
    console.log(`    ⚠️  Note: This measures total call time, not just JS overhead`);
  }
  
  index.dispose();
}

async function runBenchmarks() {
  console.log('='.repeat(70));
  console.log('FAISS-Node Performance Benchmarks');
  console.log('='.repeat(70));
  console.log('\nComparing performance against project targets...');
  console.log('\nTargets:');
  console.log('  - Add 10k vectors (768d): < 100ms (FLAT), < 500ms (HNSW)');
  console.log('  - Search 1 query (k=10, 10k vectors): < 1ms (FLAT), < 0.1ms (HNSW)');
  console.log('  - JS → C++ overhead: < 0.01ms (negligible)');
  
  const benchmarks = [
    // Test case 1: 10k vectors, 768 dimensions (project target)
    {
      name: 'Target Test Case (10k vectors, 768d)',
      vectorCount: 10000,
      dims: 768,
      queryCount: 1,
      k: 10,
      indexTypes: ['FLAT_L2', 'HNSW', 'IVF_FLAT']
    },
    // Test case 2: Smaller dataset for quick comparison
    {
      name: 'Small Dataset (1k vectors, 128d)',
      vectorCount: 1000,
      dims: 128,
      queryCount: 1,
      k: 10,
      indexTypes: ['FLAT_L2', 'HNSW']
    },
    // Test case 3: Larger dataset to test scalability
    {
      name: 'Large Dataset (50k vectors, 256d)',
      vectorCount: 50000,
      dims: 256,
      queryCount: 1,
      k: 10,
      indexTypes: ['HNSW', 'IVF_FLAT'] // FLAT would be too slow
    },
    // Test case 4: Batch search
    {
      name: 'Batch Search (10 queries)',
      vectorCount: 10000,
      dims: 768,
      queryCount: 10,
      k: 10,
      indexTypes: ['FLAT_L2', 'HNSW']
    }
  ];
  
  const results = [];
  
  for (const benchmark of benchmarks) {
    console.log('\n' + '='.repeat(70));
    console.log(`Benchmark: ${benchmark.name}`);
    console.log('='.repeat(70));
    
    for (const indexType of benchmark.indexTypes) {
      try {
        console.log(`\n📊 Index Type: ${indexType}`);
        
        // Benchmark add operation
        const { index, timeMs: addTime, stats } = await benchmarkAdd(
          indexType,
          benchmark.vectorCount,
          benchmark.dims
        );
        
        // Benchmark search operation
        const searchResult = await benchmarkSearch(
          index,
          indexType,
          benchmark.queryCount,
          benchmark.k
        );
        
        results.push({
          name: benchmark.name,
          indexType,
          vectorCount: benchmark.vectorCount,
          dims: benchmark.dims,
          queryCount: benchmark.queryCount,
          k: benchmark.k,
          addTime,
          searchTime: searchResult.timeMs || searchResult.totalTimeMs,
          indexSize: stats.ntotal
        });
        
        // Cleanup
        index.dispose();
        
      } catch (error) {
        console.error(`\n❌ Error benchmarking ${indexType}:`, error.message);
        if (error.stack) {
          console.error(error.stack.split('\n').slice(0, 3).join('\n'));
        }
      }
    }
  }
  
  // JS Overhead benchmark
  await benchmarkJSOverhead();
  
  // Summary table
  console.log('\n' + '='.repeat(70));
  console.log('Benchmark Summary');
  console.log('='.repeat(70));
  console.log('\n' + formatBenchmarkTable(results));
  
  // Performance comparison
  console.log('\n' + '='.repeat(70));
  console.log('Performance Comparison');
  console.log('='.repeat(70));
  
  const targetTest = results.find(r => 
    r.name.includes('Target') && r.indexType === 'FLAT_L2'
  );
  
  if (targetTest) {
    console.log(`\nTarget Test Case (10k vectors, 768d, FLAT_L2):`);
    console.log(`  Add: ${targetTest.addTime.toFixed(2)}ms (target: < 100ms) ${targetTest.addTime < 100 ? '✅' : '⚠️'}`);
    console.log(`  Search: ${targetTest.searchTime.toFixed(3)}ms (target: < 1ms) ${targetTest.searchTime < 1 ? '✅' : '⚠️'}`);
  }
  
  const targetHNSW = results.find(r => 
    r.name.includes('Target') && r.indexType === 'HNSW'
  );
  
  if (targetHNSW) {
    console.log(`\nTarget Test Case (10k vectors, 768d, HNSW):`);
    console.log(`  Add: ${targetHNSW.addTime.toFixed(2)}ms (target: < 500ms) ${targetHNSW.addTime < 500 ? '✅' : '⚠️'}`);
    console.log(`  Search: ${targetHNSW.searchTime.toFixed(3)}ms (target: < 0.1ms) ${targetHNSW.searchTime < 0.1 ? '✅' : '⚠️'}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Benchmark Complete');
  console.log('='.repeat(70));
  console.log('\nNote: These benchmarks use realistic L2-normalized vectors with Gaussian-like');
  console.log('distributions that match actual embedding model outputs (e.g., OpenAI).');
  console.log('Actual performance depends on hardware, FAISS build configuration, and system load.');
  console.log('These benchmarks provide a baseline for comparison with production workloads.');
}

function formatBenchmarkTable(results) {
  const headers = ['Index', 'Vectors', 'Dims', 'Add (ms)', 'Search (ms)', 'QPS'];
  const rows = results.map(r => [
    r.indexType,
    r.vectorCount.toLocaleString(),
    r.dims.toString(),
    r.addTime.toFixed(2),
    (r.searchTime || 0).toFixed(3),
    r.queryCount > 1 ? ((1000 / (r.searchTime || 1)).toFixed(0)) : '-'
  ]);
  
  const colWidths = headers.map((h, i) => {
    const maxContent = Math.max(
      h.length,
      ...rows.map(r => r[i].length)
    );
    return Math.max(maxContent, 10);
  });
  
  const pad = (str, width) => str.padEnd(width, ' ');
  
  let table = '  ' + headers.map((h, i) => pad(h, colWidths[i])).join(' | ') + '\n';
  table += '  ' + headers.map((_, i) => '-'.repeat(colWidths[i])).join('-|-') + '\n';
  
  rows.forEach(row => {
    table += '  ' + row.map((cell, i) => pad(cell, colWidths[i])).join(' | ') + '\n';
  });
  
  return table;
}

// Run benchmarks if executed directly
if (require.main === module) {
  runBenchmarks().catch(error => {
    console.error('❌ Benchmark failed:', error);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  benchmarkAdd,
  benchmarkSearch,
  benchmarkJSOverhead,
  generateRealisticVectors,
  generateRealisticQuery
};
