# Integration Recipes

This repository now includes runnable or near-runnable integration patterns for common application layers:

- [examples/express-search-api.js](../examples/express-search-api.js) for an Express REST API
- [examples/fastify-search-api.js](../examples/fastify-search-api.js) for a Fastify-based API
- [examples/graphql-search.js](../examples/graphql-search.js) for GraphQL resolvers
- [examples/vercel-serverless-search.js](../examples/vercel-serverless-search.js) for serverless request handlers
- [examples/postgres-pgvector-sync.js](../examples/postgres-pgvector-sync.js) for PostgreSQL + pgvector replication into FAISS

Recommended production pattern:

1. Keep an external system of record for vectors and metadata.
2. Build or refresh FAISS indexes from that source asynchronously.
3. Persist `.faiss` plus `.meta.json` artifacts for warm boot and deploy-time loading.
4. Use `inspect()`, `validate()`, and `getMetrics()` in health checks and dashboards.
5. If you need cosine similarity, normalize vectors before both indexing and querying.

Suggested deployment split:

- `FaissIndex` or `FaissBinaryIndex` for the hot search path
- PostgreSQL, MongoDB, or object storage for document metadata
- A background worker for retraining IVF/PQ variants
- A lightweight HTTP or GraphQL layer that only handles query validation and result shaping
