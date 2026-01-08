/**
 * TypeScript definitions for faiss-node
 */

export interface FaissIndexConfig {
  type: 'FLAT_L2' | 'IVF_FLAT' | 'HNSW';
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
  getStats(): IndexStats;
  dispose(): void;
}
