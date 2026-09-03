// Mission orchestrator — draft/approve/start/pause/cancel + workstream flow.

import { auditLog } from "@/lib/audit";
import { appendAgentLedger } from "@/lib/agents/ledger";
import {
  appendHumanDecision,
  createMission,
  createWorkstream,
  getMission,
  getWorkstream,
  listWorkstreams,
  updateMission,
  updateWorkstream,
} from "@/lib/prime/mission-store";
import {
  EXECUTION_CONTROL_INVARIANTS,
  type Mission,
  type MissionBudgets,
  type MissionRole,
  type RiskLevel,
  type Workstream,
} from "@/lib/prime/mission-types";
import { detectPathConflict, evaluateMissionPolicy } from "@/lib/prime/mission-policy";
import { assertReadyForReview } from "@/lib/prime/definition-of-done";
import { ensureEvidence } from "@/lib/prime/evidence";
import { DEFAULT_FLOW, roleMay } from "@/lib/prime/roles";
import { raiseMissionBudget } from "@/lib/prime/budget-guard";

function parallelCount(missionId: string): number {
  return listWorkstreams({ missionId }).filter((w) =>
    ["queued", "running", "ready_for_review", "awaiting_human"].includes(w.status),
  ).length;
}

export function draftMission(input: {
  tenantSlug: string;
  title: string;
  goal: string;
  createdBy: string;
  riskLevel?: RiskLevel;
  budgets?: Partial<MissionBudgets>;
}): Mission {
  const mission = createMission(input);
  auditLog("prime.mission_draft", {
    tenant_id: input.tenantSlug,
    actor_user_id: input.createdBy,
    target_ref: `mission/${mission.id}`,
    title: mission.title,
    riskLevel: mission.riskLevel,
  });
  appendAgentLedger({
    tenantSlug: input.tenantSlug,
    agent: "PRIME_COMMANDER",
    workflow: "prime_execution",
    event: "mission_draft",
    payload: { missionId: mission.id, title: mission.title },
  });
  return mission;
}

export function approveMission(input: {
  missionId: string;
  actor: string;
  actorRole: string;
}): Mission | { error: string } {
  if (input.actorRole !== "owner" && input.actorRole !== "support") {
    return { error: "owner_required" };
  }
  const m = getMission(input.missionId);
  if (!m) return { error: "mission_not_found" };
  if (m.status !== "draft") return { error: `invalid_status_${m.status}` };

  updateMission(m.id, {
    status: "approved",
    approvedBy: input.actor,
    approvedAt: new Date().toISOString(),
  });
  appendHumanDecision(m.id, {
    kind: "approve_mission",
    actor: input.actor,
    detail: "Mission approved for start",
  });
  auditLog("prime.mission_approved", {
    tenant_id: m.tenantSlug,
    actor_user_id: input.actor,
    target_ref: `mission/${m.id}`,
  });
  return getMission(m.id)!;
}

export function startMission(input: {
  missionId: string;
  actor: string;
}): Mission | { error: string } {
  const m = getMission(input.missionId);
  if (!m) return { error: "mission_not_found" };
  if (m.status !== "approved" && m.status !== "paused") {
    return { error: `invalid_status_${m.status}` };
  }
  updateMission(m.id, { status: "running" });
  auditLog("prime.mission_started", {
    tenant_id: m.tenantSlug,
    actor_user_id: input.actor,
    target_ref: `mission/${m.id}`,
  });
  return getMission(m.id)!;
}

export function pauseMission(input: {
  missionId: string;
  actor: string;
}): Mission | { error: string } {
  const m = getMission(input.missionId);
  if (!m) return { error: "mission_not_found" };
  if (m.status !== "running") return { error: `invalid_status_${m.status}` };
  updateMission(m.id, { status: "paused" });
  appendHumanDecision(m.id, {
    kind: "pause",
    actor: input.actor,
    detail: "Mission paused",
  });
  return getMission(m.id)!;
}

