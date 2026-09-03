// Consent · durable consent_events + enforcement gates (P0 plan §D.2/§D.3/§F7).
//
// PRINCIP: photo capture, AI-processing (SOAP draft, scan AI), SMS marketing
// and research MUST be gated on an active consent event BEFORE the handling.
// Legacy ClientProfile.consentLevel is a fallback (with audit-warn) until
// events are backfilled; new grants are written as events.
//
// Persistens: in-memory mirror of SQL consent_events (migration 0007) for the
// mock/memory backend. When PRAXIS_DB=supabase*, recordConsentEvent inserts
// into the consent_events table. NO raw CPR in evidence.

import { auditLog } from "@/lib/audit";
import { getClient } from "@/lib/clients";
import { getServiceSupabase } from "@/lib/supabase";

export type ConsentPurpose =
  | "treatment"
  | "journal"
  | "photo_capture"
  | "ai_processing"
  | "sms_transactional"
  | "sms_marketing"
  | "patient_guidance"
  | "research";

export type ConsentEventType =
  | "granted"
  | "revoked"
  | "opt_out"
  | "superseded";

export type ConsentChannel =
  | "web_onboarding"
  | "clinic_desk"
  | "sms_link"
  | "api"
  | "import";

export type ConsentEvent = {
  id: string;
  tenantId: string;
  clientId: string;
  eventType: ConsentEventType;
  purpose: ConsentPurpose;
  consentVersion: string;
  channel: ConsentChannel;
  evidence: Record<string, unknown>;
  effectiveAt: string;
  revokedAt?: string;
  actorUserId?: string;
  createdAt: string;
  /** Monotonic insertion order — tiebreaker when effectiveAt is equal. */
  seq: number;
};

export type ConsentFail = {
  ok: false;
  status: 403;
  body: { error: "consent_required"; purpose: ConsentPurpose; clientId: string };
};

export type ConsentOk = { ok: true; source: "event" | "legacy"; clientId: string };

const events: ConsentEvent[] = [];
let eventSeq = 0;

/** Test helper. */
export function _resetConsentEventsForTests(): void {
  events.length = 0;
  eventSeq = 0;
}

/** Test helper — read the in-memory event log. */
export function _readConsentEventsForTests(): ConsentEvent[] {
  return events.slice();
}

function nextId(): string {
  return "cse_" + Math.random().toString(36).slice(2, 11);
}

/**
 * Map legacy ClientProfile.consentLevel → implicit purposes (fallback only).
 *   Almindelig   → treatment, sms_transactional
 *   Sundhedsdata → + journal, photo_capture, ai_processing
 *   Forskning    → + research
 */
const LEGACY_PURPOSES: Record<string, ConsentPurpose[]> = {
  Almindelig: ["treatment", "sms_transactional"],
  Sundhedsdata: ["treatment", "sms_transactional", "journal", "photo_capture", "ai_processing"],
  Forskning: [
    "treatment",
    "sms_transactional",
    "journal",
    "photo_capture",
    "ai_processing",
    "research",
  ],
};

export function legacyPurposesForClient(clientId: string): ConsentPurpose[] {
  const c = getClient(clientId);
  if (!c) return [];
  return LEGACY_PURPOSES[c.consentLevel] ?? [];
}

/**
 * Record a consent event (granted / revoked / opt_out / superseded).
 * Inserts into the in-memory mirror and (when available) the SQL table.
 * Always emits an audit record.
 */
export function recordConsentEvent(input: {
  tenantId: string;
  clientId: string;
  eventType: ConsentEventType;
  purpose: ConsentPurpose;
  consentVersion?: string;
  channel?: ConsentChannel;
  evidence?: Record<string, unknown>;
  actorUserId?: string;
  effectiveAt?: string;
}): ConsentEvent {
  const event: ConsentEvent = {
    id: nextId(),
    tenantId: input.tenantId,
    clientId: input.clientId,
    eventType: input.eventType,
    purpose: input.purpose,
    consentVersion: input.consentVersion ?? "p0-v1",
    channel: input.channel ?? "api",
    evidence: input.evidence ?? {},
    effectiveAt: input.effectiveAt ?? new Date().toISOString(),
    actorUserId: input.actorUserId,
    createdAt: new Date().toISOString(),
    seq: ++eventSeq,
  };

  events.push(event);

  const sb = getServiceSupabase();
  if (sb) {
    void sb
      .from("consent_events")
      .insert({
        tenant_id: input.tenantId,
        client_id: input.clientId,
        event_type: event.eventType,
        purpose: event.purpose,
        consent_version: event.consentVersion,
        channel: event.channel,
        evidence: event.evidence,
        effective_at: event.effectiveAt,
        actor_user_id: event.actorUserId ?? null,
      })
      .then(undefined, (err: unknown) => {
        auditLog("consent.persist_error", {
          tenant_id: input.tenantId,
          target_ref: `client/${input.clientId}`,
          meta: { error: err instanceof Error ? err.message : String(err) },
          level: "warn",
        });
      });
  }

  auditLog("consent.recorded", {
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId,
    target_ref: `client/${input.clientId}`,
    meta: { eventType: event.eventType, purpose: event.purpose, channel: event.channel },
  });

  return event;
}

/**
 * Does the client have an active consent for the given purpose at `at`?
 * - Latest event for (tenant, client, purpose): granted wins unless a later
 *   revoke/opt_out/supersede exists.
 * - Falls back to legacy consentLevel mapping when no events exist (returns
 *   source:"legacy"); callers should treat legacy as valid but audit-warn.
 */
export function hasActiveConsent(input: {
  tenantId: string;
  clientId: string;
  purpose: ConsentPurpose;
  at?: string;
}): ConsentOk | ConsentFail {
  const at = input.at ?? new Date().toISOString();
  const relevant = events
    .filter(
      (e) =>
        e.tenantId === input.tenantId &&
        e.clientId === input.clientId &&
        e.purpose === input.purpose &&
        e.effectiveAt <= at,
    )
    .sort((a, b) =>
      b.effectiveAt.localeCompare(a.effectiveAt) || b.seq - a.seq,
    );

  if (relevant.length) {
    const latest = relevant[0]!;
    if (latest.eventType === "granted") {
      return { ok: true, source: "event", clientId: input.clientId };
    }
    // revoked / opt_out / superseded → no active consent
    return {
      ok: false,
      status: 403,
      body: { error: "consent_required", purpose: input.purpose, clientId: input.clientId },
    };
  }

  // Legacy fallback — consentLevel mapping
  if (legacyPurposesForClient(input.clientId).includes(input.purpose)) {
    auditLog("consent.legacy_fallback", {
      tenant_id: input.tenantId,
      target_ref: `client/${input.clientId}`,
      meta: { purpose: input.purpose, reason: "no_event_backfill" },
      level: "warn",
    });
    return { ok: true, source: "legacy", clientId: input.clientId };
  }

  return {
    ok: false,
    status: 403,
    body: { error: "consent_required", purpose: input.purpose, clientId: input.clientId },
  };
}

/**
 * Assert consent — returns a result usable directly by routes (shape matches
 * AuthFail so jsonAuthFail can render it). Throws nothing.
 */
export function assertConsent(input: {
  tenantId: string;
  clientId: string;
  purpose: ConsentPurpose;
  actorUserId?: string;
}): ConsentOk | ConsentFail {
  return hasActiveConsent(input);
}
