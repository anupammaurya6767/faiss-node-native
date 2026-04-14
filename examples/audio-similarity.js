/**
 * Audio similarity search example using placeholder embeddings.
 *
 * Swap these vectors with embeddings from an audio model such as CLAP,
 * MusicGen-derived encoders, or your own feature extraction pipeline.
 */

const { FaissIndex, normalizeVectors } = require('../src/js');

const dims = 8;
const tracks = [
  { id: 'ambient-intro.wav', embedding: [0.71, 0.10, 0.08, 0.21, 0.34, 0.55, 0.19, 0.29] },
  { id: 'drum-loop.wav', embedding: [0.18, 0.77, 0.24, 0.63, 0.21, 0.11, 0.70, 0.09] },
  { id: 'guitar-riff.wav', embedding: [0.36, 0.20, 0.82, 0.51, 0.12, 0.48, 0.16, 0.41] },
];

async function main() {
  const index = new FaissIndex({ type: 'FLAT_IP', dims });
  const flattened = new Float32Array(tracks.flatMap((item) => item.embedding));
  await index.add(normalizeVectors(flattened, dims));

  const query = normalizeVectors(new Float32Array([
    0.17, 0.80, 0.20, 0.61, 0.22, 0.10, 0.66, 0.11,
  ]), dims);

  const results = await index.search(query, 2);
  const matches = Array.from(results.labels).map((label, i) => ({
    track: tracks[label]?.id,
    score: Number(results.distances[i].toFixed(4)),
  }));

  console.log(matches);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