export function cancelMission(input: {
  missionId: string;
  actor: string;
}): Mission | { error: string } {
  const m = getMission(input.missionId);
  if (!m) return { error: "mission_not_found" };
  if (m.status === "completed" || m.status === "cancelled") {
    return { error: `invalid_status_${m.status}` };
  }
  updateMission(m.id, { status: "cancelled" });
  for (const ws of listWorkstreams({ missionId: m.id })) {
    if (!["done", "cancelled", "approved_for_merge"].includes(ws.status)) {
      updateWorkstream(ws.id, { status: "cancelled" });
    }
  }
  appendHumanDecision(m.id, {
    kind: "cancel",
    actor: input.actor,
    detail: "Mission cancelled",
  });
  return getMission(m.id)!;
}

/**
 * Spawn workstream for a role. Enforces max parallel + path conflicts → blocked.
 */
export function spawnWorkstream(input: {
  missionId: string;
  title: string;
  role: MissionRole;
  allowedPaths?: string[];
  forbiddenPaths?: string[];
  acceptanceCriteria?: { text: string }[];
  proposedFiles?: string[];
}): Workstream | { error: string } {
  const m = getMission(input.missionId);
  if (!m) return { error: "mission_not_found" };
  if (m.status !== "running" && m.status !== "approved") {
    return { error: `mission_not_active_${m.status}` };
  }

  if (parallelCount(m.id) >= EXECUTION_CONTROL_INVARIANTS.MAX_PARALLEL_WORKSTREAMS) {
    return {
      error: `max_parallel_workstreams_${EXECUTION_CONTROL_INVARIANTS.MAX_PARALLEL_WORKSTREAMS}`,
    };
  }

  const ws = createWorkstream({
    missionId: m.id,
    title: input.title,
    role: input.role,
    allowedPaths: input.allowedPaths,
    forbiddenPaths: input.forbiddenPaths,
    acceptanceCriteria: input.acceptanceCriteria,
  });
  if ("error" in ws) return ws;

  ensureEvidence(ws.id);

  if (input.proposedFiles?.length) {
    const conflict = detectPathConflict({
      missionId: m.id,
      workstreamId: ws.id,
      proposedFiles: input.proposedFiles,
    });
    if (!conflict.ok) {
      updateWorkstream(ws.id, {
        status: "blocked",
        blockedReason: conflict.reason,
        changedFiles: input.proposedFiles,
      });
      return getWorkstream(ws.id)!;
    }
    updateWorkstream(ws.id, { changedFiles: input.proposedFiles });
  }

  return getWorkstream(ws.id)!;
}

/** Default flow: scout → builder → verifier + reviewer. */
export function spawnDefaultFlow(input: {
  missionId: string;
  title: string;
  acceptanceCriteria: { text: string }[];
  allowedPaths?: string[];
}): Workstream[] | { error: string } {
  const created: Workstream[] = [];
  for (const role of DEFAULT_FLOW) {
    const ws = spawnWorkstream({
      missionId: input.missionId,
      title: `${input.title} · ${role}`,
      role,
      acceptanceCriteria: role === "builder" ? input.acceptanceCriteria : input.acceptanceCriteria,
      allowedPaths: input.allowedPaths,
    });
    if ("error" in ws) {
      if (created.length === 0) return ws;
      break;
    }
    created.push(ws);
  }
  return created;
}

