import { NextResponse } from "next/server";
import { decideApproval, listApprovals, getRun } from "@/lib/agent-store";
import { publishEvent } from "@/lib/event-bus";
import { sendBirdSms, isBirdConfigured } from "@/lib/bird";
import { signJournalEntry } from "@/lib/journal";
import { auditLogWithContext } from "@/lib/audit";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Staff-only approval list (was unauthenticated).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, [
    "owner",
    "practitioner",
    "support",
  ]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "pending" | "approved" | "rejected" | null;
  return NextResponse.json({
    approvals: listApprovals({ status: status ?? undefined, limit: 50 }),
  });
}

export async function POST(req: Request) {
  // Approval decision — owner/practitioner/support only (was unauthenticated;
  // could signJournalEntry + sendBirdSms marketing without login).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, [
    "owner",
    "practitioner",
    "support",
  ]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);
  const session = auth as AuthOk;

  let body: { id?: string; decision?: "approved" | "rejected"; decidedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.id || (body.decision !== "approved" && body.decision !== "rejected")) {
    return NextResponse.json({ error: "id_and_decision_required" }, { status: 400 });
  }

  const actor = body.decidedBy ?? session.accountId ?? "clinic-owner";
  const approval = decideApproval(body.id, body.decision, actor);
  if (!approval) return NextResponse.json({ error: "not_found_or_decided" }, { status: 404 });

  if (body.decision === "approved" && approval.action === "journal.sign_soap") {
    const journalId = String(approval.payload.journalId ?? "");
    if (journalId) {
      try {
        await signJournalEntry(journalId, {
          signedBy: actor,
          soap: (approval.payload.soap as any) ?? undefined,
        });
      } catch {
        // already signed or missing — ignore
      }
    }
  }

  // Side-effect: if marketing SMS was approved and Bird is ready, send it
  if (
    body.decision === "approved" &&
    approval.action === "messages.send_marketing_sms" &&
    isBirdConfigured()
  ) {
    const phone = String(approval.payload.phone ?? "");
    const text = String(approval.payload.text ?? "");
    if (phone && text) {
      const sent = await sendBirdSms({ to: phone, text, category: "marketing" });
      await publishEvent({
        type: "message.sent",
        tenant: approval.tenant,
        data: { approvalId: approval.id, ok: sent.ok, channel: "sms" },
        source: "approvals",
      });
    }
  }

  await publishEvent({
    type: body.decision === "approved" ? "approval.approved" : "approval.rejected",
    tenant: approval.tenant,
    data: { approvalId: approval.id, action: approval.action, runId: approval.runId },
    source: "approvals",
  });

  auditLogWithContext(req, "approval.decided", {
    tenant_id: approval.tenant,
    actor_user_id: session.accountId,
    target_ref: `approval/${approval.id}`,
    auth_mode: session.mode,
    meta: { decision: body.decision, action: approval.action },
  });

  return NextResponse.json({
    ok: true,
    approval,
    run: getRun(approval.runId) ?? null,
  });
}
