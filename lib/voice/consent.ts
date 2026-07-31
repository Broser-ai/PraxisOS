// Voice-plane consent writer + guard · Sprint 6 blocker-fix B19
// Kontrakt: COMPLETE-AUDIT-REPORT.md §B19 · regulatory dimension
//           HUMANIZED-FRONTIER-BLUEPRINT §2.4 · Corti-DK 4-lags samtykke
//           Sundhedsloven §42a-d · Databeskyttelseslovens §7 stk. 3
//
// 4-lags flow som skal bevises FØR LiveKit-session må starte:
//   1. clinic_dpa_signed          — én-gang per klinik (Databehandleraftale)
//   2. physical_signage_confirmed — én-gang per rum (fysisk skiltning kontrolleret)
//   3. verbal_ack_recorded        — pr. session (patient siger "ja" — 2s snippet gemmes)
//   4. wake_word_activated        — pr. optagelse (aktiv fra dette punkt)
//
// PERSISTENS: Skriver via lib/audit (Sprint 6 restored) + ring-buffer.
// Når DB-laget swappes fra mock til supabase-eu, wire consent_events INSERT
// direkte i pushSink(). Tabellen findes allerede (migration 0007:215).

import { auditLog } from "../audit";

export type ConsentEventType =
  | "clinic_dpa_signed"
  | "physical_signage_confirmed"
  | "verbal_ack_recorded"
  | "wake_word_activated"
  | "consent_withdrawn";

export type ConsentEvent = {
  id: string;
  tenant_id: string;
  client_id?: string;
  practitioner_id?: string;
  event_type: ConsentEventType;
  captured_at: string; // ISO 8601 UTC
  audio_snippet_url?: string;
  session_ref?: string;
  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// In-memory sink (append-only, mirrors consent_events RLS "no UPDATE/DELETE")
// ---------------------------------------------------------------------------

const SINK_LIMIT = 5_000;
const sink: ConsentEvent[] = [];

function pushSink(rec: ConsentEvent): void {
  sink.push(rec);
  if (sink.length > SINK_LIMIT) sink.splice(0, sink.length - SINK_LIMIT);
  // TODO: when PRAXIS_DB === 'supabase-eu', also INSERT INTO consent_events
  // via service-role client. Tabellen findes fra migration 0007.
}

function newId(): string {
  return `cse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Writers — one per event_type. All go through recordConsent().
// ---------------------------------------------------------------------------

export type RecordConsentInput = {
  tenant_id: string;
  event_type: ConsentEventType;
  client_id?: string;
  practitioner_id?: string;
  audio_snippet_url?: string;
  session_ref?: string;
  metadata?: Record<string, unknown>;
};

export function recordConsent(input: RecordConsentInput): ConsentEvent {
  // Verbal ack MUST have audio proof (Sundhedsloven §42a — journalpligt bevis)
  if (input.event_type === "verbal_ack_recorded" && !input.audio_snippet_url) {
    throw new Error(
      "verbal_ack_recorded kræver audio_snippet_url (2s snippet). " +
        "Consent-event afvist for at bevare beviskæden.",
    );
  }

  const rec: ConsentEvent = {
    id: newId(),
    tenant_id: input.tenant_id,
    client_id: input.client_id,
    practitioner_id: input.practitioner_id,
    event_type: input.event_type,
    captured_at: new Date().toISOString(),
    audio_snippet_url: input.audio_snippet_url,
    session_ref: input.session_ref,
    metadata: input.metadata ?? {},
  };

  pushSink(rec);

  // Emit til audit-trail — Sundhedsloven §42a-d evidens
  auditLog({
    event: `consent.${input.event_type}`,
    level: "info",
    tenant_id: input.tenant_id,
    actor_user_id: input.practitioner_id,
    target_ref: input.session_ref,
    meta: {
      consent_event_id: rec.id,
      client_id: input.client_id,
      has_audio: !!input.audio_snippet_url,
    },
  });

  return rec;
}

// ---------------------------------------------------------------------------
// Guards — called before starting realtime plane session
// ---------------------------------------------------------------------------

const VERBAL_ACK_MAX_AGE_MS = 60_000; // 60s window per HUMANIZED-FRONTIER §2.4

export type ConsentGuardInput = {
  tenant_id: string;
  client_id?: string;
  session_ref?: string;
  now?: Date;
};

export type ConsentGuardResult =
  | { ok: true; verbal_ack_id: string }
  | { ok: false; reason: string; missing: ConsentEventType[] };

/**
 * Bevis at klinikken må starte en LiveKit-session for denne klient lige nu.
 * Kræver:
 *   - clinic_dpa_signed (nogensinde for tenant)
 *   - physical_signage_confirmed (nogensinde for tenant)
 *   - verbal_ack_recorded WITH audio_snippet_url (< 60s siden, for denne client)
 *
 * Returnerer {ok:true, verbal_ack_id} som skal citeres i LiveKit-metadata.
 */
export function assertConsentToStartSession(
  input: ConsentGuardInput,
): ConsentGuardResult {
  const now = input.now ?? new Date();
  const tenantEvents = sink.filter((e) => e.tenant_id === input.tenant_id);

  const missing: ConsentEventType[] = [];

  const hasDpa = tenantEvents.some((e) => e.event_type === "clinic_dpa_signed");
  if (!hasDpa) missing.push("clinic_dpa_signed");

  const hasSignage = tenantEvents.some(
    (e) => e.event_type === "physical_signage_confirmed",
  );
  if (!hasSignage) missing.push("physical_signage_confirmed");

  const verbalAck = tenantEvents
    .filter(
      (e) =>
        e.event_type === "verbal_ack_recorded" &&
        e.client_id === input.client_id &&
        e.audio_snippet_url &&
        now.getTime() - new Date(e.captured_at).getTime() <
          VERBAL_ACK_MAX_AGE_MS,
    )
    .sort(
      (a, b) =>
        new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime(),
    )[0];

  if (!verbalAck) missing.push("verbal_ack_recorded");

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Consent-guard blokerer session-start · mangler: ${missing.join(", ")}`,
      missing,
    };
  }

  return { ok: true, verbal_ack_id: verbalAck!.id };
}

// ---------------------------------------------------------------------------
// Reads / test-helpers
// ---------------------------------------------------------------------------

export function listConsentEvents(tenantId: string): ConsentEvent[] {
  return sink.filter((e) => e.tenant_id === tenantId);
}

/** Test-only: nulstil sink mellem test-runs. */
export function _resetConsentSinkForTests(): void {
  sink.length = 0;
}