export function claimWorkstreamFiles(input: {
  workstreamId: string;
  files: string[];
}): Workstream | { error: string } {
  const ws = getWorkstream(input.workstreamId);
  if (!ws) return { error: "workstream_not_found" };

  if (!roleMay(ws.role, "write_path") && ws.role !== "scout") {
    // scout may propose but builder claims writes
    if (ws.role !== "verifier" && ws.role !== "builder") {
      return { error: "role_cannot_write_path" };
    }
  }

  for (const f of input.files) {
    const policy = evaluateMissionPolicy({
      missionId: ws.missionId,
      workstreamId: ws.id,
      action: "write_path",
      paths: [f],
    });
    if (!policy.ok) {
      updateWorkstream(ws.id, {
        status: "blocked",
        blockedReason: policy.reason,
      });
      return getWorkstream(ws.id)!;
    }
  }

  const conflict = detectPathConflict({
    missionId: ws.missionId,
    workstreamId: ws.id,
    proposedFiles: input.files,
  });
  if (!conflict.ok) {
    updateWorkstream(ws.id, {
      status: "blocked",
      blockedReason: conflict.reason,
    });
    return getWorkstream(ws.id)!;
  }

  updateWorkstream(ws.id, {
    status: ws.status === "queued" ? "running" : ws.status,
    changedFiles: [...new Set([...ws.changedFiles, ...input.files])],
    blockedReason: undefined,
  });
  return getWorkstream(ws.id)!;
}

export function markReadyForReview(workstreamId: string): Workstream | { error: string; reasons?: string[] } {
  const ws = getWorkstream(workstreamId);
  if (!ws) return { error: "workstream_not_found" };
  const dod = assertReadyForReview(ws);
  if (!dod.ok) {
    return { error: dod.code, reasons: dod.reasons };
  }
  updateWorkstream(ws.id, { status: "ready_for_review" });
  return getWorkstream(ws.id)!;
}

/**
 * Owner/release_steward marks approved_for_merge — does NOT merge (NO_AUTO_MERGE).
 */
export function markApprovedForMerge(input: {
  workstreamId: string;
  actor: string;
  actorRole: string;
}): Workstream | { error: string } {
  const ws = getWorkstream(input.workstreamId);
  if (!ws) return { error: "workstream_not_found" };
  if (input.actorRole !== "owner" && input.actorRole !== "support") {
    return { error: "owner_required" };
  }
  if (ws.status !== "ready_for_review") {
    return { error: `invalid_status_${ws.status}` };
  }

  const policy = evaluateMissionPolicy({
    missionId: ws.missionId,
    workstreamId: ws.id,
    action: "mark_approved_for_merge",
    humanApproved: true,
    approvedBy: input.actor,
  });
  if (!policy.ok) return { error: policy.code };

  // Explicitly refuse to perform merge
  const mergeAttempt = evaluateMissionPolicy({
    missionId: ws.missionId,
    workstreamId: ws.id,
    action: "merge",
    humanApproved: false,
  });
  if (mergeAttempt.ok) {
    return { error: "invariant_broken_merge_would_auto" };
  }

  updateWorkstream(ws.id, { status: "approved_for_merge" });
  appendHumanDecision(ws.missionId, {
    kind: "mark_approved_for_merge",
    actor: input.actor,
    detail: `Workstream ${ws.id} approved_for_merge — manual PR merge only`,
    meta: { workstreamId: ws.id, branchName: ws.branchName },
  });
  auditLog("prime.approved_for_merge", {
    tenant_id: ws.tenantSlug,
    actor_user_id: input.actor,
    target_ref: `workstream/${ws.id}`,
    note: "NO_AUTO_MERGE — human must open/merge PR",
  });
  return getWorkstream(ws.id)!;
}

export function ownerRaiseBudget(input: {
  missionId: string;
  actor: string;
  actorRole: string;
  patch: Partial<MissionBudgets>;
}): Mission | { error: string } {
  const result = raiseMissionBudget({
    missionId: input.missionId,
    actor: input.actor,
    actorRole: input.actorRole,
    patch: input.patch,
  });
  if (!result.ok) return { error: result.code ?? "budget_raise_failed" };
  appendHumanDecision(input.missionId, {
    kind: "raise_budget",
    actor: input.actor,
    detail: `Budget raised: ${JSON.stringify(input.patch)}`,
    meta: input.patch,
  });
  return result.mission!;
}
