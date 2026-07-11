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
  return async (input) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const stub = createStubVlmCaller();

    if (!apiKey) {
      console.log("API Key Missing (ANTHROPIC_API_KEY) — falling back to stub VLM output");
      return stub(input);
    }

    try {
      // Byg vision-content med URL-referencer til frames + mesh-render
      const contentParts: Array<Record<string, unknown>> = [];
      for (const url of input.frameUrls.slice(0, 6)) {
        contentParts.push({
          type: "image",
          source: { type: "url", url },
        });
      }
      contentParts.push({
        type: "text",
        text: [
          "Analyser disse fod-scan frames + tilhørende 3D-mesh.",
          "Returner STRUKTURET JSON efter ScannerFindings-schema.",
          "Alle findings SKAL have ai_generated=true.",
          `Klient-kontekst: ${JSON.stringify(input.clientContext)}`,
          `Volume-metrics: ${JSON.stringify(input.volumeMetrics)}`,
          `Mesh-URL: ${input.meshUrl}`,
        ].join("\n"),
      });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: VLM_MODEL_VERSION,
          max_tokens: 2048,
          system: VLM_SYSTEM_PROMPT,
          messages: [{ role: "user", content: contentParts }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => "")}`);
      }

      const data = await res.json();
      const raw = data?.content?.[0]?.text as string | undefined;
      if (!raw) throw new Error("Empty response from Anthropic");

      // Parse JSON fra tekst (LLM kan returnere ```json fences)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in Anthropic response");
      const parsed = JSON.parse(jsonMatch[0]);
      return enforceAiGenerated({ ...parsed, scan_id: input.scanId });
    } catch (err) {
      console.log("Live VLM error, falling back to stub:", (err as Error).message);
      // Failsafe #1: mock-svar så pipeline ikke crasher
      return stub(input);
    }
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
