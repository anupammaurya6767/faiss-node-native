/**
 * Fastify vector search API example.
 *
 * Install dependency first:
 *   npm install fastify
 *
 * Start:
 *   node examples/fastify-search-api.js
 */

const Fastify = require('fastify');
const { FaissIndex, normalizeVectors } = require('../src/js');

const dims = 4;
const app = Fastify({ logger: true });
const index = new FaissIndex({ type: 'FLAT_IP', dims });

function flattenVectors(vectors) {
  return new Float32Array(vectors.flat());
}

app.post('/index', async (request) => {
  const vectors = flattenVectors(request.body.vectors || []);
  await index.add(normalizeVectors(vectors, dims));
  return {
    ok: true,
    stats: index.getStats(),
  };
});

app.post('/search', async (request) => {
  const query = normalizeVectors(new Float32Array(request.body.query || []), dims);
  const k = request.body.k || 5;
  const results = await index.search(query, k);
  return {
    labels: Array.from(results.labels),
    distances: Array.from(results.distances),
  };
});

app.get('/info', async () => index.inspect());

app.listen({ port: 3001 }).catch((error) => {
  app.log.error(error);
  process.exitCode = 1;
});
