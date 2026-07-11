// Medical VLM caller (Claude Sonnet 5 vision) med INV-CS-6-håndhævelse.
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §3, §11 beslutning 3

import { enforceAiGenerated, type ScannerFindings } from "./findings-schema";
import { redactPII } from "../redact";

export type VlmInput = {
  scanId: string;
  frameUrls: string[];
  meshUrl: string;
  volumeMetrics: Record<string, number>;
  clientContext: {
    ageBand?: string;      // "40-49" — aldrig præcis alder
    sex?: "M" | "F" | "other";
    knownDiagnoses?: string[];
  };
};

export type VlmCaller = (input: VlmInput) => Promise<ScannerFindings>;

// ---------------------------------------------------------------------------
// Prompt-katalog · versioneret (§3, INV-CS-6)
// ---------------------------------------------------------------------------

export const VLM_MODEL_VERSION = "claude-sonnet-5-2026-01";

export const VLM_SYSTEM_PROMPT = `Du er en medicinsk vision-model der analyserer 3D fod-scans og
tilhørende 2D frames for PraxisOS. Du returnerer STRUKTURET JSON efter
schemaet ScannerFindings. Alle findings SKAL have "ai_generated": true.

Regler:
1. Aldrig diagnosér uden confidence-score. Skala 0.0-1.0.
2. Marker altid escalation_needed=true ved: melanom-mistanke, dyb sår,
   iskæmi-tegn, akut infektion.
3. Foretræk differential-diagnoser når confidence < 0.75.
4. Skriv overall_summary_da på dansk klinisk sprog, uden CPR/navn.
5. ICD-10-koder skal være reelle, ikke placeholders.

Few-shot eksempler (uddrag):
- Diabetisk fodsår: L97.4 · confidence 0.88 · escalation_needed=true
- Callus (hyperkeratose): L84 · confidence 0.92 · escalation_needed=false
- Hallux valgus: M20.1 · confidence 0.85 · severity efter angle
- Arch drop (pes planus): M21.4 · confidence 0.78`;

// ---------------------------------------------------------------------------
// Stub caller — deterministisk output til tests
// ---------------------------------------------------------------------------

export function createStubVlmCaller(): VlmCaller {
  return async (input) => {
    const output: ScannerFindings = enforceAiGenerated({
      scan_id: input.scanId,
      vlm_model_version: VLM_MODEL_VERSION,
      ai_generated: true,
      confidence_overall: 0.82,
      findings: [
        {
          id: "f_stub_1",
          category: "biomechanical",
          label: "Mild hallux valgus",
          icd10_candidates: ["M20.1"],
          confidence: 0.85,
          bbox_2d: { frame_index: 0, x: 120, y: 340, w: 80, h: 60 },
          severity: "low",
          ai_reasoning: "Angle estimeret til ~13°, under klinisk threshold for indgreb",
          escalation_needed: false,
          ai_generated: true,
        },
      ],
      overall_summary_da: "Mild valgus-stilling af storetå, ingen akut behandling nødvendig.",
    });
    return output;
  };
}

// ---------------------------------------------------------------------------
// Live caller (Claude Sonnet 5 vision) — kaldes kun hvis nøgle er sat
// ---------------------------------------------------------------------------

export function createLiveVlmCaller(): VlmCaller {
  return async (_input) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }
    // Placeholder — real impl ville bruge @anthropic-ai/sdk vision API
    throw new Error("Live VLM caller not implemented in this scaffold");
  };
}

export function createDefaultVlmCaller(): VlmCaller {
  if (process.env.PRAXIS_LLM_MODE === "stub" || !process.env.ANTHROPIC_API_KEY) {
    return createStubVlmCaller();
  }
  return createLiveVlmCaller();
}

/**
 * Wrap the raw caller in redaction (INV-CS-11) + INV-CS-6 double-check.
 */
export function wrapWithGuards(caller: VlmCaller): VlmCaller {
  return async (input) => {
    // INV-CS-11: redakter klient-kontekst før VLM-kald
    const cleanInput = {
      ...input,
      clientContext: redactPII(input.clientContext),
    };
    const raw = await caller(cleanInput);
    // INV-CS-6: dobbelttjek at ai_generated er sat på alle findings
    return enforceAiGenerated(raw);
  };
}
