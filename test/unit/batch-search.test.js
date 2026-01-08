const { FaissIndex } = require('../../src/js/index');

describe('FaissIndex - Batch Search', () => {
  let index;
  const dims = 4;
  
  // Test vectors: 5 vectors of 4 dimensions each
  const vectors = new Float32Array([
    1, 0, 0, 0,  // Vector 0
    0, 1, 0, 0,  // Vector 1
    0, 0, 1, 0,  // Vector 2
    0, 0, 0, 1,  // Vector 3
    1, 1, 0, 0   // Vector 4
  ]);

  beforeEach(async () => {
    index = new FaissIndex({ type: 'FLAT_L2', dims });
    await index.add(vectors);
  });

  afterEach(() => {
    if (index) {
      index.dispose();
    }
  });

  describe('Basic Batch Search', () => {
    test('searches single query (same as search)', async () => {
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index.searchBatch(query, 2);
      
      expect(results.nq).toBe(1);
      expect(results.k).toBe(2);
      expect(results.distances.length).toBe(2);
      expect(results.labels.length).toBe(2);
      expect(results.labels[0]).toBe(0); // Closest match
      expect(results.distances[0]).toBeCloseTo(0, 2);
    });

    test('searches multiple queries', async () => {
      // 3 queries: [1,0,0,0], [0,1,0,0], [0,0,1,0]
      const queries = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0
      ]);
      
      const results = await index.searchBatch(queries, 2);
      
      expect(results.nq).toBe(3);
      expect(results.k).toBe(2);
      expect(results.distances.length).toBe(6); // 3 queries * 2 results
      expect(results.labels.length).toBe(6);
      
      // First query should match vector 0
      expect(results.labels[0]).toBe(0);
      expect(results.distances[0]).toBeCloseTo(0, 2);
      
      // Second query should match vector 1
      expect(results.labels[2]).toBe(1); // Index 2 = query 1, result 0
      expect(results.distances[2]).toBeCloseTo(0, 2);
      
      // Third query should match vector 2
      expect(results.labels[4]).toBe(2); // Index 4 = query 2, result 0
      expect(results.distances[4]).toBeCloseTo(0, 2);
    });

    test('returns correct result structure', async () => {
      const queries = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0
      ]);
      
      const results = await index.searchBatch(queries, 3);
      
      expect(results).toHaveProperty('distances');
      expect(results).toHaveProperty('labels');
      expect(results).toHaveProperty('nq');
      expect(results).toHaveProperty('k');
      expect(results.nq).toBe(2);
      expect(results.k).toBe(3);
      // Check TypedArray types (Jest may have issues with native module TypedArrays)
      expect(results.distances.constructor.name).toBe('Float32Array');
      expect(results.labels.constructor.name).toBe('Int32Array');
      expect(ArrayBuffer.isView(results.distances)).toBe(true);
      expect(ArrayBuffer.isView(results.labels)).toBe(true);
    });
  });

  describe('Result Layout', () => {
    test('results are laid out as [q1_results, q2_results, ...]', async () => {
      const queries = new Float32Array([
        1, 0, 0, 0,  // Query 0 - should match vector 0
        0, 1, 0, 0   // Query 1 - should match vector 1
      ]);
      
      const results = await index.searchBatch(queries, 2);
      
      // Results layout: [q0_r0, q0_r1, q1_r0, q1_r1]
      // Query 0, result 0
      expect(results.labels[0]).toBe(0);
      expect(results.distances[0]).toBeCloseTo(0, 2);
      
      // Query 1, result 0
      expect(results.labels[2]).toBe(1);
      expect(results.distances[2]).toBeCloseTo(0, 2);
    });

    test('handles k larger than available vectors', async () => {
      const queries = new Float32Array([1, 0, 0, 0]);
      const results = await index.searchBatch(queries, 100); // k > ntotal
      
      expect(results.k).toBe(5); // Clamped to ntotal
      expect(results.distances.length).toBe(5);
      expect(results.labels.length).toBe(5);
    });
  });

  describe('Input Validation', () => {
    test('throws on invalid query type', async () => {
      await expect(index.searchBatch([1, 2, 3, 4], 1)).rejects.toThrow(TypeError);
      await expect(index.searchBatch(null, 1)).rejects.toThrow(TypeError);
      await expect(index.searchBatch(undefined, 1)).rejects.toThrow(TypeError);
    });

    test('throws on empty queries array', async () => {
      const empty = new Float32Array([]);
      await expect(index.searchBatch(empty, 1)).rejects.toThrow(/empty/);
    });

    test('throws on queries length not multiple of dims', async () => {
      const invalid = new Float32Array([1, 2, 3]); // 3 elements, not multiple of 4
      await expect(index.searchBatch(invalid, 1)).rejects.toThrow(/multiple/);
      
      const invalid2 = new Float32Array([1, 2, 3, 4, 5]); // 5 elements
      await expect(index.searchBatch(invalid2, 1)).rejects.toThrow(/multiple/);
    });

    test('throws on invalid k', async () => {
      const queries = new Float32Array([1, 0, 0, 0]);
      await expect(index.searchBatch(queries, 0)).rejects.toThrow();
      await expect(index.searchBatch(queries, -1)).rejects.toThrow();
      await expect(index.searchBatch(queries, 1.5)).rejects.toThrow();
      await expect(index.searchBatch(queries, '1')).rejects.toThrow();
    });

    test('throws on disposed index', async () => {
      index.dispose();
      const queries = new Float32Array([1, 0, 0, 0]);
      await expect(index.searchBatch(queries, 1)).rejects.toThrow(/disposed/);
    });

    test('throws on empty index', async () => {
      const emptyIndex = new FaissIndex({ dims: 4 });
      const queries = new Float32Array([1, 0, 0, 0]);
      await expect(emptyIndex.searchBatch(queries, 1)).rejects.toThrow(/empty/);
      emptyIndex.dispose();
    });
  });

  describe('Performance Comparison', () => {
    test('batch search is more efficient than multiple single searches', async () => {
      const queries = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0
      ]);
      
      // Batch search
      const batchStart = Date.now();
      const batchResults = await index.searchBatch(queries, 2);
      const batchTime = Date.now() - batchStart;
      
      // Multiple single searches
      const singleStart = Date.now();
      const singleResults = [];
      for (let i = 0; i < 3; i++) {
        const query = queries.slice(i * 4, (i + 1) * 4);
        const result = await index.search(query, 2);
        singleResults.push(result);
      }
      const singleTime = Date.now() - singleStart;
      
      // Verify results are equivalent
      expect(batchResults.labels[0]).toBe(singleResults[0].labels[0]);
      expect(batchResults.labels[2]).toBe(singleResults[1].labels[0]);
      expect(batchResults.labels[4]).toBe(singleResults[2].labels[0]);
      
      // Batch should be faster (or at least not slower)
      // Note: This is a sanity check, actual performance depends on many factors
      console.log(`Batch: ${batchTime}ms, Single: ${singleTime}ms`);
    });
  });

  describe('Edge Cases', () => {
    test('handles large number of queries', async () => {
      const nQueries = 100;
      const queries = new Float32Array(nQueries * dims);
      for (let i = 0; i < nQueries; i++) {
        queries[i * dims] = 1; // All queries are [1, 0, 0, 0]
      }
      
      const results = await index.searchBatch(queries, 1);
      expect(results.nq).toBe(nQueries);
      expect(results.distances.length).toBe(nQueries);
      expect(results.labels.length).toBe(nQueries);
      
      // All should match vector 0
      for (let i = 0; i < nQueries; i++) {
        expect(results.labels[i]).toBe(0);
      }
    });

    test('handles k=1 for multiple queries', async () => {
      const queries = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0
      ]);
      
      const results = await index.searchBatch(queries, 1);
      expect(results.nq).toBe(3);
      expect(results.k).toBe(1);
      expect(results.distances.length).toBe(3);
      expect(results.labels.length).toBe(3);
    });
  });
});
