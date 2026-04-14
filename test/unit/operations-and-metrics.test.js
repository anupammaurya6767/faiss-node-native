const {
  FaissIndex,
  GpuNotAvailableError,
} = require('../../src/js');

describe('Enhanced index operations', () => {
  test('reconstruct and getVectorById return stored vectors', async () => {
    const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
    const vectors = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
    ]);

    await index.add(vectors);

    const reconstructed = await index.reconstruct(1);
    const byId = await index.getVectorById(2);

    expect(Array.from(reconstructed)).toEqual([0, 1, 0, 0]);
    expect(Array.from(byId)).toEqual([0, 0, 1, 0]);
  });

  test('reconstructBatch returns concatenated vectors', async () => {
    const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
    const vectors = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
    ]);

    await index.add(vectors);

    const reconstructed = await index.reconstructBatch([0, 2]);
    expect(Array.from(reconstructed)).toEqual([1, 0, 0, 0, 0, 0, 1, 0]);
  });

  test('removeIds works for flat indexes', async () => {
    const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
    const vectors = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
    ]);

    await index.add(vectors);
    const removed = await index.removeIds([1]);

    expect(removed).toBe(1);
    expect(index.getVectorCount()).toBe(2);
  });

  test('removeIds works for IVF indexes with direct-map fallback', async () => {
    const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 2, nprobe: 2 });
    const vectors = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);

    await index.train(vectors);
    await index.add(vectors);

    const removed = await index.removeIds([1]);
    const reconstructed = await index.reconstruct(0);

    expect(removed).toBe(1);
    expect(index.getVectorCount()).toBe(3);
    expect(Array.from(reconstructed)).toEqual([1, 0, 0, 0]);
  });
});

describe('Metrics, validation, and progress helpers', () => {
  test('records operation metrics and returns validation report', async () => {
    const index = new FaissIndex({ type: 'PQ', dims: 8, pqSegments: 2, pqBits: 4, collectMetrics: true });
    const trainingVectors = new Float32Array(
      Array.from({ length: 8 * 640 }, (_, i) => ((i % 8) + (Math.floor(i / 8) % 17)) / 19)
    );

    await index.train(trainingVectors);
    await index.add(trainingVectors.subarray(0, 8 * 16));

    const validation = await index.validate();
    const metrics = index.getMetrics();

    expect(validation.valid).toBe(true);
    expect(metrics.operations.train.count).toBe(1);
    expect(metrics.operations.add.count).toBe(1);
  });

  test('addWithProgress emits progress callbacks', async () => {
    const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
    const vectors = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);

    const progress = [];
    await index.addWithProgress(vectors, {
      batchSize: 2,
      onProgress(update) {
        progress.push(update);
      },
    });

    expect(progress).toHaveLength(2);
    expect(progress[1].processed).toBe(4);
    expect(index.getVectorCount()).toBe(4);
  });

  test('inspect returns human-readable text', async () => {
    const index = new FaissIndex({ type: 'FLAT_IP', dims: 4 });
    const text = index.inspect({ format: 'text' });

    expect(text).toContain('Type: FLAT_IP');
    expect(text).toContain('Metric: ip');
  });

  test('GPU helpers report unavailable support in this build', async () => {
    const index = new FaissIndex({ type: 'FLAT_L2', dims: 4 });

    expect(FaissIndex.gpuSupport().available).toBe(false);
    await expect(index.toGpu()).rejects.toBeInstanceOf(GpuNotAvailableError);
  });
});
