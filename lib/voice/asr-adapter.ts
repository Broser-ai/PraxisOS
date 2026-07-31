// ASR adapter · streaming transcription (Deepgram Nova-3 Medical primary)
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §2.5 · Danish voice stack
//
// Provider-strategi:
//   DEFAULT: Deepgram Nova-3 Medical (da-DK streaming, p95 240ms partials)
//   FALLBACK: stub-adapter der returnerer scriptet transcript (til tests + dev)
//
// PRINCIP: Adapter-interfacet er stabilt — orchestrator + UI kan bygges
// mod stub'en indtil Deepgram API-key er sat.

import type { TranscriptChunk } from "./types";

export type AsrConfig = {
  language: "da-DK" | "en-US";
  model?: string;               // default: "nova-3-medical"
  interimResults?: boolean;     // default: true
  diarization?: boolean;        // default: true
  endpointing?: number;         // default: 300ms silence
};

export type AsrEvents = {
  onChunk: (chunk: TranscriptChunk) => void | Promise<void>;
  onError: (err: Error) => void | Promise<void>;
  onClosed: () => void | Promise<void>;
};

export interface AsrSession {
  /** Feed audio bytes (16-bit PCM 16kHz mono). */
  ingest(pcm: Uint8Array): void;
  /** Signal end-of-stream. onClosed will fire when finalized. */
  close(): Promise<void>;
  readonly sessionId: string;
}

export interface AsrAdapter {
  startSession(
    sessionId: string,
    config: AsrConfig,
    events: AsrEvents,
  ): Promise<AsrSession>;
}

// ---------------------------------------------------------------------------
// Live Deepgram adapter — kaldes kun hvis DEEPGRAM_API_KEY er sat
// ---------------------------------------------------------------------------

// Sprint 6 blocker B7 · fail-closed guard for clinical-tier ASR.
// Silent stub-fallback i prod = patientstemmen kan blive erstattet med
// scripted-transcript uden at journal-læser opdager det. Vi kaster i stedet
// og tillader kun stub når PRAXIS_ASR_ALLOW_STUB=1 er sat bevidst.
function assertAsrStubAllowed(reason: string): void {
  const isProd = process.env.NODE_ENV === "production";
  const allow = process.env.PRAXIS_ASR_ALLOW_STUB === "1";
  if (isProd && !allow) {
    throw new Error(
      `[voice/asr] Refuser stub-fallback i produktion (${reason}). ` +
      "Sæt PRAXIS_ASR_ALLOW_STUB=1 hvis du bevidst accepterer scripted transcripts, " +
      "eller installer @deepgram/sdk + wire DEEPGRAM_API_KEY.",
    );
  }
}

export function createLiveDeepgramAdapter(): AsrAdapter {
  return {
    async startSession(sessionId, config, events) {
      if (!process.env.DEEPGRAM_API_KEY) {
        console.log("API Key Missing (DEEPGRAM_API_KEY) — falling back to stub ASR");
        assertAsrStubAllowed("DEEPGRAM_API_KEY missing");
        return createStubAsrAdapter().startSession(sessionId, config, events);
      }
      // Real implementation lever bag @deepgram/sdk. Uden dependency
      // installeret returnerer vi stub — dependency tilføjes i sprint 3.
      // Interface holder så orchestrator ikke skal ændres.
      console.log(
        `[voice] Deepgram live adapter not wired up in this scaffold — using stub for session ${sessionId}`,
      );
      assertAsrStubAllowed("@deepgram/sdk not installed");
      return createStubAsrAdapter().startSession(sessionId, config, events);
    },
  };
}

// ---------------------------------------------------------------------------
// Stub adapter · scripted transcript til tests + dev
// ---------------------------------------------------------------------------

const STUB_SCRIPTED_SESSION: Array<Omit<TranscriptChunk, "session_id" | "sequence">> = [
  {
    is_final: false,
    speaker: "practitioner",
    text: "Godmorgen, hvad kan jeg hjælpe med i dag?",
    start_ms: 0,
    end_ms: 2200,
    confidence: 0.92,
  },
  {
    is_final: true,
    speaker: "practitioner",
    text: "Godmorgen, hvad kan jeg hjælpe med i dag?",
    start_ms: 0,
    end_ms: 2200,
    confidence: 0.94,
  },
  {
    is_final: true,
    speaker: "client",
    text: "Jeg har haft ondt under min højre fod i tre uger.",
    start_ms: 2500,
    end_ms: 5800,
    confidence: 0.91,
  },
  {
    is_final: true,
    speaker: "practitioner",
    text: "Er smerten værst om morgenen når du står ud af sengen?",
    start_ms: 6200,
    end_ms: 9100,
    confidence: 0.93,
  },
  {
    is_final: true,
    speaker: "client",
    text: "Ja, de første ti skridt er værst.",
    start_ms: 9500,
    end_ms: 11800,
    confidence: 0.9,
  },
];

export function createStubAsrAdapter(): AsrAdapter {
  return {
    async startSession(sessionId, _config, events) {
      let sequence = 0;
      let closed = false;
      // Emit scripted chunks asynkront så event-loopet ikke blokerer
      void (async () => {
        for (const partial of STUB_SCRIPTED_SESSION) {
          if (closed) return;
          await new Promise((r) => setTimeout(r, 400));
          if (closed) return;
          try {
            await events.onChunk({
              ...partial,
              session_id: sessionId,
              sequence: sequence++,
            });
          } catch (err) {
            await events.onError(err as Error);
          }
        }
      })();

      return {
        sessionId,
        ingest(_pcm: Uint8Array) {
          // Stub ignorerer audio-bytes
        },
        async close() {
          closed = true;
          await events.onClosed();
        },
      };
    },
  };
}

export function createDefaultAsrAdapter(): AsrAdapter {
  if (process.env.PRAXIS_VOICE_MODE === "stub" || !process.env.DEEPGRAM_API_KEY) {
    return createStubAsrAdapter();
  }
  return createLiveDeepgramAdapter();
}
