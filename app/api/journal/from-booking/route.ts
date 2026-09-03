import { NextResponse } from "next/server";
import { ensureJournalForBooking, getJournalByBooking } from "@/lib/journal";
import { getBooking } from "@/lib/bookings";
import { auditLog } from "@/lib/audit";
import { jsonAuthFail, requireTenantAccess } from "@/lib/request-auth";

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
  const booking = getBooking(body.bookingId);
  if (!booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  const auth = requireTenantAccess(req, booking.tenant, {
    // reception may open journal from booking; practitioners/owners too
    roles: ["owner", "practitioner", "reception", "support"],
    permissions: ["bookings"],
    scopes: ["write:journal"],
  });
  if (!auth.ok) return jsonAuthFail(auth);

  try {
    const existing = getJournalByBooking(body.bookingId);
    const entry = await ensureJournalForBooking(body.bookingId);
    if (!existing) {
      auditLog("journal.created_from_booking", {
        tenant_id: booking.tenant,
        actor_user_id: auth.accountId,
        target_ref: `journal/${entry.id}`,
        bookingId: body.bookingId,
      });
    }
    return NextResponse.json({ ok: true, created: !existing, entry });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
