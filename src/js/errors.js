class FaissError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'FAISS_ERROR';
    this.operation = options.operation || null;
    this.suggestion = options.suggestion || null;
    this.details = options.details || null;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

class ValidationError extends FaissError {
  constructor(message, options = {}) {
    super(message, { code: 'VALIDATION_ERROR', ...options });
  }
}

class DimensionMismatchError extends ValidationError {
  constructor(message, options = {}) {
    super(message, { code: 'DIMENSION_MISMATCH', ...options });
  }
}

class InvalidVectorError extends ValidationError {
  constructor(message, options = {}) {
    super(message, { code: 'INVALID_VECTOR', ...options });
  }
}

class IndexDisposedError extends FaissError {
  constructor(message = 'Index has been disposed', options = {}) {
    super(message, { code: 'INDEX_DISPOSED', ...options });
  }
}

class UnsupportedOperationError extends FaissError {
  constructor(message, options = {}) {
    super(message, { code: 'UNSUPPORTED_OPERATION', ...options });
  }
}

class GpuNotAvailableError extends FaissError {
  constructor(message = 'GPU support is not available in this build', options = {}) {
    super(message, { code: 'GPU_NOT_AVAILABLE', ...options });
  }
}

class BinaryVectorError extends ValidationError {
  constructor(message, options = {}) {
    super(message, { code: 'BINARY_VECTOR_ERROR', ...options });
  }
}

module.exports = {
  FaissError,
  ValidationError,
  DimensionMismatchError,
  InvalidVectorError,
  IndexDisposedError,
  UnsupportedOperationError,
  GpuNotAvailableError,
  BinaryVectorError,
};
