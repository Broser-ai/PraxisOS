// Shared authorization for agent worker / cron endpoints.
//
// SECURITY (P0 plan §F12): the worker heartbeat (/api/agents/tick) and the
// workflows runner (/api/agents/workflows) must NOT be callable without a
// shared secret in production. Previously both routes returned authorized
// when AGENT_WORKER_SECRET / PRAXIS_EVENT_SECRET was unset — fine for a local
// demo / first boot, but an unauthenticated cron trigger in production.
//
// Policy:
//   - NODE_ENV=production AND no secret configured → REJECT (fail-closed),
//     audit-warn so ops see the misconfiguration.
//   - Non-production AND no secret configured → allow (open for demo).
//   - Secret configured → timing-safe compare of the x-agent-worker-secret
//     header OR the Authorization: Bearer header.
//
// No clinical-policy change. Suggestion-only.

import { timingSafeEqual } from "node:crypto";
import { auditLogWithContext } from "@/lib/audit";

export type AuthorizeWorkerResult = {
  ok: boolean;
  /** Present and informative for audit; safe to log. */
  reason: "secret_match" | "dev_open" | "no_secret_prod" | "secret_mismatch";
};

function resolveSecret(): string | undefined {
  const s = process.env.AGENT_WORKER_SECRET?.trim() || process.env.PRAXIS_EVENT_SECRET?.trim();
  return s || undefined;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Authorize an agent worker / cron request.
 * Caller returns 401 when `ok` is false.
 */
export function authorizeWorker(req: Request): AuthorizeWorkerResult {
  const secret = resolveSecret();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // F68 · request-context audit (was bare auditLog)
      auditLogWithContext(req, "agent_worker.unauthorized_no_secret", {
        auth_mode: "machine",
      });
      return { ok: false, reason: "no_secret_prod" };
    }
    // Non-production: open for demo / first boot.
    return { ok: true, reason: "dev_open" };
  }

  const headerSecret =
    req.headers.get("x-agent-worker-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (!headerSecret) {
    return { ok: false, reason: "secret_mismatch" };
  }

  if (safeEqual(headerSecret, secret)) {
    return { ok: true, reason: "secret_match" };
  }
  return { ok: false, reason: "secret_mismatch" };
}
