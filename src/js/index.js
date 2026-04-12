const fs = require('fs/promises');
const { FaissBinaryIndex } = require('./binary');

const {
  FaissError,
  ValidationError,
  DimensionMismatchError,
  InvalidVectorError,
  IndexDisposedError,
  UnsupportedOperationError,
  GpuNotAvailableError,
  BinaryVectorError,
} = require('./errors');

const {
  normalizeVectors,
  validateVectors,
  splitVectors,
  computeDistances,
  validateBinaryVectors,
  getVectorCount: getVectorCountForArray,
} = require('./utils');

// Try to load the native module (path may vary based on build system)
let FaissIndexWrapper;
try {
  FaissIndexWrapper = require('../../build/Release/faiss_node.node').FaissIndexWrapper;
} catch (e) {
  try {
    FaissIndexWrapper = require('../../build/faiss_node.node').FaissIndexWrapper;
  } catch (e2) {
    throw new Error('Native module not found. Run "npm run build" first.');
  }
}

const VALID_TYPES = ['FLAT_L2', 'FLAT_IP', 'IVF_FLAT', 'HNSW', 'PQ', 'IVF_PQ', 'IVF_SQ'];
const IVF_TYPES = new Set(['IVF_FLAT', 'IVF_PQ', 'IVF_SQ']);
const PQ_TYPES = new Set(['PQ', 'IVF_PQ']);
const VALID_METRICS = new Set(['l2', 'ip']);
const GPU_SUPPORT = Object.freeze({
  compiled: false,
  available: false,
  reason: 'This binary was built without CUDA-enabled FAISS GPU support.',
});

function validatePositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${name} must be a positive integer`, {
      details: { name, value },
    });
  }
}

function validateNonEmptyString(name, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} must be a non-empty string`, {
      details: { name, value },
    });
  }
}

function validateMetric(type, metric) {
  if (metric === undefined) {
    return;
  }

  if (!VALID_METRICS.has(metric)) {
    throw new ValidationError(`metric must be one of: ${Array.from(VALID_METRICS).join(', ')}`);
  }

  if (type === 'FLAT_L2' && metric !== 'l2') {
    throw new ValidationError('FLAT_L2 indexes only support metric "l2"');
  }

  if (type === 'FLAT_IP' && metric !== 'ip') {
    throw new ValidationError('FLAT_IP indexes only support metric "ip"');
  }
}

function validateFactoryConfig(config) {
  validateNonEmptyString('factory', config.factory);
  validateMetric(undefined, config.metric);

  if (config.type !== undefined) {
    throw new ValidationError('type cannot be combined with factory; use one or the other');
  }

  const factoryEncodedOptions = ['nlist', 'M', 'efConstruction', 'efSearch', 'pqSegments', 'pqBits', 'sqType'];
  for (const key of factoryEncodedOptions) {
    if (config[key] !== undefined) {
      throw new ValidationError(
        `${key} cannot be combined with factory; encode it directly in the factory string`
      );
    }
  }

  if (config.nprobe !== undefined) {
    validatePositiveInteger('nprobe', config.nprobe);
  }
}

function validateIndexSpecificOptions(type, config) {
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError(
      `Index type '${type}' not supported. Supported types: ${VALID_TYPES.join(', ')}`
    );
  }

  validateMetric(type, config.metric);

  const ivfOnlyOptions = ['nlist', 'nprobe'];
  const hnswOnlyOptions = ['M', 'efConstruction', 'efSearch'];
  const pqOnlyOptions = ['pqSegments', 'pqBits'];

  if (!IVF_TYPES.has(type)) {
    for (const key of ivfOnlyOptions) {
      if (config[key] !== undefined) {
        throw new ValidationError(`${key} is only supported for IVF_FLAT, IVF_PQ, and IVF_SQ indexes`);
      }
    }
  }

  if (type !== 'HNSW') {
    for (const key of hnswOnlyOptions) {
      if (config[key] !== undefined) {
        throw new ValidationError(`${key} is only supported for HNSW indexes`);
      }
    }
  }

  if (!PQ_TYPES.has(type)) {
    for (const key of pqOnlyOptions) {
      if (config[key] !== undefined) {
        throw new ValidationError(`${key} is only supported for PQ and IVF_PQ indexes`);
      }
    }
  }

  if (type !== 'IVF_SQ' && config.sqType !== undefined) {
    throw new ValidationError('sqType is only supported for IVF_SQ indexes');
  }

  for (const key of ['nlist', 'nprobe', 'M', 'efConstruction', 'efSearch', 'pqSegments', 'pqBits']) {
    if (config[key] !== undefined) {
      validatePositiveInteger(key, config[key]);
    }
  }

  if (config.pqSegments !== undefined && config.dims % config.pqSegments !== 0) {
    throw new DimensionMismatchError(
      `pqSegments must evenly divide dims. Got dims=${config.dims}, pqSegments=${config.pqSegments}`,
      { details: { dims: config.dims, pqSegments: config.pqSegments } }
    );
  }

  if (config.sqType !== undefined) {
    validateNonEmptyString('sqType', config.sqType);
  }
}

