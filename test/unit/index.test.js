const { FaissIndex } = require('../../src/js/index');

describe('FaissIndex', () => {
  describe('constructor', () => {
    test('creates index with valid config', () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
      expect(index).toBeDefined();
      expect(index.getStats().dims).toBe(128);
      expect(index.getStats().type).toBe('FLAT_L2');
    });
    
    test('throws on invalid dimensions', () => {
      expect(() => {
        new FaissIndex({ type: 'FLAT_L2', dims: -1 });
      }).toThrow();
      
      expect(() => {
        new FaissIndex({ type: 'FLAT_L2', dims: 0 });
      }).toThrow();
    });
    
    test('throws on missing dims', () => {
      expect(() => {
        new FaissIndex({ type: 'FLAT_L2' });
      }).toThrow();
    });
    
    test('throws on unsupported index type', () => {
      expect(() => {
        new FaissIndex({ type: 'INVALID_TYPE', dims: 128 });
      }).toThrow(/not supported/);
    });
    
    test('creates HNSW index', () => {
      const index = new FaissIndex({ type: 'HNSW', dims: 128 });
      expect(index).toBeDefined();
    });
    
    test('creates IVF_FLAT index', () => {
      const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 100 });
      expect(index).toBeDefined();
    });
  });
  
  describe('add', () => {
    test('adds single vector', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const vector = new Float32Array([1, 0, 0, 0]);
      
      await index.add(vector);
      
      const stats = index.getStats();
      expect(stats.ntotal).toBe(1);
    });
    
    test('adds batch of vectors', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      
      await index.add(vectors);
      
      const stats = index.getStats();
      expect(stats.ntotal).toBe(4);
    });
    
    test('throws on wrong vector dimensions', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const vector = new Float32Array([1, 0, 0]); // Wrong size
      
      await expect(index.add(vector)).rejects.toThrow();
    });
    
    test('throws on empty vector array', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const vector = new Float32Array([]);
      
      await expect(index.add(vector)).rejects.toThrow();
    });
  });
  
  describe('search', () => {
    test('searches and returns nearest neighbor', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,  // Vector 0
        0, 1, 0, 0,  // Vector 1
        0, 0, 1, 0,  // Vector 2
        0, 0, 0, 1   // Vector 3
      ]);
      
      await index.add(vectors);
      
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index.search(query, 1);
      
      expect(results.labels.length).toBe(1);
      expect(results.distances.length).toBe(1);
      expect(results.labels[0]).toBe(0); // Should match vector 0
      expect(results.distances[0]).toBeCloseTo(0, 5); // Distance should be ~0
    });
    
    test('searches and returns k nearest neighbors', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      
      await index.add(vectors);
      
      const query = new Float32Array([0.9, 0.1, 0, 0]);
      const results = await index.search(query, 3);
      
      expect(results.labels.length).toBe(3);
      expect(results.distances.length).toBe(3);
      // First result should be closest (vector 0)
      expect(results.labels[0]).toBe(0);
      // Distances should be in ascending order
      expect(results.distances[0]).toBeLessThanOrEqual(results.distances[1]);
      expect(results.distances[1]).toBeLessThanOrEqual(results.distances[2]);
    });
    
    test('throws on wrong query dimensions', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const query = new Float32Array([1, 0, 0]); // Wrong size
      
      await expect(index.search(query, 1)).rejects.toThrow();
    });
    
    test('throws on empty index', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const query = new Float32Array([1, 0, 0, 0]);
      
      await expect(index.search(query, 1)).rejects.toThrow();
    });
    
    test('throws on invalid k', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      const vectors = new Float32Array([1, 0, 0, 0]);
      await index.add(vectors);
      
      const query = new Float32Array([1, 0, 0, 0]);
      
      await expect(index.search(query, 0)).rejects.toThrow();
      await expect(index.search(query, -1)).rejects.toThrow();
    });
  });
  
  describe('getStats', () => {
    test('returns correct statistics', () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
      const stats = index.getStats();
      
      expect(stats).toHaveProperty('ntotal');
      expect(stats).toHaveProperty('dims');
      expect(stats).toHaveProperty('isTrained');
      expect(stats).toHaveProperty('type');
      
      expect(stats.dims).toBe(128);
      expect(stats.type).toBe('FLAT_L2');
      expect(stats.ntotal).toBe(0); // Initially empty
      expect(stats.isTrained).toBe(true); // FLAT_L2 doesn't need training
    });
  });
  
  describe('dispose', () => {
    test('disposes index without error', () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
      expect(() => index.dispose()).not.toThrow();
    });
    
    test('throws after dispose', async () => {
      const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
      index.dispose();
      
      const query = new Float32Array([1, 0, 0, 0]);
      await expect(index.search(query, 1)).rejects.toThrow();
    });
  });
});

// Helper function to normalize vectors (L2 normalization)
function normalizeL2(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
}

describe('FLAT_IP Index', () => {
  it('should create FLAT_IP index', () => {
    const index = new FaissIndex({ type: 'FLAT_IP', dims: 4 });
    expect(index).toBeDefined();
    const stats = index.getStats();
    expect(stats.dims).toBe(4);
  });

  it('should search with normalized vectors (cosine similarity)', async () => {
    const index = new FaissIndex({ type: 'FLAT_IP', dims: 4 });
    const vectors = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0]
    ];
    // Normalize vectors
    const normalized = vectors.map(v => normalizeL2(v));
    const vectorsArray = new Float32Array(normalized.flat());
    await index.add(vectorsArray);
    
    const query = normalizeL2([1, 0, 0, 0]);
    const results = await index.search(new Float32Array(query), 2);
    expect(results.labels.length).toBe(2);
    // Higher inner product = more similar (cosine similarity)
    expect(results.distances[0]).toBeGreaterThan(results.distances[1]);
  });
});

describe('Range Search', () => {
  it('should find vectors within radius', async () => {
    const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
    const vectors = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
    await index.add(vectors);
    
    const query = new Float32Array([1, 0, 0, 0]);
    const results = await index.rangeSearch(query, 2.0);
    expect(results.nq).toBe(1);
    expect(results.lims.length).toBe(2);
    expect(results.lims[0]).toBe(0);
    expect(results.lims[1]).toBeGreaterThan(0);
    expect(results.distances.length).toBe(results.labels.length);
  });
});

describe('Reset Method', () => {
  it('should clear all vectors', async () => {
    const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
    const vectors = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);
    await index.add(vectors);
    expect(index.getStats().ntotal).toBe(2);
    
    index.reset();
    expect(index.getStats().ntotal).toBe(0);
    
    // Should be able to add vectors again
    await index.add(vectors);
    expect(index.getStats().ntotal).toBe(2);
  });
});
