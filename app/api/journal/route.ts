import { NextResponse } from "next/server";
import {
  listJournal,
  createJournalEntry,
  journalStats,
  type JournalStatus,
} from "@/lib/journal";
import { ensureWorkflowSubscription } from "@/lib/agents/workflows";

export const runtime = "nodejs";

export async function GET(req: Request) {
  ensureWorkflowSubscription();
  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant") ?? "bypilar";
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const bookingId = url.searchParams.get("bookingId") ?? undefined;
  const status = url.searchParams.get("status") as JournalStatus | null;
  const entries = listJournal({
    tenant,
    clientId,
    bookingId,
    status: status ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? "50"),
  });
  return NextResponse.json({
    count: entries.length,
    stats: journalStats(tenant),
    entries,
  });
}

export async function POST(req: Request) {
  ensureWorkflowSubscription();
  let body: {
    clientId?: string;
    bookingId?: string;
    tenant?: string;
    service?: string;
    serviceId?: string;
    practitioner?: string;
    transcript?: string;
    soap?: { S?: string; O?: string; A?: string; P?: string };
    aiDrafted?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.clientId) {
    return NextResponse.json({ error: "clientId_required" }, { status: 400 });
  }
  try {
    const entry = await createJournalEntry({
      clientId: body.clientId,
      bookingId: body.bookingId,
      tenant: body.tenant,
      service: body.service,
      serviceId: body.serviceId,
      practitioner: body.practitioner,
      transcript: body.transcript,
      soap: body.soap,
      aiDrafted: body.aiDrafted,
      draftedBy: body.aiDrafted ? "niels" : "clinician",
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    const msg = err?.message || "create_failed";
    const status = msg === "journal_exists_for_booking" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
