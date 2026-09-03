import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
import { auditLog } from "@/lib/audit";
import {
  EXECUTION_CONTROL_INVARIANTS,
  appendEvidence,
  approveMission,
  cancelMission,
  draftMission,
  getEvidenceForWorkstream,
  getMission,
  listMissions,
  listWorkstreams,
  markApprovedForMerge,
  markReadyForReview,
  missionBudgetSnapshot,
  ownerRaiseBudget,
  pauseMission,
  spawnDefaultFlow,
  spawnWorkstream,
  startMission,
} from "@/lib/prime";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

async function requireSession(
  req: NextRequest,
  tenant: string,
): Promise<
  | { ok: true; accountId: string; role: string }
  | { ok: false; response: NextResponse }
> {
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || (session.tenant !== tenant && session.role !== "support")) {
    return { ok: false, response: unauthorized() };
  }
  return { ok: true, accountId: session.accountId, role: session.role };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const auth = await requireSession(req, tenant);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "list";
  const missionId = url.searchParams.get("missionId") ?? undefined;
  const workstreamId = url.searchParams.get("workstreamId") ?? undefined;

  if (view === "invariants") {
    return NextResponse.json({ invariants: EXECUTION_CONTROL_INVARIANTS });
  }

  if (view === "budget" && missionId) {
    const snap = missionBudgetSnapshot(missionId);
    if (!snap) return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    return NextResponse.json(snap);
  }

  if (view === "workstreams") {
    return NextResponse.json({
      data: listWorkstreams({
        tenantSlug: tenant,
        missionId,
        limit: 80,
      }),
    });
  }

  if (view === "evidence" && workstreamId) {
    return NextResponse.json({
      data: getEvidenceForWorkstream(workstreamId) ?? null,
    });
  }

  if (view === "mission" && missionId) {
    const m = getMission(missionId);
    if (!m || m.tenantSlug !== tenant) {
      return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    }
    return NextResponse.json({
      mission: m,
      workstreams: listWorkstreams({ missionId }),
      budget: missionBudgetSnapshot(missionId),
    });
  }

  return NextResponse.json({
    data: listMissions({ tenantSlug: tenant, limit: 40 }),
    invariants: EXECUTION_CONTROL_INVARIANTS,
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const auth = await requireSession(req, tenant);
  if (!auth.ok) return auth.response;

  let body: {
    action?: string;
    title?: string;
    goal?: string;
    missionId?: string;
    workstreamId?: string;
    riskLevel?: "green" | "yellow" | "red";
    budgets?: Record<string, number>;
    budgetPatch?: Record<string, number>;
    role?:
      | "scout"
      | "builder"
      | "verifier"
      | "reviewer"
      | "release_steward"
      | "prime_commander";
    acceptanceCriteria?: { text: string }[];
    allowedPaths?: string[];
    proposedFiles?: string[];
    evidence?: {
      commits?: string[];
      files?: string[];
      commands?: { command: string; exitCode: number; at?: string; summary?: string }[];
      checks?: { kind: string; status: string }[];
      acceptance?: { criterionId: string; status: string }[];
      limitations?: string[];
      rollback?: string;
      humanDecisions?: string[];
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action ?? "draft";
  const mutatingOwnerActions = new Set([
    "draft",
    "approve",
    "start",
    "pause",
    "cancel",
    "raise_budget",
    "spawn",
    "spawn_flow",
    "mark_ready",
    "mark_approved_for_merge",
    "append_evidence",
  ]);

  if (mutatingOwnerActions.has(action)) {
    if (auth.role !== "owner" && auth.role !== "support") {
      auditLog("prime.mission_forbidden", {
        tenant_id: tenant,
        actor_user_id: auth.accountId,
        action,
      });
      return forbidden();
    }
  }

  switch (action) {
    case "draft": {
      if (!body.title || !body.goal) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      const mission = draftMission({
        tenantSlug: tenant,
        title: body.title,
        goal: body.goal,
        createdBy: auth.accountId,
        riskLevel: body.riskLevel,
        budgets: body.budgets as any,
      });
      return NextResponse.json({ mission }, { status: 201 });
    }
    case "approve": {
      if (!body.missionId) {
        return NextResponse.json({ error: "missing_missionId" }, { status: 400 });
      }
      const result = approveMission({
        missionId: body.missionId,
        actor: auth.accountId,
        actorRole: auth.role,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ mission: result });
    }
    case "start": {
      if (!body.missionId) {
        return NextResponse.json({ error: "missing_missionId" }, { status: 400 });
      }
      const result = startMission({
        missionId: body.missionId,
        actor: auth.accountId,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ mission: result });
    }
    case "pause": {
      if (!body.missionId) {
        return NextResponse.json({ error: "missing_missionId" }, { status: 400 });
      }
      const result = pauseMission({
        missionId: body.missionId,
        actor: auth.accountId,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ mission: result });
    }
    case "cancel": {
      if (!body.missionId) {
        return NextResponse.json({ error: "missing_missionId" }, { status: 400 });
      }
      const result = cancelMission({
        missionId: body.missionId,
        actor: auth.accountId,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ mission: result });
    }
    case "raise_budget": {
      if (!body.missionId || !body.budgetPatch) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      const result = ownerRaiseBudget({
        missionId: body.missionId,
        actor: auth.accountId,
        actorRole: auth.role,
        patch: body.budgetPatch as any,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 403 });
      }
      return NextResponse.json({ mission: result });
    }
    case "spawn": {
      if (!body.missionId || !body.title || !body.role) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      const result = spawnWorkstream({
        missionId: body.missionId,
        title: body.title,
        role: body.role,
        acceptanceCriteria: body.acceptanceCriteria,
        allowedPaths: body.allowedPaths,
        proposedFiles: body.proposedFiles,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ workstream: result }, { status: 201 });
    }
    case "spawn_flow": {
      if (!body.missionId || !body.title) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      const result = spawnDefaultFlow({
        missionId: body.missionId,
        title: body.title,
        acceptanceCriteria: body.acceptanceCriteria ?? [
          { text: "Acceptance criteria defined by owner" },
        ],
        allowedPaths: body.allowedPaths,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ workstreams: result }, { status: 201 });
    }
    case "append_evidence": {
      if (!body.workstreamId || !body.evidence) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      const result = appendEvidence({
        workstreamId: body.workstreamId,
        commits: body.evidence.commits,
        files: body.evidence.files,
        commands: (body.evidence.commands ?? []).map((c) => ({
          command: c.command,
          exitCode: c.exitCode,
          at: c.at ?? new Date().toISOString(),
          summary: c.summary,
        })),
        checks: body.evidence.checks as any,
        acceptance: body.evidence.acceptance as any,
        limitations: body.evidence.limitations,
        rollback: body.evidence.rollback,
        humanDecisions: body.evidence.humanDecisions,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ evidence: result });
    }
    case "mark_ready": {
      if (!body.workstreamId) {
        return NextResponse.json({ error: "missing_workstreamId" }, { status: 400 });
      }
      const result = markReadyForReview(body.workstreamId);
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({ workstream: result });
    }
    case "mark_approved_for_merge": {
      if (!body.workstreamId) {
        return NextResponse.json({ error: "missing_workstreamId" }, { status: 400 });
      }
      const result = markApprovedForMerge({
        workstreamId: body.workstreamId,
        actor: auth.accountId,
        actorRole: auth.role,
      });
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({
        workstream: result,
        note: "NO_AUTO_MERGE — open PR and merge manually",
      });
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
}
