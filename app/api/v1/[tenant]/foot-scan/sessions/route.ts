// POST /api/v1/[tenant]/foot-scan/sessions
// GET  /api/v1/[tenant]/foot-scan/sessions?clientId=...
//
// Broen mellem Next.js-tenant-lag og Python foot-scanner engine.
// Auth: `Authorization: Bearer sk_live_...` valideres mod tenant-API-keys.
// Engine-token forbliver server-side (env var FOOT_SCANNER_TOKEN).

import { NextRequest, NextResponse } from "next/server";
import * as fs from "@/lib/foot-scanner";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body?.clientId || !body?.side) {
    return NextResponse.json(
      { error: "clientId and side (L|R) are required" },
      { status: 400 },
    );
  }
  const online = await fs.isEngineOnline();
  if (!online) {
    return NextResponse.json({
      id: `fs_stub_${Math.random().toString(36).slice(2, 12)}`,
      tenant_slug: tenant,
      client_id: body.clientId,
      side: body.side,
      source: body.source ?? "phone_photos",
      marker_type: body.markerType ?? "a4",
      status: "capturing",
      frame_count: 0,
      mesh_uri: null,
      report_uri: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _stub: true,
    }, { status: 201 });
  }
  try {
    const session = await fs.newSession({
      tenant,
      clientId: body.clientId,
      side: body.side,
      source: body.source,
      markerType: body.markerType,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const clientId = req.nextUrl.searchParams.get("clientId") ?? undefined;
  const online = await fs.isEngineOnline();
  if (!online) return NextResponse.json({ count: 0, sessions: [], _stub: true });
  try {
    const sessions = await fs.listSessions({ tenant, clientId });
    return NextResponse.json({ count: sessions.length, sessions });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
