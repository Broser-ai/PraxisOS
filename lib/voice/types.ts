// Voice-plane types · shared between server-side adapters + client components.
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §2.2 · STATE-OF-THE-ART §6
//
// Two-plane architecture:
//   REALTIME PLANE (this module) — WebRTC + streaming ASR + streaming LLM
//   ASYNC PLANE (existing lib/orchestrator.ts) — LangGraph supervisor + workers

import { z } from "zod";

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export type VoiceSessionStatus =
  | "idle"
  | "consent_requested"
  | "consent_recorded"
  | "listening"
  | "thinking"
  | "paused"
  | "ended"
  | "error";

export const voiceSessionSchema = z.object({
  session_id: z.string(),
  tenant_id: z.string(),
  practitioner_user_id: z.string(),
  client_id: z.string().optional(),
  origin: z.enum(["chat", "scribe", "booking", "felt", "cron", "api", "portal"]),
  status: z.enum([
    "idle",
    "consent_requested",
    "consent_recorded",
    "listening",
    "thinking",
    "paused",
    "ended",
    "error",
  ]),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
  consent_event_id: z.string().optional(), // link til consent_events row
});

export type VoiceSession = z.infer<typeof voiceSessionSchema>;

// ---------------------------------------------------------------------------
// Streaming transcript · one chunk per partial or final
// ---------------------------------------------------------------------------

export const transcriptChunkSchema = z.object({
  session_id: z.string(),
  sequence: z.number().int().nonnegative(),
  is_final: z.boolean(),
  speaker: z.enum(["practitioner", "client", "unknown"]).default("unknown"),
  text: z.string(),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
});

export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;

// ---------------------------------------------------------------------------
// SOAP draft with provenance-spans (Abridge Linked Evidence pattern)
// ---------------------------------------------------------------------------

export const provenanceSpanSchema = z.object({
  transcript_start_ms: z.number().int().nonnegative(),
  transcript_end_ms: z.number().int().nonnegative(),
  source_speaker: z.enum(["practitioner", "client", "unknown"]),
  confidence: z.number().min(0).max(1),
  provenance: z.enum(["verbatim", "paraphrased", "inferred", "template"]),
});

export const soapSectionSchema = z.object({
  section: z.enum(["S", "O", "A", "P"]),
  sentences: z.array(
    z.object({
      text: z.string(),
      spans: z.array(provenanceSpanSchema),
    })
  ),
});

export const soapDraftSchema = z.object({
  session_id: z.string(),
  language: z.enum(["da", "en"]).default("da"),
  sections: z.array(soapSectionSchema),
  ai_generated: z.literal(true).default(true),
  vlm_model_version: z.string(),
  drafted_at: z.string().datetime(),
});

export type SoapDraft = z.infer<typeof soapDraftSchema>;
export type SoapSection = z.infer<typeof soapSectionSchema>;
export type ProvenanceSpan = z.infer<typeof provenanceSpanSchema>;

// ---------------------------------------------------------------------------
// 4-lags samtykke (Corti DK pattern)
// ---------------------------------------------------------------------------

export const consentEventTypeSchema = z.enum([
  "clinic_dpa_signed",
  "physical_signage_confirmed",
  "verbal_ack_recorded",
  "wake_word_activated",
  "consent_withdrawn",
]);

export const consentEventSchema = z.object({
  event_id: z.string(),
  tenant_id: z.string(),
  client_id: z.string().optional(),
  practitioner_user_id: z.string().optional(),
  event_type: consentEventTypeSchema,
  captured_at: z.string().datetime(),
  audio_snippet_url: z.string().url().optional(),
  session_ref: z.string().optional(),
});

export type ConsentEvent = z.infer<typeof consentEventSchema>;
export type ConsentEventType = z.infer<typeof consentEventTypeSchema>;

// ---------------------------------------------------------------------------
// Wake-word matching (local VAD only · audio never leaves device)
// ---------------------------------------------------------------------------

export const WAKE_WORDS_DA = [
  "stop optagelse",
  "pause niels",
  "stop niels",
  "pause aria",
  "stop aria",
] as const;

export type WakeWord = (typeof WAKE_WORDS_DA)[number];

/**
 * Simpel substring-match til wake-words. Bruges CLIENT-SIDE på local VAD-
 * output — matched audio slettes fra streamen før den forlader device.
 */
export function detectWakeWord(text: string): WakeWord | null {
  const lower = text.toLowerCase();
  for (const w of WAKE_WORDS_DA) {
    if (lower.includes(w)) return w;
  }
  return null;
}
