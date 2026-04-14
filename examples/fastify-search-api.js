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

app.post('/index', async (request, reply) => {
  const error = validateVectorRows(request.body?.vectors);
  if (error) {
    return reply.code(400).send({ error });
  }

  const vectors = flattenVectors(request.body.vectors);
  await index.add(normalizeVectors(vectors, dims));
  return {
    ok: true,
    stats: index.getStats(),
  };
});

app.post('/search', async (request, reply) => {
  const error = validateQueryVector(request.body?.query);
  if (error) {
    return reply.code(400).send({ error });
  }

  const k = parseNeighborCount(request.body?.k, 5);
  if (k === null) {
    return reply.code(400).send({ error: 'k must be a positive integer between 1 and 100' });
  }

  const query = normalizeVectors(new Float32Array(Array.from(request.body.query)), dims);
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
