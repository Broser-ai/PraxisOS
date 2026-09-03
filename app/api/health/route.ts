import { NextResponse } from "next/server";
import { dataBackend } from "@/lib/data/repo";
import {
  assertProductionDbConfig,
  currentConfig,
  db,
  DB_MODE,
} from "@/lib/supabase";

/**
 * F26 · sanitize health `detail` so public readiness never echoes secrets,
 * connection strings, JWTs, or service-role key names with values.
 * Allowlisted ops phrases (e.g. "KEY missing") stay; URL credentials and
 * long opaque tokens are stripped.
 */
export function sanitizeHealthDetail(detail: string | null | undefined): string | null {
  if (detail == null || detail === "") return null;
  let out = detail;
  // Strip URL userinfo (scheme://user:pass@host)
  out = out.replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s]+)@/gi, "$1[REDACTED]@");
  // Strip Bearer / service-role-looking JWTs and long opaque tokens
  out = out.replace(
    /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,
    "[REDACTED_JWT]",
  );
  out = out.replace(
    /\b(sk_(?:live|test)_[A-Za-z0-9]{8,}|sb_secret_[A-Za-z0-9]+|service_role[^\s]*)\b/gi,
    "[REDACTED]",
  );
  // Never echo raw env assignment fragments
  out = out.replace(
    /\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|PRAXIS_SESSION_SECRET|AGENT_WORKER_SECRET)\s*=\s*\S+/gi,
    "$1=[REDACTED]",
  );
  return out;
}

/**
 * Readiness probe. Public OK for ops.
 * F16: production + PRAXIS_DB=mock (or missing Supabase keys) → 503 fail-fast
 * so cutover cannot silently run on memory in prod.
 * F26: detail/reason never echo secrets or credentialized URLs.
 */
export async function GET() {
  const configCheck = assertProductionDbConfig();
  if (!configCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_config_invalid",
        reason: sanitizeHealthDetail(configCheck.reason),
        dbMode: DB_MODE,
        backend: dataBackend(),
        region: currentConfig.region,
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  const ping = await db.ping();
  return NextResponse.json({
    ok: ping.ok,
    dbMode: DB_MODE,
    backend: dataBackend(),
    region: currentConfig.region,
    latencyMs: ping.latencyMs,
    detail: sanitizeHealthDetail(ping.detail ?? null),
    time: new Date().toISOString(),
  });
}
