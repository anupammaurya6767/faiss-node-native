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
  index: new FaissIndex({ type: 'FLAT_IP', dims }),
};
globalThis.__faissNodeDemoState = state;

async function ensureSeeded() {
  if (state.ready) {
    return;
  }

  const seedVectors = normalizeVectors(new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
  ]), dims);

  await state.index.add(seedVectors);
  state.ready = true;
}

module.exports = async function handler(req, res) {
  await ensureSeeded();

  const query = normalizeVectors(new Float32Array(req.body?.query || [1, 0, 0, 0]), dims);
  const k = Number(req.body?.k || 2);
  const results = await state.index.search(query, k);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    labels: Array.from(results.labels),
    distances: Array.from(results.distances),
    stats: state.index.getStats(),
  }));
};
