/**
 * TypeScript definitions for faiss-node
 */

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
  threads?: number;
}

export interface SearchResults {
  distances: Float32Array;
  labels: Int32Array;
}

export interface BatchSearchResults extends SearchResults {
  nq: number;
  k: number;
}

export interface RangeSearchResults {
  distances: Float32Array;
  labels: Int32Array;
  nq: number;  // Number of queries
  lims: Uint32Array;  // Limits array: [0, n0, n0+n1, ..., total] where ni is number of results for query i
}

export interface IndexStats {
  ntotal: number;
  dims: number;
  isTrained: boolean;
  type: string;
  factory: string;
  metric: 'l2' | 'ip';
}

export declare class FaissIndex {
  constructor(config: FaissIndexConfig);
  
  add(vectors: Float32Array, ids?: Int32Array): Promise<void>;
  train(vectors: Float32Array): Promise<void>;
  search(query: Float32Array, k: number): Promise<SearchResults>;
  searchBatch(queries: Float32Array, k: number): Promise<BatchSearchResults>;
  rangeSearch(query: Float32Array, radius: number): Promise<RangeSearchResults>;
  setNprobe(nprobe: number): void;
  getStats(): IndexStats;
  reset(): void;
  save(filename: string): Promise<void>;
  toBuffer(): Promise<Buffer>;
  mergeFrom(otherIndex: FaissIndex): Promise<void>;
  dispose(): void;

  static load(filename: string): Promise<FaissIndex>;
  static fromBuffer(buffer: Buffer): Promise<FaissIndex>;
}
