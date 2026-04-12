/**
 * Express.js vector search API example.
 *
 * Start:
 *   node examples/express-search-api.js
 *
 * Endpoints:
 *   POST /index  { vectors: number[][] }
 *   POST /search { query: number[], k?: number }
 *   GET  /info
 */

const express = require('express');
const { FaissIndex, normalizeVectors } = require('../src/js');

const dims = 4;
const app = express();
app.use(express.json({ limit: '2mb' }));

const index = new FaissIndex({
  type: 'FLAT_IP',
  dims,
  debug: true,
});

function flattenVectors(vectors) {
  return new Float32Array(vectors.flat());
}

app.post('/index', async (req, res) => {
  const vectors = flattenVectors(req.body.vectors || []);
  const normalized = normalizeVectors(vectors, dims);
  await index.addWithProgress(normalized, {
    batchSize: 1000,
    onProgress(update) {
      console.error('index progress', update);
    },
  });

  res.json({
    ok: true,
    stats: index.getStats(),
    metrics: index.getMetrics(),
  });
});

app.post('/search', async (req, res) => {
  const query = normalizeVectors(new Float32Array(req.body.query || []), dims);
  const k = req.body.k || 5;
  const results = await index.search(query, k);

  res.json({
    labels: Array.from(results.labels),
    distances: Array.from(results.distances),
  });
});

app.get('/info', (_req, res) => {
  res.json(index.inspect());
});

app.listen(3000, () => {
  console.log('Vector search API listening on http://localhost:3000');
});
