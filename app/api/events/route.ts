// PraxisOS event-bus · /api/events
//
// Intern publish/subscribe-system for hele platformen.
// Andre moduler (Journal, Marketing, Aria) abonnerer på events de bryder sig om.
//
// Event-types (ikke-udtømmende):
//   payment.authorized, payment.captured, payment.refunded, payment.disputed
//   booking.created, booking.confirmed, booking.cancelled
//   risk.high_score, trust.step_up_required
//   settlement.batch_ready, settlement.payout_sent
//   journal.note_signed, scan.completed, ai.scribe_drafted
//
// Sikkerhed: HMAC-signed payload + tenant_id i alle events.
// Persistens: hver event har sequence-id og kan replay'es (event-sourcing).

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

type PraxisEvent = {
  id: string;
  type: string;
  tenant: string;
  at: string;
  data: Record<string, unknown>;
};

// In-memory event-log til prototypen — i prod: Postgres + pg_notify eller Inngest
const EVENT_LOG: PraxisEvent[] = [];

// POST · publish nyt event (kun internt — externe processers signerer via HMAC)
export async function POST(req: Request) {
  const sig = req.headers.get("x-praxis-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 401 });

  const raw = await req.text();
  // Sprint 6 Batch 2: HMAC verificeres i ALLE miljøer (ikke kun production).
  // Secret hentes fra `PRAXIS_EVENTS_SECRET`; falder tilbage til demo-key
  // udenfor production, men throw'er hvis env-varen mangler i prod.
  const secret = getEventsSecret();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (!signaturesEqual(sig, expected)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let evt: Partial<PraxisEvent>;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (!evt.type || !evt.tenant) {
    return NextResponse.json({ error: "type_and_tenant_required" }, { status: 400 });
  }

  const stored: PraxisEvent = {
    id: "evt_" + Math.random().toString(36).slice(2, 14),
    type: evt.type!,
    tenant: evt.tenant!,
    at: new Date().toISOString(),
    data: evt.data ?? {},
  };
  EVENT_LOG.unshift(stored);
  if (EVENT_LOG.length > 1000) EVENT_LOG.pop();

  // Subscribers / handlers (genbrug af interne moduler) — i prod via pg_notify
  // dispatchToHandlers(stored)

  return NextResponse.json({ accepted: true, id: stored.id, sequence: EVENT_LOG.length });
}

// GET · læs eventlog (intern observability)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant");
  const type = url.searchParams.get("type");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? "50"));

  const filtered = EVENT_LOG.filter((e) => {
    if (tenant && e.tenant !== tenant) return false;
    if (type && !e.type.startsWith(type)) return false;
    return true;
  }).slice(0, limit);

  return NextResponse.json({ count: filtered.length, events: filtered });
}

// --- Sprint 6 Batch 2 helpers -----------------------------------------------

function getEventsSecret(): string {
  const s = process.env.PRAXIS_EVENTS_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRAXIS_EVENTS_SECRET er påkrævet i production");
  }
  return "demo-secret-key";
}

/** Konstant-tid sammenligning af hex-strings; falder tilbage til false ved format-fejl. */
function signaturesEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  try {
    const a = Buffer.from(actual, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
