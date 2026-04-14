/**
 * Recommendation-style similarity example.
 *
 * Demonstrates using normalized embeddings with FLAT_IP so inner-product
 * search behaves like cosine similarity.
 */

const { FaissIndex, normalizeVectors } = require('../src/js');

async function main() {
  const itemEmbeddings = new Float32Array([
    0.95, 0.02, 0.01, 0.00,
    0.90, 0.10, 0.00, 0.00,
    0.10, 0.90, 0.05, 0.00,
    0.00, 0.10, 0.95, 0.05,
    0.00, 0.00, 0.20, 0.98,
  ]);

  const itemNames = [
    'Wireless keyboard',
    'Mechanical keyboard',
    'Gaming mouse',
    'Studio headphones',
    'Portable speaker',
  ];

  const index = new FaissIndex({ type: 'FLAT_IP', dims: 4 });
  try {
    await index.add(normalizeVectors(itemEmbeddings, 4));

    const userPreference = normalizeVectors(new Float32Array([
      0.93, 0.07, 0.02, 0.00,
    ]), 4);

    const results = await index.search(userPreference, 3);

    console.log('Top recommendations:');
    for (let i = 0; i < results.labels.length; i++) {
      const label = results.labels[i];
      console.log(`${i + 1}. ${itemNames[label]} (score=${results.distances[i].toFixed(4)})`);
    }
  } finally {
    index.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
