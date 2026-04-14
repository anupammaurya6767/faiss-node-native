const {
  DimensionMismatchError,
  InvalidVectorError,
  BinaryVectorError,
} = require('./errors');

/**
 * @typedef {Object} ValidateVectorsOptions
 * @property {boolean} [throwOnError=false]
 */

/**
 * @typedef {Object} NonFiniteVectorEntry
 * @property {number} vectorIndex
 * @property {number} componentIndex
 * @property {number} value
 */

/**
 * @typedef {Object} VectorValidationReport
 * @property {boolean} valid
 * @property {number} vectorCount
 * @property {number} dims
 * @property {boolean} hasNaNOrInfinity
 * @property {NonFiniteVectorEntry[]} nonFinite
 * @property {number[]} zeroNormIndices
 * @property {number[]} invalidDimensions
 */

/**
 * @typedef {Object} DistanceOptions
 * @property {number} dims
 * @property {'l2' | 'ip' | 'cosine'} [metric='l2']
 */

function ensurePositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
}

function ensureFloat32Array(name, value) {
  if (!ArrayBuffer.isView(value) || Object.prototype.toString.call(value) !== '[object Float32Array]') {
    throw new TypeError(`${name} must be a Float32Array`);
  }
}

function ensureUint8Array(name, value) {
  if (!ArrayBuffer.isView(value) || Object.prototype.toString.call(value) !== '[object Uint8Array]') {
    throw new TypeError(`${name} must be a Uint8Array`);
  }
}

function getVectorCount(length, dims) {
  ensurePositiveInteger('dims', dims);
  if (length % dims !== 0) {
    throw new DimensionMismatchError(
      `Vector length (${length}) must be a multiple of dimensions (${dims})`,
      { details: { length, dims } }
    );
  }
  return length / dims;
}

/**
 * L2-normalize one or more float vectors.
 *
 * @param {Float32Array} vectors
 * @param {number} dims
 * @returns {Float32Array}
 */
function normalizeVectors(vectors, dims) {
  ensureFloat32Array('vectors', vectors);
  const count = getVectorCount(vectors.length, dims);
  const normalized = new Float32Array(vectors.length);

  for (let i = 0; i < count; i++) {
    let norm = 0;
    const offset = i * dims;

    for (let j = 0; j < dims; j++) {
      const value = vectors[offset + j];
      if (!Number.isFinite(value)) {
        throw new InvalidVectorError('Cannot normalize vectors with NaN or Infinity values', {
          details: { vectorIndex: i, componentIndex: j, value },
        });
      }
      norm += value * value;
    }

    norm = Math.sqrt(norm);
    if (norm === 0) {
      continue;
    }

    for (let j = 0; j < dims; j++) {
      normalized[offset + j] = vectors[offset + j] / norm;
    }
  }

  return normalized;
}

/**
 * Validate one or more float vectors.
 *
 * @param {Float32Array} vectors
 * @param {number} dims
 * @param {ValidateVectorsOptions} [options={}]
 * @returns {VectorValidationReport}
 */
function validateVectors(vectors, dims, options = {}) {
  ensureFloat32Array('vectors', vectors);
  const count = getVectorCount(vectors.length, dims);
  const zeroNormIndices = [];
  const nonFinite = [];
  const invalidDimensions = [];

  for (let i = 0; i < count; i++) {
    let norm = 0;
    const offset = i * dims;
    for (let j = 0; j < dims; j++) {
      const value = vectors[offset + j];
      if (!Number.isFinite(value)) {
        nonFinite.push({ vectorIndex: i, componentIndex: j, value });
      } else {
        norm += value * value;
      }
    }

    if (norm === 0) {
      zeroNormIndices.push(i);
    }

    if (offset + dims > vectors.length) {
      invalidDimensions.push(i);
    }
  }

  const report = {
    valid: nonFinite.length === 0 && invalidDimensions.length === 0,
    vectorCount: count,
    dims,
    hasNaNOrInfinity: nonFinite.length > 0,
    nonFinite,
    zeroNormIndices,
    invalidDimensions,
  };

  if (options.throwOnError && !report.valid) {
    throw new InvalidVectorError('Vector validation failed', { details: report });
  }

  return report;
}

