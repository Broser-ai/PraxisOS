import { NextResponse } from "next/server";
import { signJournalEntry } from "@/lib/journal";
import { auditLog } from "@/lib/audit";
import { jsonAuthFail, requireJournalAccess } from "@/lib/request-auth";

export const runtime = "nodejs";

/** Behandler signerer og låser journalpost — kræver practitioner/owner/support */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requireJournalAccess(req, id, {
    permissions: ["journal"],
    roles: ["practitioner", "owner", "support"],
    write: true,
  });
  if (!auth.ok) return jsonAuthFail(auth);

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
    auditLog("journal.signed", {
      tenant_id: entry.tenant,
      actor_user_id: auth.accountId,
      target_ref: `journal/${entry.id}`,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "sign_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
