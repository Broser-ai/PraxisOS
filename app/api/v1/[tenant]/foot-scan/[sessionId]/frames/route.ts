// POST /api/v1/[tenant]/foot-scan/[sessionId]/frames
// multipart/form-data: files[]  (jpg/png/mp4/mov/webm)
//
// Streamer uploads videre til Python engine's POST /sessions/[id]/frames.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "@/lib/foot-scanner";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; sessionId: string }> },
) {
  const { sessionId } = await params;
  const form = await req.formData();
  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (value instanceof File) files.push(value);
    // tolerér både "files" og "file"
    void key;
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "no files uploaded" }, { status: 400 });
  }
  const online = await fs.isEngineOnline();
  if (!online) {
    return NextResponse.json({ ok: true, frames: files.length, _stub: true });
  }
  try {
    const r = await fs.uploadFrames(sessionId, files);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}

// Disable Next.js body parsing so multipart streams straight through
export const config = {
  api: { bodyParser: false },
};
