/**
 * TypeScript definitions for faiss-node
 */

export interface FaissIndexConfig {
  type: 'FLAT_L2' | 'FLAT_IP' | 'IVF_FLAT' | 'HNSW';
  dims: number;
  nlist?: number;
  nprobe?: number;
  M?: number;
  efConstruction?: number;
  efSearch?: number;
  metric?: 'l2' | 'ip';
  threads?: number;
}

export interface SearchResults {
  distances: Float32Array;
  labels: Int32Array;
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
}

export declare class FaissIndex {
  constructor(config: FaissIndexConfig);
  
  add(vectors: Float32Array, ids?: Int32Array): Promise<void>;
  search(query: Float32Array, k: number): Promise<SearchResults>;
  rangeSearch(query: Float32Array, radius: number): Promise<RangeSearchResults>;
  getStats(): IndexStats;
  reset(): void;
  dispose(): void;
}
