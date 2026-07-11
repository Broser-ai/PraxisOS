// GET /api/v1/[tenant]/foot-scan/[sessionId]/report
//
// Returnerer den fulde biomekaniske rapport. Genereres on-demand hvis den
// endnu ikke er cached i engine.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "@/lib/foot-scanner";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant: string; sessionId: string }> },
) {
  const { sessionId } = await params;
  try {
    const report = await fs.report(sessionId);
    return NextResponse.json(report);
  } catch (e: any) {
    // Engine offline? Fall back to deterministic stub så UI aldrig knækker.
    const online = await fs.isEngineOnline();
    if (!online) {
      return NextResponse.json({ ...fs.stubReport(sessionId, "R"), _stub: true });
    }
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
