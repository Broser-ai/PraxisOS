import { NextResponse } from "next/server";
import { dataBackend } from "@/lib/data/repo";
import {
  assertProductionDbConfig,
  currentConfig,
  db,
  DB_MODE,
} from "@/lib/supabase";

/**
 * Readiness probe. Public OK for ops.
 * F16: production + PRAXIS_DB=mock (or missing Supabase keys) → 503 fail-fast
 * so cutover cannot silently run on memory in prod.
 */
export async function GET() {
  const configCheck = assertProductionDbConfig();
  if (!configCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_config_invalid",
        reason: configCheck.reason,
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
    detail: ping.detail ?? null,
    time: new Date().toISOString(),
  });
}
