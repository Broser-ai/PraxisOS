// PraxisOS audit-log · Sprint 6 blocker-fix B1
// Kontrakt: Sundhedsloven §42a-d · MDR Art. 83 · GDPR Art. 30 · Presafe letter
//
// PRINCIP:
//   Alt der er klinisk-relevant + alle tenant-scoped mutations SKAL emitte
//   en audit-record. Records er redacted for CPR før de logges/persisteres.
//
// PERSISTENS-MODES (env PRAXIS_AUDIT_MODE):
//   'memory'   · in-memory ring buffer (default · test + dev)
//   'supabase' · skriver til audit_log-tabellen (kræver SUPABASE_SERVICE_ROLE_KEY)
//   'stub'     · silent no-op (kun til tests der eksplicit ikke skal ramme audit)
//
// SIKKERHED: default er 'memory' — production SKAL sætte 'supabase' eksplicit
// før CE-mark. Se test tests/regulatory/audit-wiring.test.ts.

import { redactPII } from "./redact";

export type AuditMeta = Record<string, unknown>;

export type AuditRecord = {
  event: string;
  ts: string;                    // ISO 8601 UTC
  level: "info" | "warn" | "error";
  meta: AuditMeta;               // pre-redacted payload
  tenant_id?: string;
  actor_user_id?: string;
  target_ref?: string;           // fx "scan/scan_bp_001", "config/cfg_bp_003"
};

// ---------------------------------------------------------------------------
// In-memory ring buffer (default sink)
// ---------------------------------------------------------------------------

const MEMORY_SINK_LIMIT = 10_000;
const memorySink: AuditRecord[] = [];

function pushMemory(rec: AuditRecord): void {
  memorySink.push(rec);
  if (memorySink.length > MEMORY_SINK_LIMIT) {
    memorySink.splice(0, memorySink.length - MEMORY_SINK_LIMIT);
  }
}

/** Test-only accessor. Never call in production code paths. */
export function _readMemorySink(): AuditRecord[] {
  return memorySink.slice();
}

/** Test-only reset. Never call in production code paths. */
export function _clearMemorySink(): void {
  memorySink.length = 0;
}

// ---------------------------------------------------------------------------
// Persistens dispatch
// ---------------------------------------------------------------------------

function getMode(): "memory" | "supabase" | "stub" {
  const m = process.env.PRAXIS_AUDIT_MODE;
  if (m === "supabase" || m === "stub" || m === "memory") return m;
  return "memory";
}

async function persistSupabase(rec: AuditRecord): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Fail-loud in production, degrade to memory + warn elsewhere
    if (process.env.NODE_ENV === "production") {
      throw new Error("PRAXIS_AUDIT_MODE=supabase requires SUPABASE_SERVICE_ROLE_KEY");
    }
    console.warn("[audit] PRAXIS_AUDIT_MODE=supabase but keys missing — falling back to memory");
    pushMemory(rec);
    return;
  }
  try {
    await fetch(`${url}/rest/v1/audit_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        at: rec.ts,
        action: rec.event,
        tenant_id: rec.tenant_id ?? null,
        actor_user_id: rec.actor_user_id ?? null,
        target_ref: rec.target_ref ?? null,
        meta: rec.meta,
        level: rec.level,
      }),
    });
  } catch (err) {
    // Even in prod: never let audit-log failure crash the caller path.
    // But DO push to memory + surface via error-log so ops can react.
    console.error("[audit] Supabase persist failed:", (err as Error).message);
    pushMemory(rec);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Emit an audit-log record. Payload gennemgår redactPII før persistens
 * (INV-3 · ingen råt CPR i audit_log).
 *
 * Non-blocking: hvis mode=supabase kaldes fire-and-forget (returnerer void).
 * Fejl i sink må ALDRIG boble tilbage til caller-path.
 */
export function auditLog(event: string, meta?: AuditMeta): void {
  const rec: AuditRecord = {
    event,
    ts: new Date().toISOString(),
    level: "info",
    meta: (redactPII(meta ?? {}) as AuditMeta),
    tenant_id: extractString(meta, "tenant_id"),
    actor_user_id: extractString(meta, "actor_user_id"),
    target_ref: extractString(meta, "target_ref"),
  };
  dispatch(rec);
}

/**
 * Emit an audit-log error record. Same guarantees som auditLog.
 * Fejl-beskeden strippes for stack + evt. keys/tokens via redactPII.
 */
export function auditError(event: string, err: unknown, meta?: AuditMeta): void {
  const errMsg = err instanceof Error ? err.message : String(err);
  const rec: AuditRecord = {
    event,
    ts: new Date().toISOString(),
    level: "error",
    meta: (redactPII({ ...(meta ?? {}), error: errMsg }) as AuditMeta),
    tenant_id: extractString(meta, "tenant_id"),
    actor_user_id: extractString(meta, "actor_user_id"),
    target_ref: extractString(meta, "target_ref"),
  };
  dispatch(rec);
}

function dispatch(rec: AuditRecord): void {
  const mode = getMode();
  if (mode === "stub") return;
  if (mode === "memory") {
    pushMemory(rec);
    return;
  }
  // supabase mode · fire-and-forget
  void persistSupabase(rec);
  // Also push to memory as an L1 read-cache (bounded)
  pushMemory(rec);
}

function extractString(meta: AuditMeta | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === "string" ? v : undefined;
}
