const { FaissIndex } = require('../../src/js/index');

describe('FaissIndex - Merge From', () => {
  const dims = 4;
  
  describe('Basic Merge', () => {
    test('merges vectors from another index', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      
      // Add vectors to index1
      await index1.add(new Float32Array([
        1, 0, 0, 0,  // Vector 0
        0, 1, 0, 0   // Vector 1
      ]));
      
      // Add vectors to index2
      await index2.add(new Float32Array([
        0, 0, 1, 0,  // Vector 0
        0, 0, 0, 1   // Vector 1
      ]));
      
      expect(index1.getStats().ntotal).toBe(2);
      expect(index2.getStats().ntotal).toBe(2);
      
      // Merge index2 into index1
      // Note: FAISS merge_from MOVES vectors (source index becomes empty)
      await index1.mergeFrom(index2);
      
      expect(index1.getStats().ntotal).toBe(4);
      expect(index2.getStats().ntotal).toBe(0); // index2 is emptied by merge_from
      
      // Verify all vectors are searchable
      const query = new Float32Array([0, 0, 1, 0]);
      const results = await index1.search(query, 1);
      expect(results.labels[0]).toBe(2); // Should match vector from index2
      
      index1.dispose();
      index2.dispose();
    });

    test('merges empty index (no-op)', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      
      await index1.add(new Float32Array([1, 0, 0, 0]));
      
      await index1.mergeFrom(index2); // Merge empty index
      
      expect(index1.getStats().ntotal).toBe(1); // Unchanged
      
      index1.dispose();
      index2.dispose();
    });

    test('merges into empty index', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      
      await index2.add(new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0
      ]));
      
      await index1.mergeFrom(index2);
      
      expect(index1.getStats().ntotal).toBe(2);
      
      index1.dispose();
      index2.dispose();
    });
  });

  describe('Input Validation', () => {
    test('throws on null/undefined otherIndex', async () => {
      const index = new FaissIndex({ dims });
      
      await expect(index.mergeFrom(null)).rejects.toThrow(TypeError);
      await expect(index.mergeFrom(undefined)).rejects.toThrow(TypeError);
      
      index.dispose();
    });

    test('throws on invalid otherIndex type', async () => {
      const index = new FaissIndex({ dims });
      
      await expect(index.mergeFrom({})).rejects.toThrow();
      await expect(index.mergeFrom('not an index')).rejects.toThrow();
      await expect(index.mergeFrom(123)).rejects.toThrow();
      
      index.dispose();
    });

    test('throws on dimension mismatch', async () => {
      const index1 = new FaissIndex({ dims: 4 });
      const index2 = new FaissIndex({ dims: 8 });
      
      await index2.add(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]));
      
      await expect(index1.mergeFrom(index2)).rejects.toThrow(/dimensions/);
      
      index1.dispose();
      index2.dispose();
    });

    test('throws on disposed this index', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      
      index1.dispose();
      
      await expect(index1.mergeFrom(index2)).rejects.toThrow(/disposed/);
      
      index2.dispose();
    });

    test('throws on disposed other index', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      
      index2.dispose();
      
      await expect(index1.mergeFrom(index2)).rejects.toThrow();
      
      index1.dispose();
    });
  });

  describe('Merge Behavior', () => {
    test('preserves vector order', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      
      await index1.add(new Float32Array([
        1, 0, 0, 0,  // Will be at index 0
        0, 1, 0, 0   // Will be at index 1
      ]));
      
      await index2.add(new Float32Array([
        0, 0, 1, 0,  // Will be at index 2
        0, 0, 0, 1   // Will be at index 3
      ]));
      
      await index1.mergeFrom(index2);
      
      // Verify order: original vectors first, then merged vectors
      const query1 = new Float32Array([1, 0, 0, 0]);
      const results1 = await index1.search(query1, 1);
      expect(results1.labels[0]).toBe(0);
      
      const query2 = new Float32Array([0, 0, 1, 0]);
      const results2 = await index1.search(query2, 1);
      expect(results2.labels[0]).toBe(2); // Merged vector
      
      index1.dispose();
      index2.dispose();
    });

    test('can merge multiple times', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      const index3 = new FaissIndex({ dims });
      
      await index1.add(new Float32Array([1, 0, 0, 0]));
      await index2.add(new Float32Array([0, 1, 0, 0]));
      await index3.add(new Float32Array([0, 0, 1, 0]));
      
      await index1.mergeFrom(index2);
      expect(index1.getStats().ntotal).toBe(2);
      
      await index1.mergeFrom(index3);
      expect(index1.getStats().ntotal).toBe(3);
      
      index1.dispose();
      index2.dispose();
      index3.dispose();
    });

    test('merge_from empties source index (FAISS behavior)', async () => {
      const index1 = new FaissIndex({ dims });
      const index2 = new FaissIndex({ dims });
      
      await index1.add(new Float32Array([1, 0, 0, 0]));
      await index2.add(new Float32Array([0, 1, 0, 0]));
      
      expect(index1.getStats().ntotal).toBe(1);
      expect(index2.getStats().ntotal).toBe(1);
      
      // FAISS merge_from MOVES vectors (source becomes empty)
      await index1.mergeFrom(index2);
      expect(index1.getStats().ntotal).toBe(2);
      expect(index2.getStats().ntotal).toBe(0); // Source is emptied
      
      // Merging from empty index is a no-op (doesn't throw)
      await index1.mergeFrom(index2);
      expect(index1.getStats().ntotal).toBe(2); // Unchanged
      
      index1.dispose();
      index2.dispose();
    });
  });

  describe('Large Scale Merge', () => {
    test('merges large indexes', async () => {
      const index1 = new FaissIndex({ dims: 128 });
      const index2 = new FaissIndex({ dims: 128 });
      
      // Add 1000 vectors to each
      const vectors1 = new Float32Array(1000 * 128);
      const vectors2 = new Float32Array(1000 * 128);
      
      for (let i = 0; i < 1000 * 128; i++) {
        vectors1[i] = Math.random();
        vectors2[i] = Math.random();
      }
      
      await index1.add(vectors1);
      await index2.add(vectors2);
      
      expect(index1.getStats().ntotal).toBe(1000);
      expect(index2.getStats().ntotal).toBe(1000);
      
      await index1.mergeFrom(index2);
      
      expect(index1.getStats().ntotal).toBe(2000);
      
      // Verify search still works
      const query = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        query[i] = Math.random();
      }
      const results = await index1.search(query, 5);
      expect(results.labels.length).toBe(5);
      
      index1.dispose();
      index2.dispose();
    });
  });
});
