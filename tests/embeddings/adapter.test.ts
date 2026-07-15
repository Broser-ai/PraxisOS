// Embeddings adapter tests
// Kontrakt: EPIC 4 pgvector integration · Sprint 5 addendum

import { describe, it, expect } from "vitest";
import {
  createStubEmbeddingsAdapter,
  createDefaultEmbeddingsAdapter,
  ensureDim,
  EMBEDDING_DIM,
} from "@/lib/embeddings/adapter";
import {
  cosineSimilarity,
  topKNearest,
  filterByThreshold,
} from "@/lib/embeddings/similarity";

describe("embeddings · stub adapter deterministism", () => {
  it("same input → same vector", async () => {
    const a1 = await createStubEmbeddingsAdapter().embed({ text: "hallux valgus" });
    const a2 = await createStubEmbeddingsAdapter().embed({ text: "hallux valgus" });
    expect(a1.vector).toEqual(a2.vector);
  });

  it("different input → different vector", async () => {
    const a = await createStubEmbeddingsAdapter().embed({ text: "hallux valgus" });
    const b = await createStubEmbeddingsAdapter().embed({ text: "diabetisk sår" });
    expect(a.vector).not.toEqual(b.vector);
  });

  it("output is L2-normalized (unit length)", async () => {
    const r = await createStubEmbeddingsAdapter().embed({ text: "pes planus" });
    const norm = Math.sqrt(r.vector.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 3);
  });

  it("output dimension matches EMBEDDING_DIM (1536)", async () => {
    const r = await createStubEmbeddingsAdapter().embed({ text: "callus" });
    expect(r.vector.length).toBe(EMBEDDING_DIM);
    expect(EMBEDDING_DIM).toBe(1536);
  });

  it("batch returns same count as input", async () => {
    const results = await createStubEmbeddingsAdapter().embedBatch([
      { text: "a" }, { text: "b" }, { text: "c" }, { text: "d" },
    ]);
    expect(results.length).toBe(4);
    for (const r of results) expect(r.vector.length).toBe(EMBEDDING_DIM);
  });
});

describe("embeddings · ensureDim", () => {
  it("pads shorter vector with zeros then normalizes", () => {
    const out = ensureDim([1, 0, 0], 5);
    expect(out.length).toBe(5);
    const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 4);
  });

  it("truncates longer vector then normalizes", () => {
    const out = ensureDim([1, 1, 1, 1, 1], 3);
    expect(out.length).toBe(3);
    const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 4);
  });
});

describe("embeddings · similarity", () => {
  it("cosine of identical vectors = 1", () => {
    const v = [0.6, 0.8, 0]; // already normalized (0.6²+0.8²=1)
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 6);
  });

  it("cosine of orthogonal vectors = 0", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
  });

  it("cosine dim-mismatch throws", () => {
    expect(() => cosineSimilarity([1, 0], [0, 1, 0])).toThrow();
  });

  it("topKNearest returns highest-similarity items in order", async () => {
    const stub = createStubEmbeddingsAdapter();
    const corpus = await Promise.all(
      ["hallux valgus", "diabetisk sår", "pes planus", "callus", "achilles tendinopati"].map(
        async (text) => ({
          item: { id: text, label: text },
          vector: (await stub.embed({ text })).vector,
        }),
      ),
    );
    const queryVec = (await stub.embed({ text: "hallux valgus" })).vector;
    const results = topKNearest(queryVec, corpus, 3);
    expect(results.length).toBe(3);
    // Query matches exact-input best (similarity ~1)
    expect(results[0]!.item.id).toBe("hallux valgus");
    expect(results[0]!.similarity).toBeCloseTo(1, 3);
    // Neighbors sorted descending
    expect(results[0]!.similarity).toBeGreaterThanOrEqual(results[1]!.similarity);
    expect(results[1]!.similarity).toBeGreaterThanOrEqual(results[2]!.similarity);
  });

  it("filterByThreshold drops below-threshold neighbors", async () => {
    const neighbors = [
      { item: "a", similarity: 0.9 },
      { item: "b", similarity: 0.5 },
      { item: "c", similarity: 0.1 },
    ];
    const filtered = filterByThreshold(neighbors, 0.4);
    expect(filtered.length).toBe(2);
    expect(filtered.map((n) => n.item)).toEqual(["a", "b"]);
  });
});

describe("embeddings · default adapter selection", () => {
  it("PRAXIS_EMBEDDINGS_MODE=stub always returns stub", async () => {
    const prev = process.env.PRAXIS_EMBEDDINGS_MODE;
    process.env.PRAXIS_EMBEDDINGS_MODE = "stub";
    const adapter = createDefaultEmbeddingsAdapter();
    expect(adapter.provider).toBe("stub");
    if (prev === undefined) delete process.env.PRAXIS_EMBEDDINGS_MODE;
    else process.env.PRAXIS_EMBEDDINGS_MODE = prev;
  });

  it("no keys set → stub", async () => {
    const prevVoyage = process.env.VOYAGE_API_KEY;
    const prevHf = process.env.HF_INFERENCE_API_KEY;
    const prevMode = process.env.PRAXIS_EMBEDDINGS_MODE;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.HF_INFERENCE_API_KEY;
    delete process.env.PRAXIS_EMBEDDINGS_MODE;
    const adapter = createDefaultEmbeddingsAdapter();
    expect(adapter.provider).toBe("stub");
    if (prevVoyage !== undefined) process.env.VOYAGE_API_KEY = prevVoyage;
    if (prevHf !== undefined) process.env.HF_INFERENCE_API_KEY = prevHf;
    if (prevMode !== undefined) process.env.PRAXIS_EMBEDDINGS_MODE = prevMode;
  });
});