/**
 * Split float vectors into chunks by vector count.
 *
 * @param {Float32Array} vectors
 * @param {number} dims
 * @param {number} chunkSize
 * @returns {Float32Array[]}
 */
function splitVectors(vectors, dims, chunkSize) {
  ensureFloat32Array('vectors', vectors);
  ensurePositiveInteger('chunkSize', chunkSize);
  const count = getVectorCount(vectors.length, dims);
  const chunks = [];

  for (let start = 0; start < count; start += chunkSize) {
    const end = Math.min(start + chunkSize, count);
    chunks.push(vectors.subarray(start * dims, end * dims));
  }

  return chunks;
}

/**
 * Compute pairwise distances or similarities between float vectors.
 *
 * Supports one-to-one comparisons or broadcasting when either side contains a
 * single vector.
 *
 * @param {Float32Array} left
 * @param {Float32Array} right
 * @param {DistanceOptions} options
 * @returns {Float32Array}
 */
function computeDistances(left, right, options = {}) {
  ensureFloat32Array('left', left);
  ensureFloat32Array('right', right);

  const dims = options.dims;
  ensurePositiveInteger('dims', dims);

  const metric = options.metric || 'l2';
  if (metric !== 'l2' && metric !== 'ip' && metric !== 'cosine') {
    throw new TypeError('metric must be one of: l2, ip, cosine');
  }

  const leftCount = getVectorCount(left.length, dims);
  const rightCount = getVectorCount(right.length, dims);

  if (!(leftCount === rightCount || leftCount === 1 || rightCount === 1)) {
    throw new DimensionMismatchError(
      'left and right must have the same vector count, or one side must contain a single vector for broadcasting',
      { details: { leftCount, rightCount, dims } }
    );
  }

  const resultCount = Math.max(leftCount, rightCount);
  const distances = new Float32Array(resultCount);

  for (let i = 0; i < resultCount; i++) {
    const leftIndex = leftCount === 1 ? 0 : i;
    const rightIndex = rightCount === 1 ? 0 : i;
    const leftOffset = leftIndex * dims;
    const rightOffset = rightIndex * dims;

    let value = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let j = 0; j < dims; j++) {
      const a = left[leftOffset + j];
      const b = right[rightOffset + j];

      if (metric === 'l2') {
        const diff = a - b;
        value += diff * diff;
      } else {
        value += a * b;
        leftNorm += a * a;
        rightNorm += b * b;
      }
    }

    if (metric === 'cosine') {
      const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
      distances[i] = denom === 0 ? 0 : value / denom;
    } else {
      distances[i] = value;
    }
  }

  return distances;
}

/**
 * Validate one or more binary vectors packed into a Uint8Array.
 *
 * @param {Uint8Array} vectors
 * @param {number} dims
 * @returns {{ valid: true, dims: number, vectorCount: number, bytesPerVector: number }}
 */
function validateBinaryVectors(vectors, dims) {
  ensureUint8Array('vectors', vectors);
  ensurePositiveInteger('dims', dims);

  if (dims % 8 !== 0) {
    throw new BinaryVectorError('Binary vector dimensions must be divisible by 8', {
      details: { dims },
    });
  }

  const bytesPerVector = dims / 8;
  if (vectors.length % bytesPerVector !== 0) {
    throw new BinaryVectorError(
      `Binary vector length (${vectors.length}) must be a multiple of ${bytesPerVector} bytes`,
      { details: { length: vectors.length, bytesPerVector } }
    );
  }

  return {
    valid: true,
    dims,
    vectorCount: vectors.length / bytesPerVector,
    bytesPerVector,
  };
}

module.exports = {
  normalizeVectors,
  validateVectors,
  splitVectors,
  computeDistances,
  validateBinaryVectors,
  getVectorCount,
};
