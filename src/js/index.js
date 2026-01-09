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
     * @param {string} config.type - Index type ('FLAT_L2', 'IVF_FLAT', or 'HNSW')
     * @param {number} config.dims - Vector dimensions (required)
     */
    constructor(config) {
        if (!config || typeof config !== 'object') {
            throw new TypeError('Expected config object');
        }
        
        // Validate index type
        const validTypes = ['FLAT_L2', 'IVF_FLAT', 'HNSW'];
        if (config.type && !validTypes.includes(config.type)) {
            throw new Error(`Index type '${config.type}' not supported. Supported types: ${validTypes.join(', ')}`);
        }
        
        if (!Number.isInteger(config.dims) || config.dims <= 0) {
            throw new TypeError('dims must be a positive integer');
        }
        
        // Build config object for native wrapper
        const nativeConfig = { dims: config.dims };
        if (config.type) {
            nativeConfig.type = config.type;
        }
        if (config.nlist !== undefined) {
            nativeConfig.nlist = config.nlist;
        }
        if (config.nprobe !== undefined) {
            nativeConfig.nprobe = config.nprobe;
        }
        if (config.M !== undefined) {
            nativeConfig.M = config.M;
        }
        
        this._native = new FaissIndexWrapper(nativeConfig);
        this._dims = config.dims;
        this._type = config.type || 'FLAT_L2';
    }
    
    /**
     * Add vectors to the index
     * @param {Float32Array} vectors - Single vector or batch of vectors
     * @param {Float32Array} [ids] - Optional IDs for vectors (reserved for future use)
     * @returns {Promise<void>}
     */
    async add(vectors, ids) {
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
        
        if (!this._native) {
            throw new Error('Index has been disposed');
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
        if (!Number.isInteger(nprobe) || nprobe <= 0) {
            throw new TypeError('nprobe must be a positive integer');
        }
        
        if (!this._native) {
            throw new Error('Index has been disposed');
        }
        
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
        if (!this._native) {
            throw new Error('Index has been disposed');
        }
        
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
     * Get index statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        try {
            return this._native.getStats();
        } catch (error) {
            throw new Error(`Failed to get stats: ${error.message}`);
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
        try {
            return await this._native.toBuffer();
        } catch (error) {
            throw new Error(`Failed to serialize index: ${error.message}`);
        }
    }
    
    /**
     * Merge vectors from another index into this index
     * @param {FaissIndex} otherIndex - Another FaissIndex to merge from
     * @returns {Promise<void>}
     */
    async mergeFrom(otherIndex) {
        if (!this._native) {
            throw new Error('Index has been disposed');
        }
        
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
            return index;
        } catch (error) {
            throw new Error(`Failed to deserialize index: ${error.message}`);
        }
    }
}

module.exports = { FaissIndex };
