export interface FaissIndexConfig {
  type?: 'FLAT_L2' | 'FLAT_IP' | 'IVF_FLAT' | 'HNSW' | 'PQ' | 'IVF_PQ' | 'IVF_SQ';
  factory?: string;
  dims: number;
  nlist?: number;
  nprobe?: number;
  M?: number;
  efConstruction?: number;
  efSearch?: number;
  metric?: 'l2' | 'ip';
  pqSegments?: number;
  pqBits?: number;
  sqType?: string;
  debug?: boolean;
  collectMetrics?: boolean;
  logger?: (entry: unknown) => void;
  metadata?: Record<string, unknown>;
}

export interface FaissBinaryIndexConfig {
  type?: 'BINARY_FLAT' | 'BINARY_HNSW' | 'BINARY_IVF' | 'BINARY_HASH';
  factory?: string;
  dims: number;
  nlist?: number;
  nprobe?: number;
  M?: number;
  efConstruction?: number;
  efSearch?: number;
  hashBits?: number;
  hashNflip?: number;
  debug?: boolean;
  collectMetrics?: boolean;
  logger?: (entry: unknown) => void;
  warningHandler?: (entry: unknown) => void;
  metadata?: Record<string, unknown>;
}

export interface SearchResults {
  distances: Float32Array;
  labels: Int32Array;
}

export interface BatchSearchResults extends SearchResults {
  nq: number;
  k: number;
}

export interface BinarySearchResults {
  distances: Int32Array;
  labels: Int32Array;
}

export interface BinaryBatchSearchResults extends BinarySearchResults {
  nq: number;
  k: number;
}

export interface RangeSearchResults {
  distances: Float32Array;
  labels: Int32Array;
  nq: number;
  lims: Uint32Array;
}

export interface IndexStats {
  ntotal: number;
  dims: number;
  isTrained: boolean;
  type: string;
  factory: string;
  metric: 'l2' | 'ip';
}

export interface BinaryIndexStats {
  ntotal: number;
  dims: number;
  bytesPerVector: number;
  isTrained: boolean;
  type: string;
  factory: string;
  metric: 'hamming';
}

export interface OperationMetricEntry {
  count: number;
  totalMs: number;
  lastMs: number;
  averageMs: number;
  lastDetails: Record<string, unknown> | null;
}

export interface IndexMetrics {
  createdAt: string;
  operations: Record<string, OperationMetricEntry>;
  peakRss: number;
  lastMemory: {
    rss: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  } | null;
  lastError: {
    operation: string;
    message: string;
    code: string;
    at: string;
  } | null;
}

export interface ProgressUpdate {
  operation: string;
  stage?: string;
  batch?: number;
  totalBatches?: number;
  processed?: number;
  total?: number;
  percentage?: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface IndexValidationReport {
  valid: boolean;
  stats: IndexStats;
  checks: ValidationCheck[];
  warnings: string[];
}

export interface BinaryIndexValidationReport {
  valid: boolean;
  stats: BinaryIndexStats;
  checks: ValidationCheck[];
  warnings: string[];
}

export interface GpuSupportReport {
  compiled: boolean;
  available: boolean;
  reason: string;
}

export interface InspectReport {
  kind?: 'float';
  stats: IndexStats;
  config: Record<string, unknown>;
  metrics: IndexMetrics;
  gpu: GpuSupportReport;
  hints: string[];
}

export interface BinaryInspectReport {
  kind: 'binary';
  stats: BinaryIndexStats;
  config: Record<string, unknown>;
  metrics: IndexMetrics;
  gpu: GpuSupportReport;
  hints: string[];
}

export declare class FaissError extends Error {
  code: string;
  operation: string | null;
  suggestion: string | null;
  details: unknown;
  cause?: unknown;
}

export declare class ValidationError extends FaissError {}
export declare class DimensionMismatchError extends ValidationError {}
export declare class InvalidVectorError extends ValidationError {}
export declare class IndexDisposedError extends FaissError {}
export declare class UnsupportedOperationError extends FaissError {}
export declare class GpuNotAvailableError extends FaissError {}
export declare class BinaryVectorError extends ValidationError {}

export declare class FaissIndex {
  constructor(config: FaissIndexConfig);

  add(vectors: Float32Array, ids?: Int32Array): Promise<void>;
  addWithProgress(vectors: Float32Array, options?: {
    batchSize?: number;
    onProgress?: (update: ProgressUpdate) => void;
  }): Promise<void>;

  train(vectors: Float32Array): Promise<void>;
  trainWithProgress(vectors: Float32Array, options?: {
    onProgress?: (update: ProgressUpdate) => void;
  }): Promise<void>;

  search(query: Float32Array, k: number): Promise<SearchResults>;
  searchBatch(queries: Float32Array, k: number): Promise<BatchSearchResults>;
  rangeSearch(query: Float32Array, radius: number): Promise<RangeSearchResults>;

