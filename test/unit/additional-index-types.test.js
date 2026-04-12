const { FaissIndex } = require('../../src/js/index');

function createVectors(count, dims) {
  const vectors = new Float32Array(count * dims);

  for (let i = 0; i < count; i++) {
    for (let j = 0; j < dims; j++) {
      const base = ((i + 3) * (j + 5)) % 17;
      vectors[i * dims + j] = (base + j) / 23;
    }
  }

  return vectors;
}

describe('Additional index types', () => {
  test('creates PQ index with explicit factory metadata', () => {
    const index = new FaissIndex({ type: 'PQ', dims: 8, pqSegments: 2, pqBits: 4 });
    const stats = index.getStats();

    expect(stats.type).toBe('PQ');
    expect(stats.factory).toBe('PQ2x4');
    expect(stats.metric).toBe('l2');
    expect(stats.isTrained).toBe(false);
  });

  test('trains, adds, and searches with PQ', async () => {
    const index = new FaissIndex({ type: 'PQ', dims: 8, pqSegments: 2, pqBits: 4 });
    const trainingVectors = createVectors(64, 8);
    const vectors = createVectors(24, 8);

    await index.train(trainingVectors);
    await index.add(vectors);

    const query = vectors.slice(0, 8);
    const results = await index.search(query, 3);

    expect(index.getStats().ntotal).toBe(24);
    expect(results.labels.length).toBe(3);
    expect(results.distances.length).toBe(3);
  });

  test('trains, adds, and searches with IVF_PQ', async () => {
    const index = new FaissIndex({
      type: 'IVF_PQ',
      dims: 8,
      nlist: 4,
      nprobe: 2,
      pqSegments: 2,
      pqBits: 4,
    });

    const trainingVectors = createVectors(64, 8);
    const vectors = createVectors(24, 8);

    await index.train(trainingVectors);
    await index.add(vectors);

    const query = vectors.slice(8, 16);
    const results = await index.search(query, 5);

    expect(index.getStats().type).toBe('IVF_PQ');
    expect(results.labels.length).toBe(5);
    expect(results.distances.length).toBe(5);
  });

  test('trains, adds, and searches with IVF_SQ', async () => {
    const index = new FaissIndex({
      type: 'IVF_SQ',
      dims: 8,
      nlist: 4,
      nprobe: 2,
      sqType: 'SQ8',
    });

    const trainingVectors = createVectors(32, 8);
    const vectors = createVectors(16, 8);

    await index.train(trainingVectors);
    await index.add(vectors);

    const query = vectors.slice(0, 8);
    const results = await index.search(query, 4);

    expect(index.getStats().type).toBe('IVF_SQ');
    expect(results.labels.length).toBe(4);
    expect(results.distances.length).toBe(4);
  });

  test('supports raw FAISS factory strings for advanced pipelines', async () => {
    const index = new FaissIndex({
      dims: 8,
      factory: 'PCA4,Flat',
    });

    const trainingVectors = createVectors(32, 8);
    const vectors = createVectors(12, 8);

    await index.train(trainingVectors);
    await index.add(vectors);

    const stats = index.getStats();
    const results = await index.search(vectors.slice(0, 8), 2);

    expect(stats.type).toBe('PCA_FLAT_L2');
    expect(stats.factory).toBe('PCA4,Flat');
    expect(results.labels.length).toBe(2);
  });

  test('rejects incompatible factory and type options', () => {
    expect(() => {
      new FaissIndex({ type: 'PQ', dims: 8, factory: 'PQ2x4' });
    }).toThrow(/cannot be combined with factory/);
  });

  test('rejects pqSegments that do not evenly divide dims', () => {
    expect(() => {
      new FaissIndex({ type: 'PQ', dims: 10, pqSegments: 4, pqBits: 4 });
    }).toThrow(/evenly divide dims/);
  });
});
