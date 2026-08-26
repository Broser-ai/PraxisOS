import { NextResponse } from "next/server";
import { getJournalEntry, updateJournalEntry } from "@/lib/journal";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const entry = getJournalEntry(id);
  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: {
    soap?: { S?: string; O?: string; A?: string; P?: string };
    codes?: string[];
    transcript?: string;
    status?: "draft" | "pending_approval";
    service?: string;
    practitioner?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const entry = updateJournalEntry(id, body);
    if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "update_failed" }, { status: 400 });
  }
}
