const fs = require('fs/promises');

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
  validateBinaryVectors,
} = require('./utils');

let FaissBinaryIndexWrapper;
try {
  FaissBinaryIndexWrapper = require('../../build/Release/faiss_node.node').FaissBinaryIndexWrapper;
} catch (e) {
  try {
    FaissBinaryIndexWrapper = require('../../build/faiss_node.node').FaissBinaryIndexWrapper;
  } catch (e2) {
    throw new Error('Native module not found. Run "npm run build" first.');
  }
}

const VALID_BINARY_TYPES = ['BINARY_FLAT', 'BINARY_HNSW', 'BINARY_IVF', 'BINARY_HASH'];
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

function validateNonNegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${name} must be a non-negative integer`, {
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

function defaultLogger(entry) {
  const prefix = `[faiss-node:${entry.operation}]`;
  if (entry.error) {
    console.error(prefix, entry.message, entry.error);
  } else {
    console.error(prefix, entry.message);
  }
}

function defaultWarningHandler(entry) {
  const message = `[faiss-node:${entry.operation}] ${entry.message}`;
  if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
    process.emitWarning(message, {
      code: entry.code || 'FAISS_NODE_WARNING',
    });
    return;
  }

  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(message);
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

  if (/bytes-per-vector|divisible by 8|multiple of/i.test(message)) {
    return new BinaryVectorError(message, options);
  }

  if (/must match|dimensions/i.test(message)) {
    return new DimensionMismatchError(message, options);
  }

  if (/unsupported|not supported|not implemented|direct_map|add_with_ids/i.test(message)) {
    return new UnsupportedOperationError(message, options);
  }

  if (/GPU|CUDA/i.test(message)) {
    return new GpuNotAvailableError(message, options);
  }

  return new FaissError(message, options);
}

function ensureUint8Array(name, value) {
  if (!ArrayBuffer.isView(value) || Object.prototype.toString.call(value) !== '[object Uint8Array]') {
    throw new BinaryVectorError(`${name} must be a Uint8Array`);
  }
}

function splitBinaryVectors(vectors, bytesPerVector, chunkSize) {
  validatePositiveInteger('chunkSize', chunkSize);
  const count = vectors.length / bytesPerVector;
  const chunks = [];

  for (let start = 0; start < count; start += chunkSize) {
    const end = Math.min(start + chunkSize, count);
    chunks.push(vectors.subarray(start * bytesPerVector, end * bytesPerVector));
  }

  return chunks;
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

function validateBinaryFactoryConfig(config) {
  validateNonEmptyString('factory', config.factory);

  if (config.type !== undefined) {
    throw new ValidationError('type cannot be combined with factory; use one or the other');
  }

  const factoryEncodedOptions = ['nlist', 'M', 'efConstruction', 'efSearch', 'hashBits', 'hashNflip'];
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

function validateBinaryIndexSpecificOptions(type, config) {
  if (!VALID_BINARY_TYPES.includes(type)) {
    throw new ValidationError(
      `Binary index type '${type}' not supported. Supported types: ${VALID_BINARY_TYPES.join(', ')}`
    );
  }

  if (type !== 'BINARY_IVF') {
    for (const key of ['nlist', 'nprobe']) {
      if (config[key] !== undefined) {
        throw new ValidationError(`${key} is only supported for BINARY_IVF indexes`);
      }
    }
  }

  if (type !== 'BINARY_HNSW') {
    for (const key of ['M', 'efConstruction', 'efSearch']) {
      if (config[key] !== undefined) {
        throw new ValidationError(`${key} is only supported for BINARY_HNSW indexes`);
      }
    }
  }

  if (type !== 'BINARY_HASH') {
    for (const key of ['hashBits', 'hashNflip']) {
      if (config[key] !== undefined) {
        throw new ValidationError(`${key} is only supported for BINARY_HASH indexes`);
      }
    }
  }

  for (const key of ['nlist', 'nprobe', 'M', 'efConstruction']) {
    if (config[key] !== undefined) {
      validatePositiveInteger(key, config[key]);
    }
  }

  if (config.efSearch !== undefined) {
    validatePositiveInteger('efSearch', config.efSearch);
  }

  if (config.hashBits !== undefined) {
    validatePositiveInteger('hashBits', config.hashBits);
  }

  if (config.hashNflip !== undefined) {
    validateNonNegativeInteger('hashNflip', config.hashNflip);
  }
}

function buildNativeBinaryConfig(config, indexType) {
  const nativeConfig = { dims: config.dims };

  if (config.factory !== undefined) {
    nativeConfig.factory = config.factory;
    if (config.nprobe !== undefined) {
      nativeConfig.nprobe = config.nprobe;
    }
    return nativeConfig;
  }

  nativeConfig.type = indexType;
  for (const key of ['nlist', 'nprobe', 'M', 'efConstruction', 'efSearch', 'hashBits', 'hashNflip']) {
    if (config[key] !== undefined) {
      nativeConfig[key] = config[key];
    }
  }

  return nativeConfig;
}

class FaissBinaryIndex {
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Expected config object');
    }

    if (!Number.isInteger(config.dims) || config.dims <= 0) {
      throw new ValidationError('dims must be a positive integer');
    }

    if (config.dims % 8 !== 0) {
      throw new BinaryVectorError('Binary dims must be divisible by 8', {
        details: { dims: config.dims },
      });
    }

    const indexType = config.factory !== undefined ? null : (config.type || 'BINARY_FLAT');
    if (config.factory !== undefined) {
      validateBinaryFactoryConfig(config);
    } else {
      validateBinaryIndexSpecificOptions(indexType, config);
    }

    this._initializeRuntime(config);

    try {
      const nativeConfig = buildNativeBinaryConfig(config, indexType);
      this._native = new FaissBinaryIndexWrapper(nativeConfig);
      this._syncStats(this._native.getStats());
    } catch (error) {
      throw wrapNativeError(error, {
        operation: 'constructor',
        suggestion: 'Verify the binary index config and your FAISS installation.',
      });
    }
  }

  _initializeRuntime(config = {}) {
    this._config = { ...config };
    this._debug = Boolean(config.debug);
    this._collectMetrics = config.collectMetrics !== false;
    this._logger = typeof config.logger === 'function' ? config.logger : defaultLogger;
    this._warningHandler = typeof config.warningHandler === 'function'
      ? config.warningHandler
      : defaultWarningHandler;
    this._metadata = config.metadata || null;
    this.resetMetrics();
  }

  _syncStats(stats) {
    this._dims = stats.dims;
    this._type = stats.type;
    this._factory = stats.factory || null;
    this._metric = stats.metric;
    this._bytesPerVector = stats.bytesPerVector || (stats.dims / 8);
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

  _warn(operation, message, extra = {}) {
    this._warningHandler({
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

  _validateBinaryVectorArray(name, vectors, expectedCount = null) {
    ensureUint8Array(name, vectors);

    if (vectors.length === 0) {
      throw new BinaryVectorError(`${name} cannot be empty`);
    }

    const report = validateBinaryVectors(vectors, this._dims);
    if (expectedCount !== null && report.vectorCount !== expectedCount) {
      throw new DimensionMismatchError(
        `${name} must contain exactly ${expectedCount} binary vector(s) of ${this._dims} bits`,
        { details: { count: report.vectorCount, expectedCount, dims: this._dims } }
      );
    }

    return report.vectorCount;
  }

  getConfig() {
    return {
      kind: 'binary',
      dims: this._dims,
      type: this._type,
      factory: this._factory,
      metric: this._metric,
      bytesPerVector: this._bytesPerVector,
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

    const vectorCount = this._validateBinaryVectorArray('vectors', vectors);
    return this._runAsync('add', async () => {
      await this._native.add(vectors);
    }, { vectorCount });
  }

  async addWithProgress(vectors, options = {}) {
    this._ensureActive();
    const vectorCount = this._validateBinaryVectorArray('vectors', vectors);
    const batchSize = options.batchSize || 10000;
    validatePositiveInteger('batchSize', batchSize);

    const chunks = splitBinaryVectors(vectors, this._bytesPerVector, batchSize);
    let processed = 0;

    return this._runAsync('addWithProgress', async () => {
      for (let i = 0; i < chunks.length; i++) {
        await this._native.add(chunks[i]);
        processed += chunks[i].length / this._bytesPerVector;

        if (typeof options.onProgress === 'function') {
          options.onProgress({
            operation: 'add',
            batch: i + 1,
            totalBatches: chunks.length,
            processed,
            total: vectorCount,
            percentage: vectorCount === 0 ? 100 : (processed / vectorCount) * 100,
          });
        }
      }
    }, { vectorCount, batchSize });
  }

  async train(vectors) {
    this._ensureActive();
    const vectorCount = this._validateBinaryVectorArray('vectors', vectors);
    return this._runAsync('train', async () => {
      await this._native.train(vectors);
    }, { vectorCount });
  }

  async trainWithProgress(vectors, options = {}) {
    this._ensureActive();
    const vectorCount = this._validateBinaryVectorArray('vectors', vectors);
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
    this._validateBinaryVectorArray('query', query, 1);
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
    const nq = this._validateBinaryVectorArray('queries', queries);
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

  async reconstruct(id) {
    this._ensureActive();
    const normalizedId = toSingleId(id);
    return this._runAsync('reconstruct', () => this._native.reconstruct(normalizedId), {
      details: { id: normalizedId },
      suggestion: 'Older binary IVF indexes saved without a FAISS direct map may need to be rebuilt before reconstruction works.',
    });
  }

  async reconstructBatch(ids) {
    this._ensureActive();
    const normalizedIds = normalizeIdArray(ids);
    return this._runAsync('reconstructBatch', () => this._native.reconstructBatch(normalizedIds), {
      details: { count: normalizedIds.length },
      suggestion: 'Older binary IVF indexes saved without a FAISS direct map may need to be rebuilt before batch reconstruction works.',
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
      suggestion: 'Some FAISS binary index families do not support in-place removals. If this fails, rebuild the index from filtered vectors.',
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

    if (stats.type === 'BINARY_IVF') {
      hints.push('Binary IVF indexes support nprobe tuning. Higher nprobe usually improves recall at the cost of latency.');
    }

    if (stats.factory) {
      hints.push(`Factory: ${stats.factory}`);
    }

    const inspection = {
      kind: 'binary',
      stats,
      config: this.getConfig(),
      metrics: this.getMetrics(),
      gpu: FaissBinaryIndex.gpuSupport(),
      hints,
    };

    if (options.format === 'text') {
      return [
        `Type: ${stats.type}`,
        `Dims: ${stats.dims} bits`,
        `Bytes / vector: ${stats.bytesPerVector}`,
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
      passed: Number.isInteger(stats.dims) && stats.dims > 0 && stats.dims % 8 === 0,
      message: `dims=${stats.dims}`,
    });

    checks.push({
      name: 'bytesPerVector',
      passed: stats.bytesPerVector === stats.dims / 8,
      message: `bytesPerVector=${stats.bytesPerVector}`,
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
        const report = validateBinaryVectors(reconstructed, this._dims);
        checks.push({
          name: 'reconstructBatch',
          passed: report.valid,
          message: `sampleIds=${sampleIds.join(',')}`,
        });
        valid = valid && report.valid;
      } catch (error) {
        valid = false;
        checks.push({
          name: 'reconstructBatch',
          passed: false,
          message: error.message,
        });
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
        valid = false;
        checks.push({
          name: 'selfSearch',
          passed: false,
          message: error.message,
        });
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
      kind: 'binary',
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
      throw new ValidationError('otherIndex must be a valid FaissBinaryIndex');
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

    const support = FaissBinaryIndex.gpuSupport();
    if (support.available && this._type !== 'BINARY_FLAT') {
      return this._runSync('toGpu', () => {
        this._warn(
          'toGpu',
          `Binary index type ${this._type} is not supported on GPU. Staying on CPU.`,
          {
            code: 'FAISS_NODE_GPU_FALLBACK',
            device,
            fallback: 'cpu',
            requestedType: this._type,
          }
        );
        return this;
      }, {
        device,
        fallback: 'cpu',
        requestedType: this._type,
      });
    }

    return this._runSync('toGpu', () => {
      try {
        this._native.toGpu(device);
        this._syncStats(this._native.getStats());
        return this;
      } catch (error) {
        const wrapped = wrapNativeError(error, {
          operation: 'toGpu',
          suggestion: 'Rebuild against a CUDA-enabled FAISS installation and a GPU-capable addon build.',
          details: { device, type: this._type },
        });

        if (support.available && wrapped instanceof UnsupportedOperationError) {
          this._warn(
            'toGpu',
            `${wrapped.message} Staying on CPU.`,
            {
              code: 'FAISS_NODE_GPU_FALLBACK',
              device,
              fallback: 'cpu',
              requestedType: this._type,
            }
          );
          return this;
        }

        throw wrapped;
      }
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
    if (typeof FaissBinaryIndexWrapper.gpuSupport === 'function') {
      return FaissBinaryIndexWrapper.gpuSupport();
    }
    return { ...GPU_SUPPORT };
  }

  static _fromNative(native, runtimeConfig = {}) {
    const index = Object.create(FaissBinaryIndex.prototype);
    index._native = native;
    index._initializeRuntime(runtimeConfig);
    index._syncStats(native.getStats());
    return index;
  }

  static async load(filename, runtimeConfig = {}) {
    validateNonEmptyString('filename', filename);

    try {
      const native = FaissBinaryIndexWrapper.load(filename);
      return FaissBinaryIndex._fromNative(native, runtimeConfig);
    } catch (error) {
      throw wrapNativeError(error, {
        operation: 'load',
        suggestion: 'Verify the file exists and was created by a compatible FAISS binary build.',
      });
    }
  }

  static async loadWithMetadata(filename, runtimeConfig = {}) {
    const index = await FaissBinaryIndex.load(filename, runtimeConfig);
    index._metadata = await readJsonIfExists(`${filename}.meta.json`);
    return index;
  }

  static async fromBuffer(buffer, runtimeConfig = {}) {
    if (!Buffer.isBuffer(buffer)) {
      throw new ValidationError('buffer must be a Node.js Buffer');
    }

    try {
      const native = FaissBinaryIndexWrapper.fromBuffer(buffer);
      return FaissBinaryIndex._fromNative(native, runtimeConfig);
    } catch (error) {
      throw wrapNativeError(error, {
        operation: 'fromBuffer',
        suggestion: 'Verify the buffer contains a valid FAISS binary index serialization.',
      });
    }
  }
}

module.exports = {
  FaissBinaryIndex,
};
