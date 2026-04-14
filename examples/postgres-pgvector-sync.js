/**
 * Example: sync vectors from PostgreSQL + pgvector into a FAISS index.
 *
 * Install dependency first:
 *   npm install pg
 *
 * This pattern is useful when pgvector is your source of truth and FAISS is the
 * low-latency in-memory serving layer.
 */

const { Client } = require('pg');
const { FaissIndex, normalizeVectors } = require('../src/js');

const dims = 4;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  try {
    const { rows } = await client.query('SELECT id, embedding FROM documents ORDER BY id LIMIT 1000');
    const flattened = new Float32Array(rows.flatMap((row) => row.embedding));

    const index = new FaissIndex({ type: 'FLAT_IP', dims });
    try {
      await index.add(normalizeVectors(flattened, dims));

      const query = normalizeVectors(new Float32Array([1, 0, 0, 0]), dims);
      const results = await index.search(query, 5);

      console.log({
        hits: Array.from(results.labels).map((label, i) => ({
          rowId: rows[label]?.id,
          score: results.distances[i],
        })),
        stats: index.getStats(),
      });
    } finally {
      index.dispose();
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
