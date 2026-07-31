// Embeddings adapter · lukker EPIC 4 pgvector-loopet.
// Kontrakt: migration 0001 (learning_content.embedding + journal_entries.embedding)
//           + migration 0006 (learning_content vector(1536)) + EPIC 4 §RAG
// Sprint 6 Batch 2: audit-wiring · emit embedding.generate ved corpus-transformation (R§).
//
// STRATEGI (baseret på diskussion med Michael om ClinicalBERT-alternativer):
//   PRIMARY:   voyage-ai/voyage-medical-2 · $0.05/1M tokens · dedikeret medical
//              domain-tuning · multilingual (understøtter DA)
//   FALLBACK:  KennethEnevoldsen/dfm-encoder-large-v1 (Danish Foundation Model)
//              via HuggingFace Inference API · open-source · dansk-native
//   STUB:      deterministisk mock til tests + dev uden API-keys
//
// Alle adaptere producerer 1536-dim vektorer der matcher vores pgvector-
// kolonne-schema. DFM output paddet/truncerede til 1536 hvis nødvendigt.

import { z } from "zod";
import { auditLog } from "../audit";

export const EMBEDDING_DIM = 1536;

export const embeddingResultSchema = z.object({
  vector: z.array(z.number()).length(EMBEDDING_DIM),
  model: z.string(),
  input_tokens: z.number().int().nonnegative(),
});
export type EmbeddingResult = z.infer<typeof embeddingResultSchema>;

/**
 * Sprint 6 B2: audit-metadata for corpus-embeddings.
 * corpus='learning_content' | 'journal_entries' | 'ad_hoc' | fri-tekst-ref til target.
 * target_id: fx læringsressource-id eller journal_entry-id (aldrig raw tekst).
 */
export type EmbeddingAuditContext = {
  tenantId: string;
  actorUserId?: string;
  corpus: string;
  targetId?: string;
};

export type EmbeddingInput = {
  text: string;
  /** Optional hint for input-type (query vs document). Some models use it. */
  input_type?: "query" | "document";
  /** Optional audit-context. Når sat emitteres embedding.generate per input. */
  audit?: EmbeddingAuditContext;
};

export interface EmbeddingsAdapter {
  provider: string;
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
  embedBatch(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]>;
}

// ---------------------------------------------------------------------------
// Sprint 6 B2 · audit helper · emit én record per input med audit-context
// ---------------------------------------------------------------------------

function emitEmbeddingAudit(
  provider: string,
  inputs: EmbeddingInput[],
  results: EmbeddingResult[],
): void {
  for (let i = 0; i < inputs.length; i++) {
    const ctx = inputs[i]?.audit;
    if (!ctx) continue;
    const res = results[i];
    auditLog("embedding.generate", {
      tenant_id: ctx.tenantId,
      actor_user_id: ctx.actorUserId,
      target_ref: ctx.targetId ? `${ctx.corpus}/${ctx.targetId}` : ctx.corpus,
      provider,
      model: res?.model ?? provider,
      input_tokens: res?.input_tokens ?? 0,
      dim: res?.vector.length ?? 0,
      input_type: inputs[i]?.input_type ?? "document",
      corpus: ctx.corpus,
    });
  }
}

// ---------------------------------------------------------------------------
// Stub adapter · deterministic hash-based vector for tests + dev
// ---------------------------------------------------------------------------

/**
 * Deterministic pseudo-embedding via djb2-hash → 1536-dim seeded vector.
 * Same text → same vector (så tests er reproducible).
 * NOT semantically meaningful — use only for pipeline testing.
 */
export function createStubEmbeddingsAdapter(): EmbeddingsAdapter {
  return {
    provider: "stub",
    async embed(input) {
      const vec = seededVector(input.text);
      const res: EmbeddingResult = {
        vector: vec,
        model: "stub-djb2-v1",
        input_tokens: Math.ceil(input.text.length / 4),
      };
      emitEmbeddingAudit("stub", [input], [res]);
      return res;
    },
    async embedBatch(inputs) {
      const results = await Promise.all(
        inputs.map(async (i) => ({
          vector: seededVector(i.text),
          model: "stub-djb2-v1",
          input_tokens: Math.ceil(i.text.length / 4),
        })),
      );
      emitEmbeddingAudit("stub", inputs, results);
      return results;
    },
  };
}

function seededVector(seed: string): number[] {
  // djb2 seed
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  const out = new Array<number>(EMBEDDING_DIM);
  // Mulberry32 PRNG seeded on djb2
  let state = h >>> 0 || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out[i] = r * 2 - 1;  // range -1..1
  }
  // L2-normalize
  return l2Normalize(out);
}

function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

// ---------------------------------------------------------------------------
// Prod-fallback guard · B5
//
// Silent fallback til stub-embeddings i prod = falsk positiv semantik i
// pgvector-lookups (hash-djb2 er ikke meningsfuld). Vi kaster som default
// og krver eksplicit opt-in via PRAXIS_EMBEDDINGS_ALLOW_STUB=1.
// ---------------------------------------------------------------------------

function assertStubFallbackAllowed(providerName: string, reason: string): void {
  const isProd = process.env.NODE_ENV === "production";
  const allowStub = process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB === "1";
  if (isProd && !allowStub) {
    throw new Error(
      `[embeddings/${providerName}] Refuser stub-fallback i produktion (${reason}). ` +
      "St PRAXIS_EMBEDDINGS_ALLOW_STUB=1 hvis du bevidst accepterer meningsloese vektorer, " +
      "eller wire en rigtig provider op.",
    );
  }
}

