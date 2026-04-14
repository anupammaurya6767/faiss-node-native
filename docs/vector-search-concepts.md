# Vector Search Concepts

## Choosing an index

- `FLAT_L2` and `FLAT_IP` give exact results and are great for smaller datasets or evaluation baselines.
- `HNSW` trades memory for fast high-recall approximate search.
- `IVF_FLAT` reduces search cost by probing only a subset of coarse clusters.
- `PQ`, `IVF_PQ`, and `IVF_SQ` trade some accuracy for major memory savings.
- `FaissBinaryIndex` targets byte-packed binary vectors and Hamming-distance retrieval.

## Cosine similarity

Cosine similarity is usually implemented with inner-product search over L2-normalized vectors:

1. Normalize your indexed vectors.
2. Normalize every query vector.
3. Use `FLAT_IP`, `HNSW` with `metric: 'ip'`, or another compatible inner-product index.

The helper `normalizeVectors()` exists so that this preprocessing stays in the JS layer instead of being easy to forget in application code.

## Training vs non-training indexes

- `FLAT_*` and `HNSW` do not require training.
- IVF, PQ, and scalar-quantized indexes must be trained before `add()`.
- For binary search, `BINARY_IVF` requires training while `BINARY_FLAT` and `BINARY_HNSW` do not.

## Operational guidance

- Use `validate()` after loading persisted indexes in production.
- Use `inspect()` in debug endpoints or admin tooling.
- Use `addWithProgress()` and `trainWithProgress()` for long-running ingest jobs.
- Float vector inputs are validated in JS before native calls. `NaN` and `Infinity` are rejected on `add()`, `search()`, and `searchBatch()`.
- When GPU FAISS is available at build time, `toGpu()` / `toCpu()` let you move search workloads without changing the higher-level JS API.
- For binary indexes, only `BINARY_FLAT` currently has a GPU migration path. Other binary index types warn and stay on CPU when `toGpu()` is requested.
