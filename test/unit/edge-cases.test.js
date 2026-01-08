const { FaissIndex } = require('../../src/js/index');

describe('FaissIndex - Edge Cases', () => {
  describe('Constructor Edge Cases', () => {
    test('throws on null config', () => {
      expect(() => {
        new FaissIndex(null);
      }).toThrow(TypeError);
    });

    test('throws on undefined config', () => {
      expect(() => {
        new FaissIndex(undefined);
      }).toThrow(TypeError);
    });

    test('throws on non-object config', () => {
      expect(() => {
        new FaissIndex('invalid');
      }).toThrow(TypeError);
      
      expect(() => {
        new FaissIndex(123);
      }).toThrow(TypeError);
      
      expect(() => {
        new FaissIndex([]);
      }).toThrow(TypeError);
    });

    test('throws on float dimensions', () => {
      expect(() => {
        new FaissIndex({ dims: 128.5 });
      }).toThrow(TypeError);
    });

    test('throws on very large dimensions', () => {
      expect(() => {
        new FaissIndex({ dims: Number.MAX_SAFE_INTEGER });
      }).toThrow(); // Should fail at C++ level or throw error
    });

    test('throws on string number for dims', () => {
      expect(() => {
        new FaissIndex({ dims: '128' });
      }).toThrow(TypeError);
    });

    test('works with missing type (defaults to FLAT_L2)', () => {
      const index = new FaissIndex({ dims: 128 });
      expect(index.getStats().type).toBe('FLAT_L2');
    });

    test('works with dims = 1', () => {
      const index = new FaissIndex({ dims: 1 });
      expect(index.getStats().dims).toBe(1);
    });

    test('works with large but reasonable dims', () => {
      const index = new FaissIndex({ dims: 4096 });
      expect(index.getStats().dims).toBe(4096);
    });
  });

  describe('Add Edge Cases', () => {
    test('throws on null vectors', async () => {
      const index = new FaissIndex({ dims: 4 });
      await expect(index.add(null)).rejects.toThrow(TypeError);
    });

    test('throws on undefined vectors', async () => {
      const index = new FaissIndex({ dims: 4 });
      await expect(index.add(undefined)).rejects.toThrow(TypeError);
    });

    test('throws on non-Float32Array inputs', async () => {
      const index = new FaissIndex({ dims: 4 });
      
      await expect(index.add([1, 2, 3, 4])).rejects.toThrow(TypeError);
      await expect(index.add('invalid')).rejects.toThrow(TypeError);
      await expect(index.add(123)).rejects.toThrow(TypeError);
      await expect(index.add({})).rejects.toThrow(TypeError);
      await expect(index.add(new Array(4))).rejects.toThrow(TypeError);
      await expect(index.add(new Int32Array([1, 2, 3, 4]))).rejects.toThrow(TypeError);
    });

    test('throws on vectors with partial dimension', async () => {
      const index = new FaissIndex({ dims: 4 });
      
      // 5 elements, not a multiple of 4
      await expect(index.add(new Float32Array([1, 2, 3, 4, 5]))).rejects.toThrow();
      
      // 7 elements
      await expect(index.add(new Float32Array([1, 2, 3, 4, 5, 6, 7]))).rejects.toThrow();
    });

    test('handles vectors with NaN values', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([NaN, 0, 0, 0]);
      
      // Should not throw, but behavior may be undefined
      await expect(index.add(vectors)).resolves.not.toThrow();
    });

    test('handles vectors with Infinity values', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([Infinity, 0, 0, 0]);
      
      await expect(index.add(vectors)).resolves.not.toThrow();
    });

    test('handles vectors with very large values', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        Number.MAX_VALUE,
        -Number.MAX_VALUE,
        0,
        0
      ]);
      
      await expect(index.add(vectors)).resolves.not.toThrow();
    });

    test('handles vectors with very small values', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        Number.MIN_VALUE,
        -Number.MIN_VALUE,
        0,
        0
      ]);
      
      await expect(index.add(vectors)).resolves.not.toThrow();
    });

    test('handles single element vector (dims=1)', async () => {
      const index = new FaissIndex({ dims: 1 });
      const vector = new Float32Array([42]);
      
      await index.add(vector);
      expect(index.getStats().ntotal).toBe(1);
    });

    test('handles very large batch', async () => {
      const index = new FaissIndex({ dims: 128 });
      const nVectors = 10000;
      const vectors = new Float32Array(nVectors * 128);
      
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      
      await index.add(vectors);
      expect(index.getStats().ntotal).toBe(nVectors);
    });

    test('handles multiple sequential adds', async () => {
      const index = new FaissIndex({ dims: 4 });
      
      await index.add(new Float32Array([1, 0, 0, 0]));
      expect(index.getStats().ntotal).toBe(1);
      
      await index.add(new Float32Array([0, 1, 0, 0]));
      expect(index.getStats().ntotal).toBe(2);
      
      await index.add(new Float32Array([0, 0, 1, 0, 0, 0, 0, 1])); // 2 vectors
      expect(index.getStats().ntotal).toBe(4);
    });

    test('throws on add after dispose', async () => {
      const index = new FaissIndex({ dims: 4 });
      index.dispose();
      
      await expect(index.add(new Float32Array([1, 0, 0, 0]))).rejects.toThrow();
    });

    test('handles zero vector', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vector = new Float32Array([0, 0, 0, 0]);
      
      await index.add(vector);
      expect(index.getStats().ntotal).toBe(1);
    });

    test('handles identical vectors', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vector = new Float32Array([1, 2, 3, 4]);
      
      await index.add(vector);
      await index.add(vector);
      await index.add(vector);
      
      expect(index.getStats().ntotal).toBe(3);
    });
  });

  describe('Search Edge Cases', () => {
    test('throws on null query', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      await expect(index.search(null, 1)).rejects.toThrow(TypeError);
    });

    test('throws on undefined query', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      await expect(index.search(undefined, 1)).rejects.toThrow(TypeError);
    });

    test('throws on non-Float32Array query', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      await expect(index.search([1, 0, 0, 0], 1)).rejects.toThrow(TypeError);
      await expect(index.search('invalid', 1)).rejects.toThrow(TypeError);
      await expect(index.search(123, 1)).rejects.toThrow(TypeError);
    });

    test('handles query with NaN values', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      const query = new Float32Array([NaN, 0, 0, 0]);
      // Should not throw, but results may be undefined
      await expect(index.search(query, 1)).resolves.toBeDefined();
    });

    test('handles query with Infinity values', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      const query = new Float32Array([Infinity, 0, 0, 0]);
      await expect(index.search(query, 1)).resolves.toBeDefined();
    });

    test('handles k larger than available vectors', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index.search(query, 100);
      
      // Should return only available vectors (1)
      expect(results.labels.length).toBe(1);
      expect(results.distances.length).toBe(1);
    });

    test('handles k equal to total vectors', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0
      ]);
      await index.add(vectors);
      
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index.search(query, 3);
      
      expect(results.labels.length).toBe(3);
    });

    test('handles k = 1', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0
      ]);
      await index.add(vectors);
      
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index.search(query, 1);
      
      expect(results.labels.length).toBe(1);
      expect(results.distances.length).toBe(1);
    });

    test('throws on float k', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      const query = new Float32Array([1, 0, 0, 0]);
      await expect(index.search(query, 1.5)).rejects.toThrow(TypeError);
    });

    test('throws on string k', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      const query = new Float32Array([1, 0, 0, 0]);
      await expect(index.search(query, '1')).rejects.toThrow(TypeError);
    });

    test('handles search with zero vector query', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      
      const query = new Float32Array([0, 0, 0, 0]);
      const results = await index.search(query, 1);
      
      expect(results.labels.length).toBe(1);
      expect(results.distances.length).toBe(1);
    });

    test('handles multiple searches', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0
      ]);
      await index.add(vectors);
      
      const query1 = new Float32Array([1, 0, 0, 0]);
      const query2 = new Float32Array([0, 1, 0, 0]);
      
      const results1 = await index.search(query1, 1);
      const results2 = await index.search(query2, 1);
      
      expect(results1.labels[0]).toBe(0);
      expect(results2.labels[0]).toBe(1);
    });

    test('throws on search after dispose', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      index.dispose();
      
      const query = new Float32Array([1, 0, 0, 0]);
      await expect(index.search(query, 1)).rejects.toThrow();
    });

    test('handles search with identical query to stored vector', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vector = new Float32Array([1, 2, 3, 4]);
      await index.add(vector);
      
      const query = new Float32Array([1, 2, 3, 4]);
      const results = await index.search(query, 1);
      
      expect(results.labels[0]).toBe(0);
      expect(results.distances[0]).toBeCloseTo(0, 5);
    });

    test('handles search with orthogonal vectors', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      await index.add(vectors);
      
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index.search(query, 2);
      
      // First should be exact match (distance ~0)
      expect(results.labels[0]).toBe(0);
      expect(results.distances[0]).toBeCloseTo(0, 5);
      
      // Others should have distance > 0
      expect(results.distances[1]).toBeGreaterThan(0);
    });
  });

  describe('GetStats Edge Cases', () => {
    test('returns stats for empty index', () => {
      const index = new FaissIndex({ dims: 128 });
      const stats = index.getStats();
      
      expect(stats.ntotal).toBe(0);
      expect(stats.dims).toBe(128);
      expect(stats.isTrained).toBe(true);
    });

    test('returns updated stats after add', async () => {
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

    test('throws on getStats after dispose', () => {
      const index = new FaissIndex({ dims: 4 });
      index.dispose();
      
      expect(() => index.getStats()).toThrow();
    });
  });

  describe('Dispose Edge Cases', () => {
    test('can dispose multiple times safely', () => {
      const index = new FaissIndex({ dims: 4 });
      
      expect(() => index.dispose()).not.toThrow();
      expect(() => index.dispose()).not.toThrow();
      expect(() => index.dispose()).not.toThrow();
    });

    test('dispose after operations', async () => {
      const index = new FaissIndex({ dims: 4 });
      await index.add(new Float32Array([1, 0, 0, 0]));
      await index.search(new Float32Array([1, 0, 0, 0]), 1);
      
      expect(() => index.dispose()).not.toThrow();
    });
  });

  describe('High-Dimensional Edge Cases', () => {
    test('handles 1-dimensional vectors', async () => {
      const index = new FaissIndex({ dims: 1 });
      await index.add(new Float32Array([1]));
      await index.add(new Float32Array([2]));
      
      const results = await index.search(new Float32Array([1.1]), 1);
      expect(results.labels[0]).toBe(0);
    });

    test('handles 768-dimensional vectors (common embedding size)', async () => {
      const index = new FaissIndex({ dims: 768 });
      const vector = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        vector[i] = Math.random();
      }
      
      await index.add(vector);
      expect(index.getStats().ntotal).toBe(1);
      
      const query = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        query[i] = Math.random();
      }
      
      const results = await index.search(query, 1);
      expect(results.labels.length).toBe(1);
    });

    test('handles 1536-dimensional vectors (OpenAI large embedding)', async () => {
      const index = new FaissIndex({ dims: 1536 });
      const vector = new Float32Array(1536);
      vector.fill(0.1);
      
      await index.add(vector);
      expect(index.getStats().ntotal).toBe(1);
    });
  });

  describe('Concurrent Operations Edge Cases', () => {
    test('handles rapid sequential adds', async () => {
      const index = new FaissIndex({ dims: 4 });
      
      // Add vectors sequentially to avoid race conditions with async workers
      for (let i = 0; i < 100; i++) {
        await index.add(new Float32Array([i, 0, 0, 0]));
      }
      
      expect(index.getStats().ntotal).toBe(100);
    });

    test('handles rapid sequential searches', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array(100 * 4);
      for (let i = 0; i < 100; i++) {
        vectors[i * 4] = i;
        vectors[i * 4 + 1] = 0;
        vectors[i * 4 + 2] = 0;
        vectors[i * 4 + 3] = 0;
      }
      await index.add(vectors);
      
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(index.search(new Float32Array([i, 0, 0, 0]), 1));
      }
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(50);
      results.forEach((result, i) => {
        expect(result.labels.length).toBe(1);
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('handles large number of vectors', async () => {
      const index = new FaissIndex({ dims: 128 });
      const nVectors = 50000;
      const vectors = new Float32Array(nVectors * 128);
      
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      
      const start = Date.now();
      await index.add(vectors);
      const duration = Date.now() - start;
      
      expect(index.getStats().ntotal).toBe(nVectors);
      expect(duration).toBeLessThan(10000); // Should complete in reasonable time
    }, 30000);

    test('handles search on large index', async () => {
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
    }, 30000);
  });
});
