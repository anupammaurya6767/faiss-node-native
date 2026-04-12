// Try to load the native module (path may vary based on build system)
let FaissIndexWrapper;
try {
  // node-gyp build path
  FaissIndexWrapper = require('../../build/Release/faiss_node.node').FaissIndexWrapper;
} catch (e) {
  try {
    // CMake build path
    FaissIndexWrapper = require('../../build/faiss_node.node').FaissIndexWrapper;
  } catch (e2) {
    throw new Error('Native module not found. Run "npm run build" first.');
  }
}

function validatePositiveInteger(name, value) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive integer`);
    }
}

function validateNonEmptyString(name, value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${name} must be a non-empty string`);
    }
}

const VALID_TYPES = ['FLAT_L2', 'FLAT_IP', 'IVF_FLAT', 'HNSW', 'PQ', 'IVF_PQ', 'IVF_SQ'];
const IVF_TYPES = new Set(['IVF_FLAT', 'IVF_PQ', 'IVF_SQ']);
const PQ_TYPES = new Set(['PQ', 'IVF_PQ']);
const VALID_METRICS = new Set(['l2', 'ip']);

function validateMetric(type, metric) {
    if (metric === undefined) {
        return;
    }

    if (!VALID_METRICS.has(metric)) {
        throw new TypeError(`metric must be one of: ${Array.from(VALID_METRICS).join(', ')}`);
    }

    if (type === 'FLAT_L2' && metric !== 'l2') {
        throw new TypeError('FLAT_L2 indexes only support metric "l2"');
    }

    if (type === 'FLAT_IP' && metric !== 'ip') {
        throw new TypeError('FLAT_IP indexes only support metric "ip"');
    }
}

function validateFactoryConfig(config) {
    validateNonEmptyString('factory', config.factory);
    validateMetric(undefined, config.metric);

    if (config.type !== undefined) {
        throw new TypeError('type cannot be combined with factory; use one or the other');
    }

    const factoryEncodedOptions = ['nlist', 'M', 'efConstruction', 'efSearch', 'pqSegments', 'pqBits', 'sqType'];
    for (const key of factoryEncodedOptions) {
        if (config[key] !== undefined) {
            throw new TypeError(`${key} cannot be combined with factory; encode it directly in the factory string`);
        }
    }

    if (config.nprobe !== undefined) {
        validatePositiveInteger('nprobe', config.nprobe);
    }
}

