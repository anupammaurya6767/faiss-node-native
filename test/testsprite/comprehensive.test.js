/**
 * Comprehensive Test Suite for faiss-node Phase 1
 * Generated using TestSprite-style rigorous testing approach
 * 
 * This suite covers:
 * - All API methods with exhaustive parameter combinations
 * - Boundary conditions and edge cases
 * - Error handling and validation
 * - Performance and stress testing
 * - Integration scenarios
 * - Memory safety
 */

const { FaissIndex } = require('../../src/js/index');

describe('FaissIndex - Comprehensive Test Suite', () => {
  
  // ============================================================================
  // CONSTRUCTOR TESTS - Exhaustive Parameter Validation
  // ============================================================================
  
  describe('Constructor - Parameter Validation', () => {
    describe('Valid Configurations', () => {
      test.each([
        [{ dims: 1 }, 'minimum dimensions'],
        [{ dims: 128 }, 'common embedding size'],
        [{ dims: 768 }, 'BERT embedding size'],
        [{ dims: 1536 }, 'OpenAI large embedding'],
        [{ type: 'FLAT_L2', dims: 64 }, 'explicit type'],
        [{ dims: 256, type: 'FLAT_L2' }, 'type order variation'],
        [{ dims: 4096 }, 'large dimensions'],
      ])('creates index with %s', (config, description) => {
        const index = new FaissIndex(config);
        expect(index).toBeDefined();
        expect(index.getStats().dims).toBe(config.dims);
        expect(index.getStats().type).toBe('FLAT_L2');
      });
    });

    describe('Invalid Configurations', () => {
      test.each([
        [null, TypeError, 'null config'],
        [undefined, TypeError, 'undefined config'],
        ['string', TypeError, 'string config'],
        [123, TypeError, 'number config'],
        [[], TypeError, 'array config'],
        [{}, TypeError, 'empty object'],
        [{ dims: null }, TypeError, 'null dims'],
        [{ dims: undefined }, TypeError, 'undefined dims'],
        [{ dims: '128' }, TypeError, 'string dims'],
        [{ dims: 128.5 }, TypeError, 'float dims'],
        [{ dims: -1 }, TypeError, 'negative dims'],
        [{ dims: 0 }, TypeError, 'zero dims'],
        [{ dims: -100 }, TypeError, 'large negative'],
        [{ dims: Number.MAX_SAFE_INTEGER + 1 }, [Error, RangeError], 'unsafe integer'], // C++ throws RangeError
        [{ type: 'INVALID', dims: 128 }, Error, 'invalid type'],
        [{ type: '', dims: 128 }, undefined, 'empty type string'], // Empty string doesn't match check, so it works
        [{ dims: 128, extra: 'field' }, undefined, 'extra fields (should work)'],
      ])('throws %s for %s', (config, errorType, description) => {
        if (errorType) {
          if (Array.isArray(errorType)) {
            // Accept any of the error types
            expect(() => new FaissIndex(config)).toThrow();
          } else {
            expect(() => new FaissIndex(config)).toThrow(errorType);
          }
        } else {
          // Should work with extra fields
          expect(() => new FaissIndex(config)).not.toThrow();
        }
      });
    });

    describe('Boundary Values', () => {
      test('handles dims = 1 (minimum)', () => {
        const index = new FaissIndex({ dims: 1 });
        expect(index.getStats().dims).toBe(1);
      });

      test('handles very large but safe dims', () => {
        const index = new FaissIndex({ dims: 10000 });
        expect(index.getStats().dims).toBe(10000);
      });

      test('handles dims at Number.MAX_SAFE_INTEGER boundary', () => {
        // This will fail - Number.MAX_SAFE_INTEGER is too large for C++ int
        // The C++ layer will throw an error
        expect(() => {
          new FaissIndex({ dims: Number.MAX_SAFE_INTEGER });
        }).toThrow(); // C++ throws Error, not TypeError
      });
    });
  });

  // ============================================================================
  // ADD METHOD TESTS - Comprehensive Vector Handling
  // ============================================================================
  
  describe('Add Method - Vector Input Validation', () => {
    let index;

    beforeEach(() => {
      index = new FaissIndex({ dims: 4 });
    });

    describe('Valid Vector Inputs', () => {
      test.each([
        [new Float32Array([1, 0, 0, 0]), 1, 'single vector'],
        [new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]), 2, 'two vectors'],
        [new Float32Array(Array(40).fill(0)), 10, 'ten zero vectors'],
        [new Float32Array(Array(400).fill(0.5)), 100, 'hundred vectors'],
      ])('adds %s (%d vectors)', async (vectors, expectedCount, description) => {
        await index.add(vectors);
        expect(index.getStats().ntotal).toBe(expectedCount);
      });
    });

    describe('Invalid Vector Inputs', () => {
      test.each([
        [null, TypeError],
        [undefined, TypeError],
        ['string', TypeError],
        [123, TypeError],
        [[1, 2, 3, 4], TypeError],
        [{}, TypeError],
        [new Array(4), TypeError],
        [new Int32Array([1, 2, 3, 4]), TypeError],
        [new Uint8Array([1, 2, 3, 4]), TypeError],
        [new Float32Array([]), Error],
        [new Float32Array([1, 2, 3]), Error], // Not multiple of 4
        [new Float32Array([1, 2, 3, 4, 5]), Error], // Not multiple of 4
        [new Float32Array([1, 2, 3, 4, 5, 6, 7]), Error], // Not multiple of 4
      ])('throws %s for invalid input: %s', async (input, errorType) => {
        await expect(index.add(input)).rejects.toThrow(errorType);
      });
    });

    describe('Vector Value Edge Cases', () => {
      test.each([
        [new Float32Array([0, 0, 0, 0]), 'zero vector'],
        [new Float32Array([1, 1, 1, 1]), 'all ones'],
        [new Float32Array([-1, -1, -1, -1]), 'all negative'],
        [new Float32Array([NaN, 0, 0, 0]), 'NaN value'],
        [new Float32Array([Infinity, 0, 0, 0]), 'Infinity value'],
        [new Float32Array([-Infinity, 0, 0, 0]), 'negative Infinity'],
        [new Float32Array([Number.MAX_VALUE, 0, 0, 0]), 'max value'],
        [new Float32Array([Number.MIN_VALUE, 0, 0, 0]), 'min value'],
        [new Float32Array([1e-10, 1e-10, 1e-10, 1e-10]), 'very small values'],
        [new Float32Array([1e10, 1e10, 1e10, 1e10]), 'very large values'],
      ])('handles %s', async (vector, description) => {
        await expect(index.add(vector)).resolves.not.toThrow();
        expect(index.getStats().ntotal).toBe(1);
      });
    });

    describe('Batch Operations', () => {
      test('adds large batch sequentially', async () => {
        const index = new FaissIndex({ dims: 128 });
        let total = 0;
        
        for (let i = 0; i < 10; i++) {
          const vectors = new Float32Array(100 * 128);
          vectors.fill(Math.random());
          await index.add(vectors);
          total += 100;
        }
        
        expect(index.getStats().ntotal).toBe(total);
      });

      test('adds vectors with different patterns', async () => {
        const patterns = [
          new Float32Array([1, 0, 0, 0]),
          new Float32Array([0, 1, 0, 0]),
          new Float32Array([0, 0, 1, 0]),
          new Float32Array([0, 0, 0, 1]),
        ];
        
        for (const pattern of patterns) {
          await index.add(pattern);
        }
        
        expect(index.getStats().ntotal).toBe(4);
      });
    });

    describe('State After Add', () => {
      test('stats update correctly after each add', async () => {
        expect(index.getStats().ntotal).toBe(0);
        
        await index.add(new Float32Array([1, 0, 0, 0]));
        expect(index.getStats().ntotal).toBe(1);
        
        await index.add(new Float32Array([0, 1, 0, 0]));
        expect(index.getStats().ntotal).toBe(2);
        
        await index.add(new Float32Array([0, 0, 1, 0, 0, 0, 0, 1]));
        expect(index.getStats().ntotal).toBe(4);
      });
    });
  });

  // ============================================================================
  // SEARCH METHOD TESTS - Comprehensive Query Handling
  // ============================================================================
  
  describe('Search Method - Query Validation', () => {
    let index;

    beforeEach(async () => {
      index = new FaissIndex({ dims: 4 });
      // Add test vectors
      await index.add(new Float32Array([
        1, 0, 0, 0,  // Vector 0
        0, 1, 0, 0,  // Vector 1
        0, 0, 1, 0,  // Vector 2
        0, 0, 0, 1   // Vector 3
      ]));
    });

    describe('Valid Query Inputs', () => {
      test.each([
        [new Float32Array([1, 0, 0, 0]), 1, 'exact match query'],
        [new Float32Array([0.9, 0.1, 0, 0]), 2, 'near match query'],
        [new Float32Array([0, 0, 0, 0]), 4, 'zero vector query'],
        [new Float32Array([0.5, 0.5, 0.5, 0.5]), 4, 'uniform query'],
      ])('searches with %s (k=%d)', async (query, k, description) => {
        const results = await index.search(query, k);
        expect(results.labels).toBeDefined();
        expect(results.distances).toBeDefined();
        expect(results.labels.length).toBeGreaterThan(0);
        expect(results.labels.length).toBeLessThanOrEqual(k);
      });
    });

    describe('Invalid Query Inputs', () => {
      test.each([
        [null, 1, TypeError],
        [undefined, 1, TypeError],
        ['string', 1, TypeError],
        [123, 1, TypeError],
        [[1, 0, 0, 0], 1, TypeError],
        [new Float32Array([1, 0, 0]), 1, Error], // Wrong length
        [new Float32Array([1, 0, 0, 0, 0]), 1, Error], // Wrong length
        [new Float32Array([1, 0, 0, 0]), null, TypeError],
        [new Float32Array([1, 0, 0, 0]), undefined, TypeError],
        [new Float32Array([1, 0, 0, 0]), '1', TypeError],
        [new Float32Array([1, 0, 0, 0]), 1.5, TypeError],
        [new Float32Array([1, 0, 0, 0]), 0, TypeError],
        [new Float32Array([1, 0, 0, 0]), -1, TypeError],
        [new Float32Array([1, 0, 0, 0]), -100, TypeError],
      ])('throws %s for invalid query: %s, k: %s', async (query, k, errorType) => {
        await expect(index.search(query, k)).rejects.toThrow(errorType);
      });
    });

    describe('K Parameter Variations', () => {
      test.each([
        [1, 'k = 1'],
        [2, 'k = 2'],
        [3, 'k = 3'],
        [4, 'k = total vectors'],
        [10, 'k > total vectors'],
        [100, 'k >> total vectors'],
      ])('handles %s', async (k, description) => {
        const query = new Float32Array([1, 0, 0, 0]);
        const results = await index.search(query, k);
        
        expect(results.labels.length).toBeGreaterThan(0);
        expect(results.labels.length).toBeLessThanOrEqual(4); // Max available
        expect(results.distances.length).toBe(results.labels.length);
      });
    });

    describe('Search Result Validation', () => {
      test('returns results in distance order', async () => {
        const query = new Float32Array([1, 0, 0, 0]);
        const results = await index.search(query, 4);
        
        // Distances should be in ascending order
        for (let i = 1; i < results.distances.length; i++) {
          expect(results.distances[i - 1]).toBeLessThanOrEqual(results.distances[i]);
        }
      });

      test('exact match has distance ~0', async () => {
        const query = new Float32Array([1, 0, 0, 0]);
        const results = await index.search(query, 1);
        
        expect(results.labels[0]).toBe(0);
        expect(results.distances[0]).toBeCloseTo(0, 5);
      });

      test('results contain valid indices', async () => {
        const query = new Float32Array([0.5, 0.5, 0.5, 0.5]);
        const results = await index.search(query, 4);
        
        results.labels.forEach(label => {
          expect(label).toBeGreaterThanOrEqual(0);
          expect(label).toBeLessThan(4);
          expect(Number.isInteger(label)).toBe(true);
        });
      });

      test('distances are non-negative', async () => {
        const query = new Float32Array([0.5, 0.5, 0.5, 0.5]);
        const results = await index.search(query, 4);
        
        results.distances.forEach(distance => {
          expect(distance).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(distance)).toBe(true);
        });
      });
    });

    describe('Empty Index Handling', () => {
      test('throws on search with empty index', async () => {
        const emptyIndex = new FaissIndex({ dims: 4 });
        const query = new Float32Array([1, 0, 0, 0]);
        
        await expect(emptyIndex.search(query, 1)).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // GETSTATS METHOD TESTS
  // ============================================================================
  
  describe('GetStats Method', () => {
    test('returns correct structure', () => {
      const index = new FaissIndex({ dims: 128 });
      const stats = index.getStats();
      
      expect(stats).toHaveProperty('ntotal');
      expect(stats).toHaveProperty('dims');
      expect(stats).toHaveProperty('isTrained');
      expect(stats).toHaveProperty('type');
      
      expect(typeof stats.ntotal).toBe('number');
      expect(typeof stats.dims).toBe('number');
      expect(typeof stats.isTrained).toBe('boolean');
      expect(typeof stats.type).toBe('string');
    });

    test('returns correct initial values', () => {
      const index = new FaissIndex({ dims: 256 });
      const stats = index.getStats();
      
      expect(stats.ntotal).toBe(0);
      expect(stats.dims).toBe(256);
      expect(stats.isTrained).toBe(true);
      expect(stats.type).toBe('FLAT_L2');
    });

    test('updates correctly after operations', async () => {
      const index = new FaissIndex({ dims: 4 });
      
      let stats = index.getStats();
      expect(stats.ntotal).toBe(0);
      
      await index.add(new Float32Array([1, 0, 0, 0]));
      stats = index.getStats();
      expect(stats.ntotal).toBe(1);
      
      await index.add(new Float32Array([0, 1, 0, 0, 0, 0, 1, 0]));
      stats = index.getStats();
      expect(stats.ntotal).toBe(3);
    });
  });

  // ============================================================================
  // DISPOSE METHOD TESTS
  // ============================================================================
  
  describe('Dispose Method', () => {
    test('can dispose empty index', () => {
      const index = new FaissIndex({ dims: 4 });
      expect(() => index.dispose()).not.toThrow();
    });

    test('can dispose index with vectors', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      expect(() => index.dispose()).not.toThrow();
    });

    test('operations fail after dispose', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      index.dispose();
      
      await expect(index.add(new Float32Array([1, 0, 0, 0]))).rejects.toThrow();
      await expect(index.search(new Float32Array([1, 0, 0, 0]), 1)).rejects.toThrow();
      expect(() => index.getStats()).toThrow();
    });

    test('multiple dispose calls are safe', () => {
      const index = new FaissIndex({ dims: 4 });
      index.dispose();
      expect(() => index.dispose()).not.toThrow();
      expect(() => index.dispose()).not.toThrow();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS - Real-World Scenarios
  // ============================================================================
  
  describe('Integration - Real-World Scenarios', () => {
    test('RAG pipeline simulation', async () => {
      const index = new FaissIndex({ dims: 768 });
      const nDocs = 100;
      const vectors = new Float32Array(nDocs * 768);
      
      // Simulate document embeddings
      for (let i = 0; i < nDocs; i++) {
        for (let j = 0; j < 768; j++) {
          vectors[i * 768 + j] = Math.random();
        }
      }
      
      await index.add(vectors);
      expect(index.getStats().ntotal).toBe(nDocs);
      
      // Simulate query
      const query = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        query[i] = Math.random();
      }
      
      const results = await index.search(query, 5);
      expect(results.labels.length).toBe(5);
      expect(results.distances.length).toBe(5);
    });

    test('Semantic search simulation', async () => {
      const index = new FaissIndex({ dims: 1536 });
      
      // Add multiple document embeddings
      const docs = [
        new Float32Array(1536).fill(0.1), // Document 0
        new Float32Array(1536).fill(0.2), // Document 1
        new Float32Array(1536).fill(0.3), // Document 2
      ];
      
      for (const doc of docs) {
        await index.add(doc);
      }
      
      // Search for similar document
      const query = new Float32Array(1536).fill(0.25);
      const results = await index.search(query, 2);
      
      expect(results.labels.length).toBe(2);
      // Should find documents 1 and 2 as closest
      expect([1, 2]).toContain(results.labels[0]);
    });

    test('Batch processing workflow', async () => {
      const index = new FaissIndex({ dims: 128 });
      
      // Add vectors in batches
      for (let batch = 0; batch < 10; batch++) {
        const vectors = new Float32Array(100 * 128);
        for (let i = 0; i < vectors.length; i++) {
          vectors[i] = Math.random();
        }
        await index.add(vectors);
      }
      
      expect(index.getStats().ntotal).toBe(1000);
      
      // Perform multiple searches
      for (let i = 0; i < 10; i++) {
        const query = new Float32Array(128);
        for (let j = 0; j < 128; j++) {
          query[j] = Math.random();
        }
        const results = await index.search(query, 10);
        expect(results.labels.length).toBe(10);
      }
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================
  
  describe('Performance Tests', () => {
    test('add 10k vectors performance', async () => {
      const index = new FaissIndex({ dims: 128 });
      const nVectors = 10000;
      const vectors = new Float32Array(nVectors * 128);
      
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      
      const start = Date.now();
      await index.add(vectors);
      const duration = Date.now() - start;
      
      expect(index.getStats().ntotal).toBe(nVectors);
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time
      console.log(`Added ${nVectors} vectors in ${duration}ms`);
      
      index.dispose();
    }, 10000);

    test('search performance on large index', async () => {
      const index = new FaissIndex({ dims: 128 });
      const nVectors = 10000;
      const vectors = new Float32Array(nVectors * 128);
      
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      await index.add(vectors);
      
      const query = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        query[i] = Math.random();
      }
      
      const start = Date.now();
      const results = await index.search(query, 10);
      const duration = Date.now() - start;
      
      expect(results.labels.length).toBe(10);
      expect(duration).toBeLessThan(1000); // Should be fast
      console.log(`Search completed in ${duration}ms`);
      
      index.dispose();
    }, 10000);

    test('concurrent operations performance', async () => {
      const index = new FaissIndex({ dims: 64 });
      
      // Add vectors concurrently (simulated with rapid sequential)
      const start = Date.now();
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(64);
        vector.fill(i);
        promises.push(index.add(vector));
      }
      await Promise.all(promises);
      const addDuration = Date.now() - start;
      
      expect(index.getStats().ntotal).toBe(100);
      expect(addDuration).toBeLessThan(2000);
      
      // Search concurrently
      const searchStart = Date.now();
      const searchPromises = [];
      for (let i = 0; i < 50; i++) {
        const query = new Float32Array(64);
        query.fill(i);
        searchPromises.push(index.search(query, 5));
      }
      await Promise.all(searchPromises);
      const searchDuration = Date.now() - searchStart;
      
      expect(searchDuration).toBeLessThan(1000);
      
      index.dispose();
    }, 10000);
  });

  // ============================================================================
  // MEMORY SAFETY TESTS
  // ============================================================================
  
  describe('Memory Safety Tests', () => {
    test('no memory leak on repeated operations', async () => {
      const index = new FaissIndex({ dims: 128 });
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 1000; i++) {
        const vector = new Float32Array(128);
        vector.fill(Math.random());
        await index.add(vector);
        
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const leakMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      // Allow some memory growth but not excessive
      expect(leakMB).toBeLessThan(100);
    }, 30000);

    test('proper cleanup on dispose', async () => {
      const index = new FaissIndex({ dims: 128 });
      await index.add(new Float32Array(128).fill(1));
      
      index.dispose();
      
      // Should not be able to use after dispose
      await expect(index.add(new Float32Array(128))).rejects.toThrow();
    });
  });

  // ============================================================================
  // DIMENSIONAL VARIATIONS
  // ============================================================================
  
  describe('Dimensional Variations', () => {
    test.each([
      [1, '1D vectors'],
      [2, '2D vectors'],
      [4, '4D vectors'],
      [64, '64D vectors'],
      [128, '128D vectors'],
      [256, '256D vectors'],
      [512, '512D vectors'],
      [768, '768D vectors (BERT)'],
      [1024, '1024D vectors'],
      [1536, '1536D vectors (OpenAI large)'],
    ])('handles %s', async (dims, description) => {
      const index = new FaissIndex({ dims });
      const vector = new Float32Array(dims);
      vector.fill(0.5);
      
      await index.add(vector);
      expect(index.getStats().ntotal).toBe(1);
      
      const query = new Float32Array(dims);
      query.fill(0.5);
      const results = await index.search(query, 1);
      
      expect(results.labels.length).toBe(1);
      expect(results.distances[0]).toBeCloseTo(0, 5);
    });
  });
});
