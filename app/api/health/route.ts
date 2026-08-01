// GET /api/health
//
// Engine-status healthcheck. Returner build-version, foot-scanner
// engine-status og aktiv DB-mode.

import { NextResponse } from "next/server";
import { isEngineOnline } from "@/lib/foot-scanner";
import { DB_MODE } from "@/lib/supabase";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    timestamp: new Date().toISOString(),
    foot_scanner_online: await isEngineOnline(),
    db_mode: DB_MODE,
  });
}