function buildNativeConfig(config, indexType) {
  const nativeConfig = { dims: config.dims };

  if (config.factory !== undefined) {
    nativeConfig.factory = config.factory;
    if (config.metric !== undefined) {
      nativeConfig.metric = config.metric;
    }
    if (config.nprobe !== undefined) {
      nativeConfig.nprobe = config.nprobe;
    }
    return nativeConfig;
  }

  nativeConfig.type = indexType;
  for (const key of ['nlist', 'nprobe', 'M', 'efConstruction', 'efSearch', 'pqSegments', 'pqBits', 'sqType', 'metric']) {
    if (config[key] !== undefined) {
      nativeConfig[key] = config[key];
    }
  }

  return nativeConfig;
}

function snapshotMemory() {
  if (!process || typeof process.memoryUsage !== 'function') {
    return null;
  }

  const memory = process.memoryUsage();
  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  };
}

function createMetricsState() {
  return {
    createdAt: new Date().toISOString(),
    operations: {},
    peakRss: 0,
    lastMemory: snapshotMemory(),
    lastError: null,
  };
}

function normalizeIdArray(ids, name = 'ids') {
  let values;
  if (ids instanceof Int32Array) {
    values = Array.from(ids);
  } else if (ids instanceof Uint32Array) {
    values = Array.from(ids);
  } else if (Array.isArray(ids)) {
    values = ids;
  } else {
    throw new ValidationError(`${name} must be an array, Int32Array, or Uint32Array`);
  }

  if (values.length === 0) {
    throw new ValidationError(`${name} cannot be empty`);
  }

  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || value > 0x7fffffff) {
      throw new ValidationError(`${name} must contain non-negative 32-bit integers`, {
        details: { value },
      });
    }
  }

  return Int32Array.from(values);
}

function toSingleId(id) {
  if (!Number.isInteger(id) || id < 0) {
    throw new ValidationError('id must be a non-negative integer', { details: { id } });
  }

  return id;
}

function defaultLogger(entry) {
  const prefix = `[faiss-node:${entry.operation}]`;
  if (entry.error) {
    console.error(prefix, entry.message, entry.error);
  } else {
    console.error(prefix, entry.message);
  }
}

function wrapNativeError(error, context = {}) {
  if (error instanceof FaissError) {
    return error;
  }

  const message = error && error.message ? error.message : String(error);
  const options = {
    cause: error,
    operation: context.operation || null,
    suggestion: context.suggestion || null,
    details: context.details || null,
  };

  if (/disposed/i.test(message)) {
    return new IndexDisposedError(message, options);
  }

  if (/must match index dimensions|multiple of dimensions|evenly divide dims/i.test(message)) {
    return new DimensionMismatchError(message, options);
  }

  if (/NaN|Infinity|non-finite/i.test(message)) {
    return new InvalidVectorError(message, options);
  }

  if (/direct_map|not implemented|not supported|add_with_ids|unsupported/i.test(message)) {
    return new UnsupportedOperationError(message, options);
  }

  if (/GPU|CUDA/i.test(message)) {
    return new GpuNotAvailableError(message, options);
  }

  return new FaissError(message, options);
}

function ensureFloat32Array(name, value) {
  if (!(value instanceof Float32Array)) {
    throw new InvalidVectorError(`${name} must be a Float32Array`);
  }
}

