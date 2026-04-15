#!/usr/bin/env node

const { FaissIndex } = require('../src/js/index');

function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function generateNormalizedVectors(count, dims, seed) {
  const next = createRng(seed);
  const vectors = new Float32Array(count * dims);

  for (let row = 0; row < count; row++) {
    let norm = 0;
    const offset = row * dims;

    for (let col = 0; col < dims; col++) {
      const value = next() * 2 - 1;
      vectors[offset + col] = value;
      norm += value * value;
    }

    norm = Math.sqrt(norm) || 1;
    for (let col = 0; col < dims; col++) {
      vectors[offset + col] /= norm;
    }
  }

  return vectors;
}

async function main() {
  const dims = 128;
  const vectorCount = 2048;
  const queryCount = 32;
  const iterations = 40;

  const index = new FaissIndex({ type: 'FLAT_L2', dims });

  try {
    const vectors = generateNormalizedVectors(vectorCount, dims, 12345);
    const queries = generateNormalizedVectors(queryCount, dims, 67890);

    await index.add(vectors);

    for (let i = 0; i < iterations; i++) {
      const queryOffset = (i % queryCount) * dims;
      const query = queries.subarray(queryOffset, queryOffset + dims);
      await index.search(query, 10);
    }

    await index.searchBatch(queries, 10);

    const stats = index.getStats();
    console.log(
      JSON.stringify({
        profiled: true,
        type: stats.type,
        dims: stats.dims,
        ntotal: stats.ntotal,
        iterations,
        queryCount,
      })
    );
  } finally {
    index.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
