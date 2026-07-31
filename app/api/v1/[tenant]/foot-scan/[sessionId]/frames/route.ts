// POST /api/v1/[tenant]/foot-scan/[sessionId]/frames
// multipart/form-data: files[]  (jpg/png/mp4/mov/webm)
//
// Sprint 6 blocker B5 · auth + upload hardening:
//   - Kræver gyldig session-cookie (praxis_session, via lib/auth.ts) ELLER
//     et gyldigt API-key bearer-token (lib/api-keys.ts::verifyBearerToken),
//     begge tenant-scoped mod URL'ens {tenant}.
//   - Content-Length header check før formData() parses: afvis > 50MB tidligt.
//   - Autoritativ sum af files[i].size efter parsing: samme 50MB-grænse.
//   - mime-allowlist på files[i].type: kun jpeg/png/mp4/webm/quicktime.
//   - _stub-fallback når engine er offline er bevaret uændret.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "@/lib/foot-scanner";
import { verifyBearerToken } from "@/lib/api-keys";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function isAuthorized(req: NextRequest, tenant: string): boolean {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = decodeSession(cookie ?? "");
  if (session && session.tenant === tenant) return true;

  const verified = verifyBearerToken(req.headers.get("authorization"), {
    requiredTenant: tenant,
  });
  if (verified) return true;

  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; sessionId: string }> },
) {
  const { tenant, sessionId } = await params;

  if (!isAuthorized(req, tenant)) {
    return NextResponse.json(
      { error: "unauthorized", hint: "Kræver gyldig session-cookie eller API-key" },
      { status: 401 },
    );
  }

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "payload_too_large", maxBytes: MAX_TOTAL_BYTES },
        { status: 413 },
      );
    }
  }

  const form = await req.formData();
  const files: File[] = [];
  for (const [key, value] of form.entries()) {
    if (value instanceof File) files.push(value);
    void key;
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "no files uploaded" }, { status: 400 });
  }

  const rejected = files.find((f) => !ALLOWED_MIME_TYPES.has(f.type));
  if (rejected) {
    return NextResponse.json(
      {
        error: "unsupported_media_type",
        file: rejected.name,
        type: rejected.type,
        allowed: Array.from(ALLOWED_MIME_TYPES),
      },
      { status: 415 },
    );
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "payload_too_large", maxBytes: MAX_TOTAL_BYTES, totalBytes },
      { status: 413 },
    );
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

export const config = {
  api: { bodyParser: false },
};
