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
  return new Float32Array(vectors.flatMap((row) => Array.from(row)));
}

function validateVectorRows(vectors) {
  if (!Array.isArray(vectors)) {
    return 'vectors must be an array of numeric vectors';
  }

  if (vectors.length === 0) {
    return 'vectors must contain at least one vector';
  }

  for (const row of vectors) {
    if (!Array.isArray(row) && !ArrayBuffer.isView(row)) {
      return 'each vector must be an array or TypedArray';
    }

    const values = Array.from(row);
    if (values.length !== dims) {
      return `each vector must contain exactly ${dims} numbers`;
    }

    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
      return 'vectors must only contain finite numbers';
    }
  }

  return null;
}

function validateQueryVector(query) {
  if (!Array.isArray(query) && !ArrayBuffer.isView(query)) {
    return 'query must be an array or TypedArray of numbers';
  }

  const values = Array.from(query);
  if (values.length !== dims) {
    return `query must contain exactly ${dims} numbers`;
  }

  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return 'query must only contain finite numbers';
  }

  return null;
}

function parseNeighborCount(value, fallback = 5) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }

  return parsed;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.post('/index', asyncHandler(async (req, res) => {
  const error = validateVectorRows(req.body?.vectors);
  if (error) {
    return res.status(400).json({ error });
  }

  const vectors = flattenVectors(req.body.vectors);
  const normalized = normalizeVectors(vectors, dims);
  await index.addWithProgress(normalized, {
    batchSize: 1000,
    onProgress(update) {
      console.error('index progress', update);
    },
  });

  return res.json({
    ok: true,
    stats: index.getStats(),
    metrics: index.getMetrics(),
  });
}));

app.post('/search', asyncHandler(async (req, res) => {
  const queryError = validateQueryVector(req.body?.query);
  if (queryError) {
    return res.status(400).json({ error: queryError });
  }

  const k = parseNeighborCount(req.body?.k, 5);
  if (k === null) {
    return res.status(400).json({ error: 'k must be a positive integer between 1 and 100' });
  }

  const query = normalizeVectors(new Float32Array(Array.from(req.body.query)), dims);
  const results = await index.search(query, k);

  return res.json({
    labels: Array.from(results.labels),
    distances: Array.from(results.distances),
  });
}));

app.get('/info', (_req, res) => {
  res.json(index.inspect());
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

app.listen(3000, () => {
  console.log('Vector search API listening on http://localhost:3000');
});
