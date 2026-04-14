const {
  FaissBinaryIndex,
  BinaryVectorError,
  GpuNotAvailableError,
} = require('../../src/js');

describe('Binary index support', () => {
  test('creates, searches, reconstructs, and removes vectors in a binary flat index', async () => {
    const index = new FaissBinaryIndex({ type: 'BINARY_FLAT', dims: 16 });
    const vectors = new Uint8Array([
      0x00, 0x00,
      0xff, 0xff,
      0xf0, 0x0f,
    ]);

    await index.add(vectors);

    const search = await index.search(new Uint8Array([0x00, 0x00]), 2);
    const reconstructed = await index.reconstruct(2);
    const removed = await index.removeIds([1]);

    expect(search.labels[0]).toBe(0);
    expect(search.distances[0]).toBe(0);
    expect(Array.from(reconstructed)).toEqual([0xf0, 0x0f]);
    expect(removed).toBe(1);
    expect(index.getVectorCount()).toBe(2);
  });

  test('supports binary IVF indexes with training and nprobe', async () => {
    const index = new FaissBinaryIndex({
      type: 'BINARY_IVF',
      dims: 16,
      nlist: 2,
      nprobe: 2,
    });

    const trainingVectors = new Uint8Array([
      0x00, 0x00,
      0x00, 0x01,
      0x00, 0x03,
      0x0f, 0x0f,
      0xf0, 0xf0,
      0xff, 0xff,
      0xaa, 0xaa,
      0x55, 0x55,
    ]);

    await index.train(trainingVectors);
    await index.add(trainingVectors);

    const results = await index.search(new Uint8Array([0x00, 0x01]), 1);
    expect(results.labels[0]).toBeGreaterThanOrEqual(0);
    expect(index.getStats().isTrained).toBe(true);
  });

  test('supports binary HNSW and round-trips through save/load and buffers', async () => {
    const index = new FaissBinaryIndex({
      type: 'BINARY_HNSW',
      dims: 16,
      M: 8,
      efConstruction: 40,
      efSearch: 20,
    });

    const vectors = new Uint8Array([
      0x00, 0x00,
      0x0f, 0x0f,
      0xf0, 0xf0,
      0xff, 0xff,
    ]);

    await index.add(vectors);

    const buffer = await index.toBuffer();
    const fromBuffer = await FaissBinaryIndex.fromBuffer(buffer);
    const search = await fromBuffer.search(new Uint8Array([0xff, 0xff]), 1);

    expect(search.labels[0]).toBe(3);
    expect(search.distances[0]).toBe(0);
    expect(fromBuffer.getStats().type).toBe('BINARY_HNSW');
  });

  test('validate and inspect surface binary-specific stats', async () => {
    const index = new FaissBinaryIndex({ factory: 'BFlat', dims: 16 });
    const vectors = new Uint8Array([
      0x00, 0x00,
      0xff, 0xff,
    ]);

    await index.add(vectors);

    const validation = await index.validate();
    const text = index.inspect({ format: 'text' });

    expect(validation.valid).toBe(true);
    expect(text).toContain('Dims: 16 bits');
    expect(text).toContain('Metric: hamming');
  });

  test('rejects binary dimensions that are not byte aligned', () => {
    expect(() => {
      new FaissBinaryIndex({ type: 'BINARY_FLAT', dims: 10 });
    }).toThrow(BinaryVectorError);
  });

  test('binary GPU helpers report support accurately and enforce flat-only GPU behavior', async () => {
    const support = FaissBinaryIndex.gpuSupport();
    const index = new FaissBinaryIndex({ type: 'BINARY_FLAT', dims: 16 });

    if (!support.available) {
      expect(support.available).toBe(false);
      await expect(index.toGpu()).rejects.toBeInstanceOf(GpuNotAvailableError);
      return;
    }

    const vectors = new Uint8Array([
      0x00, 0x00,
      0x0f, 0x0f,
      0xf0, 0xf0,
      0xff, 0xff,
    ]);

    await index.add(vectors);

    const cpuSearch = await index.search(new Uint8Array([0x00, 0x00]), 2);
    await index.toGpu();
    const gpuSearch = await index.search(new Uint8Array([0x00, 0x00]), 2);
    await index.toCpu();
    const backOnCpu = await index.search(new Uint8Array([0x00, 0x00]), 2);

    expect(cpuSearch.labels[0]).toBe(0);
    expect(gpuSearch.labels[0]).toBe(0);
    expect(backOnCpu.labels[0]).toBe(0);
    expect(gpuSearch.distances[0]).toBe(0);

    const warnings = [];
    const unsupported = new FaissBinaryIndex({
      type: 'BINARY_HNSW',
      dims: 16,
      M: 8,
      efConstruction: 40,
      efSearch: 20,
      warningHandler: (entry) => warnings.push(entry),
    });

    await expect(unsupported.toGpu()).resolves.toBe(unsupported);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('Staying on CPU');
    expect(unsupported.getStats().type).toBe('BINARY_HNSW');
  });

  test('unsupported binary GPU requests can warn and stay on CPU without invoking native GPU fallback logic', async () => {
    const originalGpuSupport = FaissBinaryIndex.gpuSupport;
    FaissBinaryIndex.gpuSupport = () => ({
      compiled: true,
      available: true,
      reason: 'stubbed for unit coverage',
    });

    try {
      const warnings = [];
      const index = new FaissBinaryIndex({
        type: 'BINARY_HNSW',
        dims: 16,
        M: 8,
        efConstruction: 40,
        efSearch: 20,
        warningHandler: (entry) => warnings.push(entry),
      });

      await expect(index.toGpu()).resolves.toBe(index);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('BINARY_HNSW');
      expect(warnings[0].message).toContain('Staying on CPU');
      expect(index.getStats().type).toBe('BINARY_HNSW');
    } finally {
      FaissBinaryIndex.gpuSupport = originalGpuSupport;
    }
  });
});
