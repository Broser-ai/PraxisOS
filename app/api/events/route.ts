// PraxisOS event-bus · /api/events
//
// Intern publish/subscribe-system for hele platformen.
// Agenter abonnerer via lib/agents/workflows (ensureWorkflowSubscription).
//
// F19: GET is staff-gated (owner/practitioner/support) — event history is
// automation/clinic data. POST stays HMAC-signed (machine / internal).

import { NextResponse } from "next/server";
import {
  publishEvent,
  listEvents,
  verifyEventSignature,
  signEventPayload,
} from "@/lib/event-bus";
import { ensureWorkflowSubscription } from "@/lib/agents/workflows";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  ensureWorkflowSubscription();
  const sig = req.headers.get("x-praxis-signature");
  const raw = await req.text();

  const isProd = process.env.NODE_ENV === "production";
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 401 });
  if (!verifyEventSignature(raw, sig) && isProd) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  // In non-prod, accept demo signature mismatch but prefer valid ones

  let evt: { type?: string; tenant?: string; data?: Record<string, unknown>; source?: string };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!evt.type || !evt.tenant) {
    return NextResponse.json({ error: "type_and_tenant_required" }, { status: 400 });
  }

  const stored = await publishEvent({
    type: evt.type,
    tenant: evt.tenant,
    data: evt.data ?? {},
    source: evt.source ?? "api/events",
  });

  return NextResponse.json({
    accepted: true,
    id: stored.id,
    dispatched: true,
    hint: "Signér med HMAC-SHA256 af body · header x-praxis-signature",
    demoSignature: process.env.NODE_ENV === "production" ? undefined : signEventPayload(raw),
  });
}

export async function GET(req: Request) {
  // Staff-only event list (was unauthenticated — automation-leak).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, [
    "owner",
    "practitioner",
    "support",
  ]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);

  ensureWorkflowSubscription();
  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant");
  const type = url.searchParams.get("type");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? "50"));
  const events = listEvents({ tenant, type, limit });
  return NextResponse.json({ count: events.length, events });
}