// ---------------------------------------------------------------------------
// Voyage Medical adapter · primary
// ---------------------------------------------------------------------------

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-medical-2";

export function createVoyageMedicalAdapter(): EmbeddingsAdapter {
  return {
    provider: "voyage-medical-2",
    async embed(input) {
      const results = await this.embedBatch([input]);
      return results[0]!;
    },
    async embedBatch(inputs) {
      const apiKey = process.env.VOYAGE_API_KEY;
      if (!apiKey) {
        console.log("API Key Missing (VOYAGE_API_KEY) — falling back to stub embeddings");
        assertStubFallbackAllowed("voyage-medical-2", "VOYAGE_API_KEY missing");
        return createStubEmbeddingsAdapter().embedBatch(inputs);
      }
      try {
        const res = await fetch(VOYAGE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: VOYAGE_MODEL,
            input: inputs.map((i) => i.text),
            input_type: inputs[0]?.input_type ?? "document",
            output_dimension: EMBEDDING_DIM,
          }),
        });
        if (!res.ok) {
          throw new Error(`Voyage ${res.status}`);
        }
        const data = await res.json();
        const items = data?.data as Array<{ embedding: number[]; index: number }>;
        const totalTokens = (data?.usage?.total_tokens as number) ?? 0;
        const perItemTokens = Math.floor(totalTokens / Math.max(1, items.length));
        const results = items
          .sort((a, b) => a.index - b.index)
          .map((it) => ({
            vector: ensureDim(it.embedding, EMBEDDING_DIM),
            model: VOYAGE_MODEL,
            input_tokens: perItemTokens,
          }));
        emitEmbeddingAudit("voyage-medical-2", inputs, results);
        return results;
      } catch (err) {
        console.log("Voyage embed error, falling back to stub:", (err as Error).message);
        assertStubFallbackAllowed("voyage-medical-2", (err as Error).message);
        return createStubEmbeddingsAdapter().embedBatch(inputs);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// DFM Danish adapter · Danish Foundation Model via HuggingFace Inference API
// ---------------------------------------------------------------------------

const DFM_MODEL = "KennethEnevoldsen/dfm-encoder-large-v1";
const HF_INFERENCE_BASE = "https://api-inference.huggingface.co/pipeline/feature-extraction";

export function createDfmDanishAdapter(): EmbeddingsAdapter {
  return {
    provider: "dfm-danish",
    async embed(input) {
      const results = await this.embedBatch([input]);
      return results[0]!;
    },
    async embedBatch(inputs) {
      const apiKey = process.env.HF_INFERENCE_API_KEY;
      if (!apiKey) {
        console.log("API Key Missing (HF_INFERENCE_API_KEY) — falling back to stub embeddings");
        assertStubFallbackAllowed("dfm-danish", "HF_INFERENCE_API_KEY missing");
        return createStubEmbeddingsAdapter().embedBatch(inputs);
      }
      try {
        const url = `${HF_INFERENCE_BASE}/${DFM_MODEL}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            inputs: inputs.map((i) => i.text),
            options: { wait_for_model: true },
          }),
        });
        if (!res.ok) {
          throw new Error(`HF DFM ${res.status}`);
        }
        const data = (await res.json()) as number[][];
        const results = data.map((raw, i) => ({
          vector: ensureDim(raw, EMBEDDING_DIM),
          model: DFM_MODEL,
          input_tokens: Math.ceil(inputs[i]!.text.length / 4),
        }));
        emitEmbeddingAudit("dfm-danish", inputs, results);
        return results;
      } catch (err) {
        console.log("DFM embed error, falling back to stub:", (err as Error).message);
        assertStubFallbackAllowed("dfm-danish", (err as Error).message);
        return createStubEmbeddingsAdapter().embedBatch(inputs);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Auto-selection
// ---------------------------------------------------------------------------

/**
 * Selection-order per env:
 *  1. PRAXIS_EMBEDDINGS_MODE='stub' → stub (regardless of keys)
 *  2. VOYAGE_API_KEY set → Voyage Medical (best-in-class · commercial)
 *  3. HF_INFERENCE_API_KEY set → DFM Danish (open-source · dansk-native)
 *  4. else → stub
 */
export function createDefaultEmbeddingsAdapter(): EmbeddingsAdapter {
  if (process.env.PRAXIS_EMBEDDINGS_MODE === "stub") {
    return createStubEmbeddingsAdapter();
  }
  if (process.env.VOYAGE_API_KEY) {
    return createVoyageMedicalAdapter();
  }
  if (process.env.HF_INFERENCE_API_KEY) {
    return createDfmDanishAdapter();
  }
  return createStubEmbeddingsAdapter();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure vector matches target dimension. Truncate if longer, right-pad
 * with zeros if shorter. L2-normalizes after.
 */
export function ensureDim(v: number[], targetDim: number): number[] {
  if (v.length === targetDim) return l2Normalize(v);
  const out = new Array<number>(targetDim).fill(0);
  const copyLen = Math.min(v.length, targetDim);
  for (let i = 0; i < copyLen; i++) out[i] = v[i]!;
  return l2Normalize(out);
}
