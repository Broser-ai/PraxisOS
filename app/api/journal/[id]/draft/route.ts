import { NextResponse } from "next/server";
import { draftSoapForEntry } from "@/lib/journal";
import { auditLog } from "@/lib/audit";
import { jsonAuthFail, requireJournalAccess } from "@/lib/request-auth";

export const runtime = "nodejs";

/** Niels · generér SOAP-udkast fra transcript — suggestion-only; no auto-sign */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requireJournalAccess(req, id, {
    permissions: ["journal"],
    roles: ["owner", "practitioner", "support"],
    write: true,
  });
  if (!auth.ok) return jsonAuthFail(auth);

  let transcript: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.transcript === "string") transcript = body.transcript;
  } catch {
    // empty ok
  }
  try {
    const entry = await draftSoapForEntry(id, { transcript });
    auditLog("journal.ai_draft", {
      tenant_id: entry.tenant,
      actor_user_id: auth.accountId,
      target_ref: `journal/${entry.id}`,
      note: "suggestion_only_no_auto_sign",
    });
    return NextResponse.json({ ok: true, entry, agent: "niels" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "draft_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
