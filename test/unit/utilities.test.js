const {
  normalizeVectors,
  validateVectors,
  splitVectors,
  computeDistances,
} = require('../../src/js');

describe('Vector utilities', () => {
  test('normalizeVectors normalizes each vector independently', () => {
    const vectors = new Float32Array([3, 4, 0, 0, 0, 0, 5, 12]);
    const normalized = normalizeVectors(vectors, 4);

    expect(normalized[0]).toBeCloseTo(0.6, 5);
    expect(normalized[1]).toBeCloseTo(0.8, 5);
    expect(normalized[6]).toBeCloseTo(5 / 13, 5);
    expect(normalized[7]).toBeCloseTo(12 / 13, 5);
  });

  test('validateVectors reports non-finite values', () => {
    const vectors = new Float32Array([1, 0, Number.NaN, 0, 1, 0, 0, 0]);
    const report = validateVectors(vectors, 4);

    expect(report.valid).toBe(false);
    expect(report.hasNaNOrInfinity).toBe(true);
    expect(report.nonFinite.length).toBe(1);
    expect(report.nonFinite[0].vectorIndex).toBe(0);
  });

  test('splitVectors returns chunked views', () => {
    const vectors = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
    ]);

    const chunks = splitVectors(vectors, 4, 2);
    expect(chunks).toHaveLength(2);
    expect(Array.from(chunks[0])).toEqual([1, 0, 0, 0, 0, 1, 0, 0]);
    expect(Array.from(chunks[1])).toEqual([0, 0, 1, 0]);
  });

  test('computeDistances supports l2 and cosine metrics', () => {
    const left = new Float32Array([1, 0, 0, 0]);
    const right = new Float32Array([0, 1, 0, 0]);

    const l2 = computeDistances(left, right, { dims: 4, metric: 'l2' });
    const cosine = computeDistances(left, right, { dims: 4, metric: 'cosine' });

    expect(l2[0]).toBeCloseTo(2, 5);
    expect(cosine[0]).toBeCloseTo(0, 5);
  });
});
