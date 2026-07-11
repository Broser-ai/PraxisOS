// TODO: Rebuild in EPIC 2 via NeuralMeshing and S-Agent.
//
// Whole module temporarily disabled — safety-kit/redact declaration is
// missing and out of scope for EPIC 1. Callers get no-op fallbacks so
// nothing crashes; real audit-logging returns in a later EPIC.

type AuditMeta = Record<string, unknown>;

export function auditLog(_event: string, _meta?: AuditMeta): void {
  // no-op until rebuilt
}

export function auditError(_event: string, _err: unknown, _meta?: AuditMeta): void {
  // no-op until rebuilt
}

/* =============================================================================
 * ORIGINAL SOURCE (disabled — see TODO above)
 * =============================================================================
 *
 * import { redact } from "safety-kit/redact"
 *
 * type AuditMeta = Record<string, unknown>
 *
 * export function auditLog(event: string, meta?: AuditMeta): void {
 *   const line = `[audit] ${event} ${meta ? JSON.stringify(meta) : ""}`
 *   console.log(redact(line))
 * }
 *
 * export function auditError(event: string, err: unknown, meta?: AuditMeta): void {
 *   const errMsg = err instanceof Error ? err.message : String(err)
 *   const line = `[audit:error] ${event} ${errMsg} ${meta ? JSON.stringify(meta) : ""}`
 *   console.error(redact(line))
 * }
 *
 * ============================================================================= */
