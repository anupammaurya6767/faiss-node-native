/**
 * Semantic search example using OpenAI embeddings plus FAISS.
 *
 * Required:
 *   export OPENAI_API_KEY=...
 *
 * Run:
 *   node examples/semantic-search-openai.js
 */

const { FaissIndex, normalizeVectors } = require('../src/js');

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const documents = [
  'FAISS is a vector search library optimized for nearest-neighbor search.',
  'Node.js native addons let JavaScript call into C++ efficiently.',
  'HNSW indexes trade index build cost for very fast approximate queries.',
  'Product quantization reduces memory footprint for large embedding corpora.',
];

async function embedTexts(texts) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run this example');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings request failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  return payload.data.map((item) => item.embedding);
}

async function main() {
  const documentEmbeddings = await embedTexts(documents);
  const dims = documentEmbeddings[0].length;
  const index = new FaissIndex({ type: 'FLAT_IP', dims });

  const flattenedDocuments = new Float32Array(documentEmbeddings.flat());
  await index.add(normalizeVectors(flattenedDocuments, dims));

  const [queryEmbedding] = await embedTexts([
    'Which FAISS index is good when memory matters more than exact recall?',
  ]);

  const query = normalizeVectors(new Float32Array(queryEmbedding), dims);
  const results = await index.search(query, 3);

  console.log('Top semantic matches:');
  for (let i = 0; i < results.labels.length; i++) {
    const label = results.labels[i];
    console.log(`- #${label}: ${documents[label]} (score=${results.distances[i].toFixed(4)})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
