import { NextResponse } from "next/server";
import { dataBackend } from "@/lib/data/repo";
import { currentConfig, db, DB_MODE } from "@/lib/supabase";

export async function GET() {
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
