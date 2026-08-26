import { NextResponse } from "next/server";
import { signJournalEntry, getJournalEntry } from "@/lib/journal";

export const runtime = "nodejs";

/** Behandler signerer og låser journalpost */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getJournalEntry(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  let body: {
    signedBy?: string;
    soap?: { S?: string; O?: string; A?: string; P?: string };
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty ok
  }
  try {
    const entry = await signJournalEntry(id, body);
    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "sign_failed" }, { status: 400 });
  }
}
