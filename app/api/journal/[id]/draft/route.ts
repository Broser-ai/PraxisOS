import { NextResponse } from "next/server";
import { draftSoapForEntry, getJournalEntry } from "@/lib/journal";

export const runtime = "nodejs";

/** Niels · generér SOAP-udkast fra transcript */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getJournalEntry(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  let transcript: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.transcript === "string") transcript = body.transcript;
  } catch {
    // empty ok
  }
  try {
    const entry = await draftSoapForEntry(id, { transcript });
    return NextResponse.json({ ok: true, entry, agent: "niels" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "draft_failed" }, { status: 400 });
  }
}