  reconstruct(id: number): Promise<Float32Array>;
  reconstructBatch(ids: number[] | Int32Array | Uint32Array): Promise<Float32Array>;
  removeIds(ids: number[] | Int32Array | Uint32Array): Promise<number>;
  getVectorById(id: number): Promise<Float32Array>;
  getVectorCount(): number;

  setNprobe(nprobe: number): void;
  getStats(): IndexStats;
  getConfig(): Record<string, unknown>;
  getMetrics(): IndexMetrics;
  resetMetrics(): void;
  inspect(options?: { format?: 'object' | 'text' }): InspectReport | string;
  validate(options?: { sampleSize?: number }): Promise<IndexValidationReport>;
  setDebug(enabled: boolean): void;

  reset(): void;
  save(filename: string): Promise<void>;
  saveMetadata(filename: string, extra?: Record<string, unknown>): Promise<string>;
  saveWithMetadata(filename: string, extra?: Record<string, unknown>): Promise<string>;
  toBuffer(): Promise<Buffer>;
  mergeFrom(otherIndex: FaissIndex): Promise<void>;
  toGpu(device?: number): Promise<FaissIndex>;
  toCpu(): Promise<FaissIndex>;
  dispose(): void;

  static load(filename: string, runtimeConfig?: Partial<FaissIndexConfig>): Promise<FaissIndex>;
  static loadWithMetadata(filename: string, runtimeConfig?: Partial<FaissIndexConfig>): Promise<FaissIndex>;
  static fromBuffer(buffer: Buffer, runtimeConfig?: Partial<FaissIndexConfig>): Promise<FaissIndex>;
  static gpuSupport(): GpuSupportReport;
}

export declare class FaissBinaryIndex {
  constructor(config: FaissBinaryIndexConfig);

  add(vectors: Uint8Array, ids?: Int32Array): Promise<void>;
  addWithProgress(vectors: Uint8Array, options?: {
    batchSize?: number;
    onProgress?: (update: ProgressUpdate) => void;
  }): Promise<void>;

  train(vectors: Uint8Array): Promise<void>;
  trainWithProgress(vectors: Uint8Array, options?: {
    onProgress?: (update: ProgressUpdate) => void;
  }): Promise<void>;

  search(query: Uint8Array, k: number): Promise<BinarySearchResults>;
  searchBatch(queries: Uint8Array, k: number): Promise<BinaryBatchSearchResults>;

  reconstruct(id: number): Promise<Uint8Array>;
  reconstructBatch(ids: number[] | Int32Array | Uint32Array): Promise<Uint8Array>;
  removeIds(ids: number[] | Int32Array | Uint32Array): Promise<number>;
  getVectorById(id: number): Promise<Uint8Array>;
  getVectorCount(): number;

  setNprobe(nprobe: number): void;
  getStats(): BinaryIndexStats;
  getConfig(): Record<string, unknown>;
  getMetrics(): IndexMetrics;
  resetMetrics(): void;
  inspect(options?: { format?: 'object' | 'text' }): BinaryInspectReport | string;
  validate(options?: { sampleSize?: number }): Promise<BinaryIndexValidationReport>;
  setDebug(enabled: boolean): void;

  reset(): void;
  save(filename: string): Promise<void>;
  saveMetadata(filename: string, extra?: Record<string, unknown>): Promise<string>;
  saveWithMetadata(filename: string, extra?: Record<string, unknown>): Promise<string>;
  toBuffer(): Promise<Buffer>;
  mergeFrom(otherIndex: FaissBinaryIndex): Promise<void>;
  toGpu(device?: number): Promise<FaissBinaryIndex>;
  toCpu(): Promise<FaissBinaryIndex>;
  dispose(): void;

  static load(filename: string, runtimeConfig?: Partial<FaissBinaryIndexConfig>): Promise<FaissBinaryIndex>;
  static loadWithMetadata(filename: string, runtimeConfig?: Partial<FaissBinaryIndexConfig>): Promise<FaissBinaryIndex>;
  static fromBuffer(buffer: Buffer, runtimeConfig?: Partial<FaissBinaryIndexConfig>): Promise<FaissBinaryIndex>;
  static gpuSupport(): GpuSupportReport;
}

export declare function normalizeVectors(vectors: Float32Array, dims: number): Float32Array;
export declare function validateVectors(vectors: Float32Array, dims: number, options?: {
  throwOnError?: boolean;
}): {
  valid: boolean;
  vectorCount: number;
  dims: number;
  hasNaNOrInfinity: boolean;
  nonFinite: Array<{ vectorIndex: number; componentIndex: number; value: number }>;
  zeroNormIndices: number[];
  invalidDimensions: number[];
};

export declare function splitVectors(vectors: Float32Array, dims: number, chunkSize: number): Float32Array[];
export declare function computeDistances(
  left: Float32Array,
  right: Float32Array,
  options: { dims: number; metric?: 'l2' | 'ip' | 'cosine' }
): Float32Array;
export declare function validateBinaryVectors(vectors: Uint8Array, dims: number): {
  valid: boolean;
  dims: number;
  vectorCount: number;
  bytesPerVector: number;
};