function validateIndexSpecificOptions(type, config) {
    if (!VALID_TYPES.includes(type)) {
        throw new Error(`Index type '${type}' not supported. Supported types: ${VALID_TYPES.join(', ')}`);
    }

    validateMetric(type, config.metric);

    const ivfOnlyOptions = ['nlist', 'nprobe'];
    const hnswOnlyOptions = ['M', 'efConstruction', 'efSearch'];
    const pqOnlyOptions = ['pqSegments', 'pqBits'];

    if (!IVF_TYPES.has(type)) {
        for (const key of ivfOnlyOptions) {
            if (config[key] !== undefined) {
                throw new TypeError(`${key} is only supported for IVF_FLAT, IVF_PQ, and IVF_SQ indexes`);
            }
        }
    }

    if (type !== 'HNSW') {
        for (const key of hnswOnlyOptions) {
            if (config[key] !== undefined) {
                throw new TypeError(`${key} is only supported for HNSW indexes`);
            }
        }
    }

    if (!PQ_TYPES.has(type)) {
        for (const key of pqOnlyOptions) {
            if (config[key] !== undefined) {
                throw new TypeError(`${key} is only supported for PQ and IVF_PQ indexes`);
            }
        }
    }

    if (type !== 'IVF_SQ' && config.sqType !== undefined) {
        throw new TypeError('sqType is only supported for IVF_SQ indexes');
    }

    for (const key of ['nlist', 'nprobe', 'M', 'efConstruction', 'efSearch', 'pqSegments', 'pqBits']) {
        if (config[key] !== undefined) {
            validatePositiveInteger(key, config[key]);
        }
    }

    if (config.pqSegments !== undefined && config.dims % config.pqSegments !== 0) {
        throw new RangeError(
            `pqSegments must evenly divide dims. Got dims=${config.dims}, pqSegments=${config.pqSegments}`
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

/**
 * FaissIndex - High-level JavaScript API for FAISS vector similarity search
 * 
 * @example
 * const index = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
 * await index.add(vectors);
 * const results = await index.search(query, 10);
 */
class FaissIndex {
    /**
     * Create a new FAISS index
     * @param {Object} config - Configuration object
     * @param {string} [config.type] - Index type ('FLAT_L2', 'FLAT_IP', 'IVF_FLAT', 'HNSW', 'PQ', 'IVF_PQ', or 'IVF_SQ')
     * @param {string} [config.factory] - Raw FAISS factory string for advanced pipelines
     * @param {number} config.dims - Vector dimensions (required)
     */
    constructor(config) {
        if (!config || typeof config !== 'object') {
            throw new TypeError('Expected config object');
        }

        if (!Number.isInteger(config.dims) || config.dims <= 0) {
            throw new TypeError('dims must be a positive integer');
        }

        const indexType = config.factory !== undefined ? null : (config.type || 'FLAT_L2');

        if (config.factory !== undefined) {
            validateFactoryConfig(config);
        } else {
            validateIndexSpecificOptions(indexType, config);
        }

        const nativeConfig = buildNativeConfig(config, indexType);
        
        this._native = new FaissIndexWrapper(nativeConfig);
        const stats = this._native.getStats();
        this._dims = stats.dims;
        this._type = stats.type;
        this._factory = stats.factory || null;
        this._metric = stats.metric;
    }

    _ensureActive() {
        if (!this._native) {
            throw new Error('Index has been disposed');
        }
    }
    
    /**
     * Add vectors to the index
     * @param {Float32Array} vectors - Single vector or batch of vectors
     * @param {Float32Array} [ids] - Optional IDs for vectors (reserved for future use)
     * @returns {Promise<void>}
     */
    async add(vectors, ids) {
        this._ensureActive();

        if (!(vectors instanceof Float32Array)) {
            throw new TypeError('vectors must be a Float32Array');
        }
        
        if (vectors.length === 0) {
            throw new Error('Cannot add empty vector array');
        }
        
        if (vectors.length % this._dims !== 0) {
            throw new Error(
                `Vector length (${vectors.length}) must be a multiple of dimensions (${this._dims})`
            );
        }
        
        // Async operation using background worker
        try {
            await this._native.add(vectors);
        } catch (error) {
            throw new Error(`Failed to add vectors: ${error.message}`);
        }
    }
    
    /**
     * Train the index (required for IVF indexes before adding vectors)
     * @param {Float32Array} vectors - Training vectors
     * @returns {Promise<void>}
     */
    async train(vectors) {
        this._ensureActive();

        if (!(vectors instanceof Float32Array)) {
            throw new TypeError('vectors must be a Float32Array');
        }
        
        if (vectors.length === 0) {
            throw new Error('Cannot train with empty vector array');
        }
        
        if (vectors.length % this._dims !== 0) {
            throw new Error(
                `Vector length (${vectors.length}) must be a multiple of dimensions (${this._dims})`
            );
        }
        
        try {
            await this._native.train(vectors);
        } catch (error) {
            throw new Error(`Failed to train index: ${error.message}`);
        }
    }
    
    /**
     * Set nprobe for IVF indexes (number of clusters to search)
     * @param {number} nprobe - Number of clusters to probe
     */
    setNprobe(nprobe) {
        this._ensureActive();
        validatePositiveInteger('nprobe', nprobe);
        
        try {
            this._native.setNprobe(nprobe);
        } catch (error) {
            throw new Error(`Failed to set nprobe: ${error.message}`);
        }
    }
    
    /**
     * Search for k nearest neighbors (single query)
     * @param {Float32Array} query - Query vector
     * @param {number} k - Number of neighbors to return
     * @returns {Promise<{distances: Float32Array, labels: Int32Array}>}
     */
    async search(query, k) {
        this._ensureActive();

        if (!(query instanceof Float32Array)) {
            throw new TypeError('query must be a Float32Array');
        }
        
        if (query.length !== this._dims) {
            throw new Error(
                `Query vector length (${query.length}) must match index dimensions (${this._dims})`
            );
        }
        
        if (!Number.isInteger(k) || k <= 0) {
            throw new TypeError('k must be a positive integer');
        }
        
        // Async operation using background worker
        try {
            const results = await this._native.search(query, k);
            return {
                distances: results.distances,
                labels: results.labels
            };
        } catch (error) {
            throw new Error(`Search failed: ${error.message}`);
        }
    }
    
    /**
     * Batch search for k nearest neighbors (multiple queries)
     * @param {Float32Array} queries - Query vectors (nQueries * dims elements)
     * @param {number} k - Number of neighbors to return per query
     * @returns {Promise<{distances: Float32Array, labels: Int32Array, nq: number, k: number}>}
     */
    async searchBatch(queries, k) {
        this._ensureActive();
        
        if (!(queries instanceof Float32Array)) {
            throw new TypeError('queries must be a Float32Array');
        }
        
        if (queries.length === 0) {
            throw new Error('Queries array cannot be empty');
        }
        
        if (queries.length % this._dims !== 0) {
            throw new Error(
                `Queries array length (${queries.length}) must be a multiple of index dimensions (${this._dims})`
            );
        }
        
        if (!Number.isInteger(k) || k <= 0) {
            throw new TypeError('k must be a positive integer');
        }
        
        try {
            const results = await this._native.searchBatch(queries, k);
            return {
                distances: results.distances,
                labels: results.labels,
                nq: results.nq,
                k: results.k
            };
        } catch (error) {
            throw new Error(`Batch search failed: ${error.message}`);
        }
    }
    
    /**
     * Range search: find all vectors within distance threshold
     * @param {Float32Array} query - Query vector
     * @param {number} radius - Maximum distance threshold
     * @returns {Promise<{distances: Float32Array, labels: Int32Array, nq: number, lims: Uint32Array}>}
     */
    async rangeSearch(query, radius) {
        this._ensureActive();

        if (!(query instanceof Float32Array)) {
            throw new TypeError('query must be a Float32Array');
        }
        
        if (query.length !== this._dims) {
            throw new Error(
                `Query vector length (${query.length}) must match index dimensions (${this._dims})`
            );
        }
        
        if (typeof radius !== 'number' || radius < 0 || !isFinite(radius)) {
            throw new TypeError('radius must be a non-negative finite number');
        }
        
        // Async operation using background worker
        try {
            const results = await this._native.rangeSearch(query, radius);
            return {
                distances: results.distances,
                labels: results.labels,
                nq: results.nq,
                lims: results.lims
            };
        } catch (error) {
            throw new Error(`Range search failed: ${error.message}`);
        }
    }
    
    /**
     * Get index statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        this._ensureActive();

        try {
            return this._native.getStats();
        } catch (error) {
            throw new Error(`Failed to get stats: ${error.message}`);
        }
    }
    
    /**
     * Reset the index (clear all vectors, keep index structure)
     * Useful for reusing an index object without creating a new one
     * @returns {void}
     */
    reset() {
        this._ensureActive();
        
        try {
            this._native.reset();
        } catch (error) {
            throw new Error(`Failed to reset index: ${error.message}`);
        }
    }
    
    /**
     * Explicitly dispose of the index (optional, automatic on GC)
     */
    dispose() {
        if (this._native) {
            try {
                this._native.dispose();
                this._native = null;
            } catch (error) {
                // Ignore errors on dispose
            }
        }
    }
    
    /**
     * Save index to disk
     * @param {string} filename - Path to save the index
     * @returns {Promise<void>}
     */
    async save(filename) {
        this._ensureActive();

        if (typeof filename !== 'string' || filename.length === 0) {
            throw new TypeError('filename must be a non-empty string');
        }
        
        try {
            await this._native.save(filename);
        } catch (error) {
            throw new Error(`Failed to save index: ${error.message}`);
        }
    }
    
    /**
     * Serialize index to buffer
     * @returns {Promise<Buffer>}
     */
    async toBuffer() {
        this._ensureActive();

        try {
            return await this._native.toBuffer();
        } catch (error) {
            throw new Error(`Failed to serialize index: ${error.message}`);
        }
    }
    
    /**
     * Transfer vectors from another index into this index.
     * FAISS empties the source index as part of merge_from().
     * @param {FaissIndex} otherIndex - Another FaissIndex to merge from
     * @returns {Promise<void>}
     */
    async mergeFrom(otherIndex) {
        this._ensureActive();
        
        if (!otherIndex || !otherIndex._native) {
            throw new TypeError('otherIndex must be a valid FaissIndex');
        }
        
        if (otherIndex._dims !== this._dims) {
            throw new Error(
                `Merging index must have the same dimensions. Got ${otherIndex._dims}, expected ${this._dims}`
            );
        }
        
        try {
            await this._native.mergeFrom(otherIndex._native);
        } catch (error) {
            throw new Error(`Failed to merge index: ${error.message}`);
        }
    }
    
    /**
     * Load index from disk (static method)
     * @param {string} filename - Path to load the index from
     * @returns {Promise<FaissIndex>}
     */
    static async load(filename) {
        if (typeof filename !== 'string' || filename.length === 0) {
            throw new TypeError('filename must be a non-empty string');
        }
        
        try {
            const native = FaissIndexWrapper.load(filename);
            const stats = native.getStats();
            const index = Object.create(FaissIndex.prototype);
            index._native = native;
            index._dims = stats.dims;
            index._type = stats.type;
            index._factory = stats.factory || null;
            index._metric = stats.metric;
            return index;
        } catch (error) {
            throw new Error(`Failed to load index: ${error.message}`);
        }
    }
    
    /**
     * Deserialize index from buffer (static method)
     * @param {Buffer} buffer - Buffer containing serialized index
     * @returns {Promise<FaissIndex>}
     */
    static async fromBuffer(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            throw new TypeError('buffer must be a Node.js Buffer');
        }
        
        try {
            const native = FaissIndexWrapper.fromBuffer(buffer);
            const stats = native.getStats();
            const index = Object.create(FaissIndex.prototype);
            index._native = native;
            index._dims = stats.dims;
            index._type = stats.type;
            index._factory = stats.factory || null;
            index._metric = stats.metric;
            return index;
        } catch (error) {
            throw new Error(`Failed to deserialize index: ${error.message}`);
        }
    }
}

module.exports = { FaissIndex };
