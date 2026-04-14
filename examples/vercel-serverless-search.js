/**
 * Minimal serverless-style handler example for Vercel / Node runtimes.
 *
 * This keeps an in-memory singleton index between warm invocations.
 * For production, load vectors from durable storage during cold start and
 * persist updates explicitly instead of mutating process memory ad hoc.
 */

const { FaissIndex, normalizeVectors } = require('../src/js');

const dims = 4;
const state = globalThis.__faissNodeDemoState || {
  ready: false,
  seedPromise: null,
  index: new FaissIndex({ type: 'FLAT_IP', dims }),
};
globalThis.__faissNodeDemoState = state;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function parseQueryVector(value) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    return { error: `query must be an array or TypedArray of ${dims} numeric values` };
  }

  const numbers = Array.from(value);
  if (numbers.length !== dims) {
    return { error: `query must contain exactly ${dims} numbers` };
  }

  if (numbers.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
    return { error: 'query must only contain finite numeric values' };
  }

  return { value: new Float32Array(numbers) };
}

function parseNeighborCount(value, fallback = 2) {
  if (value === undefined) {
    return { value: fallback };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100) {
    return { error: 'k must be a positive integer between 1 and 100' };
  }

  return { value: parsed };
}

async function ensureSeeded() {
  if (state.ready) {
    return;
  }

  if (!state.seedPromise) {
    state.seedPromise = (async () => {
      const seedVectors = normalizeVectors(new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
      ]), dims);

      await state.index.add(seedVectors);
      state.ready = true;
    })().finally(() => {
      state.seedPromise = null;
    });
  }

  await state.seedPromise;
}

module.exports = async function handler(req, res) {
  try {
    await ensureSeeded();

    const queryInput = req.body?.query ?? [1, 0, 0, 0];
    const queryCheck = parseQueryVector(queryInput);
    if (queryCheck.error) {
      return sendJson(res, 400, { error: queryCheck.error });
    }

    const kCheck = parseNeighborCount(req.body?.k, 2);
    if (kCheck.error) {
      return sendJson(res, 400, { error: kCheck.error });
    }

    const query = normalizeVectors(queryCheck.value, dims);
    const results = await state.index.search(query, kCheck.value);

    return sendJson(res, 200, {
      labels: Array.from(results.labels),
      distances: Array.from(results.distances),
      stats: state.index.getStats(),
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