async function readJsonIfExists(filename) {
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

class FaissIndex {
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Expected config object');
    }

    if (!Number.isInteger(config.dims) || config.dims <= 0) {
      throw new ValidationError('dims must be a positive integer');
    }

    const indexType = config.factory !== undefined ? null : (config.type || 'FLAT_L2');

    if (config.factory !== undefined) {
      validateFactoryConfig(config);
    } else {
      validateIndexSpecificOptions(indexType, config);
    }

    this._initializeRuntime(config);

    try {
      const nativeConfig = buildNativeConfig(config, indexType);
      this._native = new FaissIndexWrapper(nativeConfig);
      this._syncStats(this._native.getStats());
    } catch (error) {
      throw wrapNativeError(error, {
        operation: 'constructor',
        suggestion: 'Verify the index config and your FAISS installation.',
      });
    }
  }

  _initializeRuntime(config = {}) {
    this._config = { ...config };
    this._debug = Boolean(config.debug);
    this._collectMetrics = config.collectMetrics !== false;
    this._logger = typeof config.logger === 'function' ? config.logger : defaultLogger;
    this._metadata = config.metadata || null;
    this.resetMetrics();
  }

  _syncStats(stats) {
    this._dims = stats.dims;
    this._type = stats.type;
    this._factory = stats.factory || null;
    this._metric = stats.metric;
  }

  _ensureActive() {
    if (!this._native) {
      throw new IndexDisposedError();
    }
  }

  _debugLog(operation, message, extra = {}) {
    if (!this._debug) {
      return;
    }

    this._logger({
      operation,
      message,
      type: this._type,
      dims: this._dims,
      ...extra,
    });
  }

  _recordMetric(operation, durationMs, extra = {}) {
    if (!this._collectMetrics) {
      return;
    }

    if (!this._metrics.operations[operation]) {
      this._metrics.operations[operation] = {
        count: 0,
        totalMs: 0,
        lastMs: 0,
        averageMs: 0,
        lastDetails: null,
      };
    }

    const entry = this._metrics.operations[operation];
    entry.count += 1;
    entry.totalMs += durationMs;
    entry.lastMs = durationMs;
    entry.averageMs = entry.totalMs / entry.count;
    entry.lastDetails = extra;

    const memory = snapshotMemory();
    this._metrics.lastMemory = memory;
    if (memory && memory.rss > this._metrics.peakRss) {
      this._metrics.peakRss = memory.rss;
    }
  }

  async _runAsync(operation, fn, context = {}) {
    const start = process.hrtime.bigint();
    try {
      const result = await fn();
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this._recordMetric(operation, durationMs, context);
      this._debugLog(operation, 'completed', { durationMs, context });
      return result;
    } catch (error) {
      const wrapped = wrapNativeError(error, { operation, ...context });
      this._metrics.lastError = {
        operation,
        message: wrapped.message,
        code: wrapped.code,
        at: new Date().toISOString(),
      };
      this._debugLog(operation, 'failed', { error: wrapped });
      throw wrapped;
    }
  }

  _runSync(operation, fn, context = {}) {
    const start = process.hrtime.bigint();
    try {
      const result = fn();
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this._recordMetric(operation, durationMs, context);
      this._debugLog(operation, 'completed', { durationMs, context });
      return result;
    } catch (error) {
      const wrapped = wrapNativeError(error, { operation, ...context });
      this._metrics.lastError = {
        operation,
        message: wrapped.message,
        code: wrapped.code,
        at: new Date().toISOString(),
      };
      this._debugLog(operation, 'failed', { error: wrapped });
      throw wrapped;
    }
  }

  _validateVectorArray(name, vectors, expectedCount = null) {
    ensureFloat32Array(name, vectors);

    if (vectors.length === 0) {
      throw new InvalidVectorError(`${name} cannot be empty`);
    }

    const count = getVectorCountForArray(vectors.length, this._dims);
    if (expectedCount !== null && count !== expectedCount) {
      throw new DimensionMismatchError(
        `${name} must contain exactly ${expectedCount} vector(s) of ${this._dims} dimensions`,
        { details: { count, expectedCount, dims: this._dims } }
      );
    }

    const report = validateVectors(vectors, this._dims);
    if (report.hasNaNOrInfinity) {
      throw new InvalidVectorError(`${name} contains NaN or Infinity values`, { details: report });
    }

    return count;
  }

  getConfig() {
    return {
      dims: this._dims,
      type: this._type,
      factory: this._factory,
      metric: this._metric,
      debug: this._debug,
      collectMetrics: this._collectMetrics,
      ...this._config,
    };
  }

  setDebug(enabled) {
    this._debug = Boolean(enabled);
  }

  getMetrics() {
    return JSON.parse(JSON.stringify(this._metrics));
  }

  resetMetrics() {
    this._metrics = createMetricsState();
  }

  getVectorCount() {
    return this.getStats().ntotal;
  }

  async add(vectors, ids) {
    this._ensureActive();
    if (ids !== undefined) {
      throw new UnsupportedOperationError(
        'Explicit vector ids are not supported by this wrapper yet',
        { suggestion: 'Use sequential internal ids, or wrap the underlying FAISS index with an ID map in a future revision.' }
      );
    }

    const vectorCount = this._validateVectorArray('vectors', vectors);
    return this._runAsync('add', async () => {
      await this._native.add(vectors);
    }, { vectorCount });
  }

  async addWithProgress(vectors, options = {}) {
    this._ensureActive();
    const vectorCount = this._validateVectorArray('vectors', vectors);
    const batchSize = options.batchSize || 10000;
    validatePositiveInteger('batchSize', batchSize);

    const chunks = splitVectors(vectors, this._dims, batchSize);
    const totalVectors = vectorCount;
    let processed = 0;

    return this._runAsync('addWithProgress', async () => {
      for (let i = 0; i < chunks.length; i++) {
        await this._native.add(chunks[i]);
        processed += chunks[i].length / this._dims;

        if (typeof options.onProgress === 'function') {
          options.onProgress({
            operation: 'add',
            batch: i + 1,
            totalBatches: chunks.length,
            processed,
            total: totalVectors,
            percentage: totalVectors === 0 ? 100 : (processed / totalVectors) * 100,
          });
        }
      }
    }, { vectorCount: totalVectors, batchSize });
  }

  async train(vectors) {
    this._ensureActive();
    const vectorCount = this._validateVectorArray('vectors', vectors);
    return this._runAsync('train', async () => {
      await this._native.train(vectors);
    }, { vectorCount });
  }

  async trainWithProgress(vectors, options = {}) {
    this._ensureActive();
    const vectorCount = this._validateVectorArray('vectors', vectors);
    const notify = typeof options.onProgress === 'function' ? options.onProgress : null;

    return this._runAsync('trainWithProgress', async () => {
      if (notify) {
        notify({ operation: 'train', stage: 'validated', percentage: 10, total: vectorCount });
      }

      if (notify) {
        notify({ operation: 'train', stage: 'submitted', percentage: 50, total: vectorCount });
      }

      await this._native.train(vectors);

      if (notify) {
        notify({ operation: 'train', stage: 'completed', percentage: 100, total: vectorCount });
      }
    }, { vectorCount });
  }

  setNprobe(nprobe) {
    this._ensureActive();
    validatePositiveInteger('nprobe', nprobe);
    return this._runSync('setNprobe', () => this._native.setNprobe(nprobe), { nprobe });
  }

  async search(query, k) {
    this._ensureActive();
    this._validateVectorArray('query', query, 1);
    validatePositiveInteger('k', k);

    return this._runAsync('search', async () => {
      const results = await this._native.search(query, k);
      return {
        distances: results.distances,
        labels: results.labels,
      };
    }, { k });
  }

  async searchBatch(queries, k) {
    this._ensureActive();
    const nq = this._validateVectorArray('queries', queries);
    validatePositiveInteger('k', k);

    return this._runAsync('searchBatch', async () => {
      const results = await this._native.searchBatch(queries, k);
      return {
        distances: results.distances,
        labels: results.labels,
        nq: results.nq,
        k: results.k,
      };
    }, { k, nq });
  }

  async rangeSearch(query, radius) {
    this._ensureActive();
    this._validateVectorArray('query', query, 1);

    if (typeof radius !== 'number' || radius < 0 || !Number.isFinite(radius)) {
      throw new ValidationError('radius must be a non-negative finite number');
    }

    return this._runAsync('rangeSearch', async () => {
      const results = await this._native.rangeSearch(query, radius);
      return {
        distances: results.distances,
        labels: results.labels,
        nq: results.nq,
        lims: results.lims,
      };
    }, { radius });
  }

  async reconstruct(id) {
    this._ensureActive();
    const normalizedId = toSingleId(id);
    return this._runAsync('reconstruct', () => this._native.reconstruct(normalizedId), {
      details: { id: normalizedId },
      suggestion: 'Older IVF indexes saved without a FAISS direct map may need to be rebuilt before reconstruction works.',
    });
  }

  async reconstructBatch(ids) {
    this._ensureActive();
    const normalizedIds = normalizeIdArray(ids);
    return this._runAsync('reconstructBatch', () => this._native.reconstructBatch(normalizedIds), {
      details: { count: normalizedIds.length },
      suggestion: 'Older IVF indexes saved without a FAISS direct map may need to be rebuilt before batch reconstruction works.',
    });
  }

  async getVectorById(id) {
    return this.reconstruct(id);
  }

  async removeIds(ids) {
    this._ensureActive();
    const normalizedIds = normalizeIdArray(ids);
    return this._runAsync('removeIds', async () => {
      return await this._native.removeIds(normalizedIds);
    }, {
      details: { count: normalizedIds.length },
      suggestion: 'Some FAISS index families do not support in-place removals. If this fails, rebuild the index from filtered vectors.',
    });
  }

  getStats() {
    this._ensureActive();
    return this._runSync('getStats', () => {
      const stats = this._native.getStats();
      this._syncStats(stats);
      return stats;
    });
  }

  inspect(options = {}) {
    const stats = this.getStats();
    const hints = [];

    if (IVF_TYPES.has(stats.type)) {
      hints.push('IVF indexes support nprobe tuning. Higher nprobe usually improves recall at the cost of latency.');
    }

    if (stats.metric === 'ip') {
      hints.push('For cosine similarity, normalize vectors before indexing when using inner-product search.');
    }

    if (stats.factory) {
      hints.push(`Factory: ${stats.factory}`);
    }

    const inspection = {
      stats,
      config: this.getConfig(),
      metrics: this.getMetrics(),
      gpu: FaissIndex.gpuSupport(),
      hints,
    };

    if (options.format === 'text') {
      return [
        `Type: ${stats.type}`,
        `Dims: ${stats.dims}`,
        `Vectors: ${stats.ntotal}`,
        `Trained: ${stats.isTrained}`,
        `Metric: ${stats.metric}`,
        stats.factory ? `Factory: ${stats.factory}` : null,
        hints.length > 0 ? `Hints: ${hints.join(' ')}` : null,
      ].filter(Boolean).join('\n');
    }

    return inspection;
  }

  async validate(options = {}) {
    this._ensureActive();
    const stats = this.getStats();
    const checks = [];
    const warnings = [];
    let valid = true;

    checks.push({
      name: 'dimensions',
      passed: Number.isInteger(stats.dims) && stats.dims > 0,
      message: `dims=${stats.dims}`,
    });

    checks.push({
      name: 'vectorCount',
      passed: Number.isInteger(stats.ntotal) && stats.ntotal >= 0,
      message: `ntotal=${stats.ntotal}`,
    });

    if (stats.ntotal > 0 && options.sampleSize !== 0) {
      const sampleSize = Math.min(options.sampleSize || 3, stats.ntotal);
      const sampleIds = [];
      const step = Math.max(1, Math.floor(stats.ntotal / sampleSize));
      for (let id = 0; id < stats.ntotal && sampleIds.length < sampleSize; id += step) {
        sampleIds.push(id);
      }
      if (sampleIds[sampleIds.length - 1] !== stats.ntotal - 1) {
        sampleIds.push(stats.ntotal - 1);
      }

      try {
        const reconstructed = await this.reconstructBatch(sampleIds);
        const report = validateVectors(reconstructed, this._dims);
        checks.push({
          name: 'reconstructBatch',
          passed: report.valid,
          message: `sampleIds=${sampleIds.join(',')}`,
        });
        if (!report.valid) {
          valid = false;
          warnings.push('Sampled reconstructions contained invalid values.');
        }
      } catch (error) {
        warnings.push(`Could not reconstruct sample vectors: ${error.message}`);
      }

      try {
        const query = await this.reconstruct(sampleIds[0]);
        const results = await this.search(query, Math.min(1, stats.ntotal));
        const passed = results.labels.length > 0 && results.labels[0] >= 0;
        checks.push({
          name: 'selfSearch',
          passed,
          message: passed ? 'search returned at least one label' : 'search returned no labels',
        });
        valid = valid && passed;
      } catch (error) {
        warnings.push(`Could not run validation search: ${error.message}`);
      }
    }

    return {
      valid: valid && checks.every((check) => check.passed),
      stats,
      checks,
      warnings,
    };
  }

  reset() {
    this._ensureActive();
    return this._runSync('reset', () => this._native.reset());
  }

  dispose() {
    if (this._native) {
      try {
        this._native.dispose();
      } finally {
        this._native = null;
      }
    }
  }

  async save(filename) {
    this._ensureActive();
    validateNonEmptyString('filename', filename);

    return this._runAsync('save', async () => {
      await this._native.save(filename);
    }, { filename });
  }

  async saveMetadata(filename, extra = {}) {
    validateNonEmptyString('filename', filename);

    const payload = {
      version: 1,
      kind: 'float',
      index: this.inspect(),
      extra,
      savedAt: new Date().toISOString(),
    };

    const metadataPath = `${filename}.meta.json`;
    await fs.writeFile(metadataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    this._metadata = payload;
    return metadataPath;
  }

  async saveWithMetadata(filename, extra = {}) {
    await this.save(filename);
    return this.saveMetadata(filename, extra);
  }

  async toBuffer() {
    this._ensureActive();
    return this._runAsync('toBuffer', () => this._native.toBuffer());
  }

  async mergeFrom(otherIndex) {
    this._ensureActive();

    if (!otherIndex || !otherIndex._native) {
      throw new ValidationError('otherIndex must be a valid FaissIndex');
    }

    if (otherIndex._dims !== this._dims) {
      throw new DimensionMismatchError(
        `Merging index must have the same dimensions. Got ${otherIndex._dims}, expected ${this._dims}`
      );
    }

    return this._runAsync('mergeFrom', async () => {
      await this._native.mergeFrom(otherIndex._native);
    }, { otherType: otherIndex._type });
  }

  async toGpu(device = 0) {
    this._ensureActive();
    if (!Number.isInteger(device) || device < 0) {
      throw new ValidationError('device must be a non-negative integer', { details: { device } });
    }

    return this._runSync('toGpu', () => {
      this._native.toGpu(device);
      this._syncStats(this._native.getStats());
      return this;
    }, {
      device,
      suggestion: 'Rebuild against a CUDA-enabled FAISS installation and a GPU-capable addon build.',
    });
  }

  async toCpu() {
    this._ensureActive();
    return this._runSync('toCpu', () => {
      this._native.toCpu();
      this._syncStats(this._native.getStats());
      return this;
    });
  }

  static gpuSupport() {
    if (typeof FaissIndexWrapper.gpuSupport === 'function') {
      return FaissIndexWrapper.gpuSupport();
    }
    return { ...GPU_SUPPORT };
  }

  static _fromNative(native, runtimeConfig = {}) {
    const index = Object.create(FaissIndex.prototype);
    index._native = native;
    index._initializeRuntime(runtimeConfig);
    index._syncStats(native.getStats());
    return index;
  }

  static async load(filename, runtimeConfig = {}) {
    validateNonEmptyString('filename', filename);

    try {
      const native = FaissIndexWrapper.load(filename);
      return FaissIndex._fromNative(native, runtimeConfig);
    } catch (error) {
      throw wrapNativeError(error, {
        operation: 'load',
        suggestion: 'Verify the file exists and was created by a compatible FAISS build.',
      });
    }
  }

  static async loadWithMetadata(filename, runtimeConfig = {}) {
    const index = await FaissIndex.load(filename, runtimeConfig);
    index._metadata = await readJsonIfExists(`${filename}.meta.json`);
    return index;
  }

  static async fromBuffer(buffer, runtimeConfig = {}) {
    if (!Buffer.isBuffer(buffer)) {
      throw new ValidationError('buffer must be a Node.js Buffer');
    }

    try {
      const native = FaissIndexWrapper.fromBuffer(buffer);
      return FaissIndex._fromNative(native, runtimeConfig);
    } catch (error) {
      throw wrapNativeError(error, {
        operation: 'fromBuffer',
        suggestion: 'Verify the buffer contains a valid FAISS index serialization.',
      });
    }
  }
}

module.exports = {
  FaissIndex,
  FaissBinaryIndex,
  normalizeVectors,
  validateVectors,
  splitVectors,
  computeDistances,
  validateBinaryVectors,
  FaissError,
  ValidationError,
  DimensionMismatchError,
  InvalidVectorError,
  IndexDisposedError,
  UnsupportedOperationError,
  GpuNotAvailableError,
  BinaryVectorError,
};
