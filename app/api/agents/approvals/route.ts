import { NextResponse } from "next/server";
import { decideApproval, listApprovals, getRun } from "@/lib/agent-store";
import { publishEvent } from "@/lib/event-bus";
import { sendBirdSms, isBirdConfigured } from "@/lib/bird";
import { signJournalEntry } from "@/lib/journal";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "pending" | "approved" | "rejected" | null;
  return NextResponse.json({
    approvals: listApprovals({ status: status ?? undefined, limit: 50 }),
  });
}

export async function POST(req: Request) {
  let body: { id?: string; decision?: "approved" | "rejected"; decidedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.id || (body.decision !== "approved" && body.decision !== "rejected")) {
    return NextResponse.json({ error: "id_and_decision_required" }, { status: 400 });
  }

  const approval = decideApproval(body.id, body.decision, body.decidedBy ?? "clinic-owner");
  if (!approval) return NextResponse.json({ error: "not_found_or_decided" }, { status: 404 });

  if (body.decision === "approved" && approval.action === "journal.sign_soap") {
    const journalId = String(approval.payload.journalId ?? "");
    if (journalId) {
      try {
        await signJournalEntry(journalId, {
          signedBy: body.decidedBy ?? "clinic-owner",
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

  return NextResponse.json({
    ok: true,
    approval,
    run: getRun(approval.runId) ?? null,
  });
}
