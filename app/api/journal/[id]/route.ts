import { NextResponse } from "next/server";
import { updateJournalEntry } from "@/lib/journal";
import { auditLogWithContext } from "@/lib/audit";
import { jsonAuthFail, requireJournalAccess } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requireJournalAccess(req, id, {
    permissions: ["journal"],
    roles: ["owner", "practitioner", "support"],
  });
  if (!auth.ok) return jsonAuthFail(auth);
  return NextResponse.json({ entry: auth.entry });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requireJournalAccess(req, id, {
    permissions: ["journal"],
    roles: ["owner", "practitioner", "support"],
    write: true,
  });
  if (!auth.ok) return jsonAuthFail(auth);

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
    auditLogWithContext(req, "journal.updated", {
      tenant_id: entry.tenant,
      actor_user_id: auth.accountId,
      target_ref: `journal/${entry.id}`,
      auth_mode: auth.mode,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "update_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
