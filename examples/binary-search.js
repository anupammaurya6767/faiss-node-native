/**
 * Binary vector search example.
 *
 * Each vector is a raw Uint8Array where dims is expressed in bits.
 * Replace these placeholder hashes with real binary descriptors, SimHash values,
 * perceptual hashes, or other byte-packed embeddings.
 */

const { FaissBinaryIndex } = require('../src/js');

async function main() {
  const index = new FaissBinaryIndex({
    type: 'BINARY_HNSW',
    dims: 64,
    M: 16,
    efConstruction: 80,
    efSearch: 32,
  });

  const vectors = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, 0xaa, 0xaa, 0xaa, 0xaa,
    0xff, 0xff, 0xff, 0xff, 0x55, 0x55, 0x55, 0x55,
    0xf0, 0x0f, 0xf0, 0x0f, 0x12, 0x34, 0x56, 0x78,
  ]);

  await index.add(vectors);

  const query = new Uint8Array([0xf0, 0x0f, 0xf0, 0x0f, 0x12, 0x34, 0x56, 0x78]);
  const results = await index.search(query, 2);

  console.log('Stats:', index.getStats());
  console.log('Labels:', Array.from(results.labels));
  console.log('Hamming distances:', Array.from(results.distances));
  console.log('Nearest vector bytes:', Array.from(await index.reconstruct(results.labels[0])));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
