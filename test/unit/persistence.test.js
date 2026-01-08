const { FaissIndex } = require('../../src/js/index');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('FaissIndex - Persistence (Save/Load)', () => {
  const testDir = path.join(os.tmpdir(), 'faiss-node-test');
  
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    // Clean up test files
    const files = fs.readdirSync(testDir);
    files.forEach(file => {
      if (file.endsWith('.faiss')) {
        fs.unlinkSync(path.join(testDir, file));
      }
    });
  });
  
  describe('save', () => {
    test('saves index to file', async () => {
      const index = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0
      ]);
      await index.add(vectors);
      
      const filename = path.join(testDir, 'test-save.faiss');
      await index.save(filename);
      
      expect(fs.existsSync(filename)).toBe(true);
      expect(fs.statSync(filename).size).toBeGreaterThan(0);
    });
    
    test('throws on invalid filename', async () => {
      const index = new FaissIndex({ dims: 4 });
      
      await expect(index.save(null)).rejects.toThrow();
      await expect(index.save('')).rejects.toThrow();
      await expect(index.save(123)).rejects.toThrow();
    });
    
    test('throws on save after dispose', async () => {
      const index = new FaissIndex({ dims: 4 });
      index.dispose();
      
      const filename = path.join(testDir, 'test-disposed.faiss');
      await expect(index.save(filename)).rejects.toThrow();
    });
  });
  
  describe('load', () => {
    test('loads index from file', async () => {
      // Create and save index
      const index1 = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0
      ]);
      await index1.add(vectors);
      
      const filename = path.join(testDir, 'test-load.faiss');
      await index1.save(filename);
      
      // Load index
      const index2 = await FaissIndex.load(filename);
      
      expect(index2.getStats().dims).toBe(4);
      expect(index2.getStats().ntotal).toBe(3);
      expect(index2.getStats().type).toBe('FLAT_L2');
      
      // Verify search works
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index2.search(query, 1);
      expect(results.labels[0]).toBe(0);
    });
    
    test('loaded index maintains all vectors', async () => {
      const index1 = new FaissIndex({ dims: 128 });
      const nVectors = 100;
      const vectors = new Float32Array(nVectors * 128);
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      await index1.add(vectors);
      
      const filename = path.join(testDir, 'test-large.faiss');
      await index1.save(filename);
      
      const index2 = await FaissIndex.load(filename);
      expect(index2.getStats().ntotal).toBe(nVectors);
    });
    
    test('throws on invalid filename', async () => {
      await expect(FaissIndex.load(null)).rejects.toThrow();
      await expect(FaissIndex.load('')).rejects.toThrow();
      await expect(FaissIndex.load('nonexistent.faiss')).rejects.toThrow();
    });
  });
  
  describe('toBuffer / fromBuffer', () => {
    test('serializes and deserializes index', async () => {
      const index1 = new FaissIndex({ dims: 4 });
      const vectors = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0
      ]);
      await index1.add(vectors);
      
      // Serialize
      const buffer = await index1.toBuffer();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      
      // Deserialize
      const index2 = await FaissIndex.fromBuffer(buffer);
      
      expect(index2.getStats().dims).toBe(4);
      expect(index2.getStats().ntotal).toBe(2);
      
      // Verify search works
      const query = new Float32Array([1, 0, 0, 0]);
      const results = await index2.search(query, 1);
      expect(results.labels[0]).toBe(0);
    });
    
    test('serialized index maintains all vectors', async () => {
      const index1 = new FaissIndex({ dims: 64 });
      const nVectors = 50;
      const vectors = new Float32Array(nVectors * 64);
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      await index1.add(vectors);
      
      const buffer = await index1.toBuffer();
      const index2 = await FaissIndex.fromBuffer(buffer);
      
      expect(index2.getStats().ntotal).toBe(nVectors);
    });
    
    test('throws on invalid buffer', async () => {
      await expect(FaissIndex.fromBuffer(null)).rejects.toThrow();
      await expect(FaissIndex.fromBuffer('string')).rejects.toThrow();
      await expect(FaissIndex.fromBuffer(Buffer.from('invalid'))).rejects.toThrow();
    });
    
    test('throws on toBuffer after dispose', async () => {
      const index = new FaissIndex({ dims: 4 });
      index.dispose();
      
      await expect(index.toBuffer()).rejects.toThrow();
    });
  });
  
  describe('round-trip persistence', () => {
    test('save -> load maintains data integrity', async () => {
      const original = new FaissIndex({ dims: 128 });
      const vectors = new Float32Array(10 * 128);
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      await original.add(vectors);
      
      const filename = path.join(testDir, 'roundtrip.faiss');
      await original.save(filename);
      
      const loaded = await FaissIndex.load(filename);
      
      // Compare stats
      const origStats = original.getStats();
      const loadedStats = loaded.getStats();
      
      expect(loadedStats.dims).toBe(origStats.dims);
      expect(loadedStats.ntotal).toBe(origStats.ntotal);
      expect(loadedStats.type).toBe(origStats.type);
      
      // Compare search results
      const query = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        query[i] = Math.random();
      }
      
      const origResults = await original.search(query, 5);
      const loadedResults = await loaded.search(query, 5);
      
      expect(origResults.labels).toEqual(loadedResults.labels);
      expect(origResults.distances.length).toBe(loadedResults.distances.length);
    });
    
    test('toBuffer -> fromBuffer maintains data integrity', async () => {
      const original = new FaissIndex({ dims: 64 });
      const vectors = new Float32Array(20 * 64);
      for (let i = 0; i < vectors.length; i++) {
        vectors[i] = Math.random();
      }
      await original.add(vectors);
      
      const buffer = await original.toBuffer();
      const deserialized = await FaissIndex.fromBuffer(buffer);
      
      // Compare stats
      const origStats = original.getStats();
      const deserStats = deserialized.getStats();
      
      expect(deserStats.dims).toBe(origStats.dims);
      expect(deserStats.ntotal).toBe(origStats.ntotal);
      
      // Compare search results
      const query = new Float32Array(64);
      for (let i = 0; i < 64; i++) {
        query[i] = Math.random();
      }
      
      const origResults = await original.search(query, 3);
      const deserResults = await deserialized.search(query, 3);
      
      expect(origResults.labels).toEqual(deserResults.labels);
    });
  });
});
