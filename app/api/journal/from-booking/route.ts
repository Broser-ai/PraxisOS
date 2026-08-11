import { NextResponse } from "next/server";
import { ensureJournalForBooking, getJournalByBooking } from "@/lib/journal";
import { getBooking } from "@/lib/bookings";

export const runtime = "nodejs";

/** Opret eller hent journalpost for en booking (behandling) */
export async function POST(req: Request) {
  let body: { bookingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.bookingId) {
    return NextResponse.json({ error: "bookingId_required" }, { status: 400 });
  }
  if (!getBooking(body.bookingId)) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }
  try {
    const existing = getJournalByBooking(body.bookingId);
    const entry = await ensureJournalForBooking(body.bookingId);
    return NextResponse.json({ ok: true, created: !existing, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "failed" }, { status: 400 });
  }
}
