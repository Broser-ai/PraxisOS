// Similarity + retrieval utilities for embeddings.
// Kontrakt: EPIC 4 §RAG · nearest-neighbor lookup for learning-content matching.

/**
 * Cosine similarity between two L2-normalized vectors (dot-product).
 * Assumes both inputs are already unit-length (adapter guarantees this).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: dim mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

export type CorpusItem<T> = {
  item: T;
  vector: number[];
};

export type NeighborResult<T> = {
  item: T;
  similarity: number;
};

/**
 * Top-K nearest neighbors from a corpus of pre-embedded items.
 * Complexity O(N · dim) — fine for N <= 10k. For larger corpora,
 * use pgvector's HNSW/IVFFlat index directly via SQL.
 */
export function topKNearest<T>(
  query: number[],
  corpus: Array<CorpusItem<T>>,
  k: number,
): Array<NeighborResult<T>> {
  const scored: Array<NeighborResult<T>> = corpus.map((c) => ({
    item: c.item,
    similarity: cosineSimilarity(query, c.vector),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

/**
 * Filter neighbors to those above a similarity threshold.
 * Useful for RAG: don't inject weakly-related content into LLM context.
 */
export function filterByThreshold<T>(
  neighbors: Array<NeighborResult<T>>,
  minSimilarity: number,
): Array<NeighborResult<T>> {
  return neighbors.filter((n) => n.similarity >= minSimilarity);
}
