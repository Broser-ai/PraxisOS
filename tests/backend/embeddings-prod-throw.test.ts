// Sprint 6 · B5 — embeddings prod-throw pa stub-fallback
import { describe, it, expect, afterEach } from "vitest";
import {
  createVoyageMedicalAdapter,
  createDfmDanishAdapter,
} from "@/lib/embeddings/adapter";

describe("embeddings · prod-throw on stub-fallback", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVoyage = process.env.VOYAGE_API_KEY;
  const originalHf = process.env.HF_INFERENCE_API_KEY;
  const originalAllowStub = process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB;

  afterEach(() => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVoyage !== undefined) process.env.VOYAGE_API_KEY = originalVoyage;
    else delete process.env.VOYAGE_API_KEY;
    if (originalHf !== undefined) process.env.HF_INFERENCE_API_KEY = originalHf;
    else delete process.env.HF_INFERENCE_API_KEY;
    if (originalAllowStub !== undefined) process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB = originalAllowStub;
    else delete process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB;
  });

  it("Voyage: prod uden API-key uden opt-in → throws", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "production";
    delete process.env.VOYAGE_API_KEY;
    delete process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB;
    const adapter = createVoyageMedicalAdapter();
    await expect(adapter.embed({ text: "test" })).rejects.toThrow(/Refuser stub-fallback i produktion/);
  });

  it("Voyage: prod med PRAXIS_EMBEDDINGS_ALLOW_STUB=1 → falls back til stub", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "production";
    delete process.env.VOYAGE_API_KEY;
    process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB = "1";
    const adapter = createVoyageMedicalAdapter();
    const res = await adapter.embed({ text: "test" });
    expect(res.vector.length).toBe(1536);
    expect(res.model).toBe("stub-djb2-v1");
  });

  it("DFM: prod uden API-key uden opt-in → throws", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "production";
    delete process.env.HF_INFERENCE_API_KEY;
    delete process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB;
    const adapter = createDfmDanishAdapter();
    await expect(adapter.embed({ text: "test" })).rejects.toThrow(/Refuser stub-fallback i produktion/);
  });

  it("dev-mode: uden API-key stub-fallback tilladt", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "development";
    delete process.env.VOYAGE_API_KEY;
    delete process.env.PRAXIS_EMBEDDINGS_ALLOW_STUB;
    const adapter = createVoyageMedicalAdapter();
    const res = await adapter.embed({ text: "test" });
    expect(res.vector.length).toBe(1536);
  });

  it("provider-tag er sat pa alle adapters", async () => {
    expect(createVoyageMedicalAdapter().provider).toBe("voyage-medical-2");
    expect(createDfmDanishAdapter().provider).toBe("dfm-danish");
  });
});
