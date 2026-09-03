// MissionPolicyGuard — block / require human for high-risk actions.

import { CLINICAL_POLICY } from "@/lib/swarm/clinical-policy";
import { SWARM_INVARIANTS } from "@/lib/swarm/types";
import { PRIME_INVARIANTS } from "@/lib/prime/types";
import {
  getMission,
  getWorkstream,
  listWorkstreams,
} from "@/lib/prime/mission-store";
import type {
  PolicyActionKind,
  PolicyVerdict,
  RiskLevel,
  Workstream,
} from "@/lib/prime/mission-types";
import { EXECUTION_CONTROL_INVARIANTS } from "@/lib/prime/mission-types";

const RISK_RANK: Record<RiskLevel, number> = { green: 0, yellow: 1, red: 2 };

function needsRisk(missionRisk: RiskLevel, floor: RiskLevel): boolean {
  return RISK_RANK[missionRisk] >= RISK_RANK[floor];
}

const CLINICAL_PATH_RE =
  /(clinical-policy|pathology|mdr|patient|soap|journal|diagnos|triage|treatment)/i;

const FORBIDDEN_CONTENT_RE =
  /\b(auto[-_]?merge|auto[-_]?deploy|lora|fine[-_]?tun|ppo[-_]?train|patient[-_]?facing\s+clinical|autonomous\s+diagnos)/i;

export function assertExecutionInvariants(): PolicyVerdict {
  if (SWARM_INVARIANTS.NO_AUTO_MERGE !== true) {
    return {
      ok: false,
      code: "invariant_broken",
      reason: "NO_AUTO_MERGE must remain true",
      requiresHuman: true,
    };
  }
  if (SWARM_INVARIANTS.NO_AUTO_DEPLOY !== true) {
    return {
      ok: false,
      code: "invariant_broken",
      reason: "NO_AUTO_DEPLOY must remain true",
      requiresHuman: true,
    };
  }
  if (CLINICAL_POLICY.clinical_status !== "suggestion_only") {
    return {
      ok: false,
      code: "invariant_broken",
      reason: "clinical_status must be suggestion_only",
      requiresHuman: true,
    };
  }
  if (CLINICAL_POLICY.NO_AUTO_JOURNAL_SIGN !== true) {
    return {
      ok: false,
      code: "invariant_broken",
      reason: "NO_AUTO_JOURNAL_SIGN must remain true",
      requiresHuman: true,
    };
  }
  if (PRIME_INVARIANTS.NO_MODEL_TRAINING !== true) {
    return {
      ok: false,
      code: "invariant_broken",
      reason: "NO_MODEL_TRAINING must remain true",
      requiresHuman: true,
    };
  }
  if (PRIME_INVARIANTS.PATHOLOGY_SHADOW_UNTIL_GATES !== true) {
    return {
      ok: false,
      code: "invariant_broken",
      reason: "PATHOLOGY_SHADOW_UNTIL_GATES must remain true",
      requiresHuman: true,
    };
  }
  return { ok: true };
}

function pathAllowed(
  filePath: string,
  allowed: string[],
  forbidden: string[],
): PolicyVerdict {
  const norm = filePath.replace(/\\/g, "/");
  for (const f of forbidden) {
    if (norm.includes(f) || norm.startsWith(f) || norm.endsWith(f)) {
      return {
        ok: false,
        code: "path_forbidden",
        reason: `write to forbidden path «${norm}»`,
        requiresHuman: true,
        riskFloor: "red",
      };
    }
  }
  if (allowed.length === 0) return { ok: true };
  const ok = allowed.some(
    (a) => norm === a || norm.startsWith(a) || norm.includes(`/${a}`),
  );
  if (!ok) {
    return {
      ok: false,
      code: "path_outside_allowed",
      reason: `write outside allowedPaths «${norm}»`,
      requiresHuman: true,
      riskFloor: "yellow",
    };
  }
  return { ok: true };
}

/**
 * Evaluate a proposed action against mission risk + path + clinical locks.
 * Human approval is required (never auto-executed) for blocked actions.
 */
export function evaluateMissionPolicy(input: {
  missionId: string;
  workstreamId?: string;
  action: PolicyActionKind;
  paths?: string[];
  contentHint?: string;
  humanApproved?: boolean;
  approvedBy?: string;
}): PolicyVerdict {
  const inv = assertExecutionInvariants();
  if (!inv.ok) return inv;

  const mission = getMission(input.missionId);
  if (!mission) {
    return {
      ok: false,
      code: "mission_not_found",
      reason: "mission_not_found",
      requiresHuman: true,
    };
  }

  const ws = input.workstreamId ? getWorkstream(input.workstreamId) : undefined;

  if (input.contentHint && FORBIDDEN_CONTENT_RE.test(input.contentHint)) {
    return {
      ok: false,
      code: "forbidden_content",
      reason: "content claims auto-merge/deploy/training/patient clinical autonomy",
      requiresHuman: true,
      riskFloor: "red",
    };
  }

  switch (input.action) {
    case "write_main":
    case "merge":
      if (EXECUTION_CONTROL_INVARIANTS.NO_AUTO_MERGE !== true) {
        return {
          ok: false,
          code: "invariant_broken",
          reason: "NO_AUTO_MERGE",
          requiresHuman: true,
        };
      }
      if (!input.humanApproved) {
        return {
          ok: false,
          code: "human_required_merge",
          reason: "merge/main write requires human approval (manual merge only)",
          requiresHuman: true,
          riskFloor: "red",
        };
      }
      return { ok: true };

    case "deploy":
      if (!input.humanApproved) {
        return {
          ok: false,
          code: "human_required_deploy",
          reason: "deploy requires human approval (NO_AUTO_DEPLOY)",
          requiresHuman: true,
          riskFloor: "red",
        };
      }
      return { ok: true };

    case "prod_env_secrets":
      return {
        ok: false,
        code: "secrets_blocked",
        reason: "prod env/secrets writes are blocked for agents",
        requiresHuman: true,
        riskFloor: "red",
      };

    case "clinical_policy":
    case "mdr_claim":
    case "pathology_claim":
    case "patient_claim":
      return {
        ok: false,
        code: "clinical_self_approve_forbidden",
        reason: `${input.action} never self-approves — suggestion_only + human gate`,
        requiresHuman: true,
        riskFloor: "red",
      };

    case "migration":
      if (!needsRisk(mission.riskLevel, "yellow") || !input.humanApproved) {
        return {
          ok: false,
          code: "migration_requires_approval",
          reason: "migrations require yellow/red mission + human approval",
          requiresHuman: true,
          riskFloor: "yellow",
        };
      }
      return { ok: true };

    case "write_path": {
      if (!ws) {
        return {
          ok: false,
          code: "workstream_required",
          reason: "write_path requires workstream",
          requiresHuman: true,
        };
      }
      for (const p of input.paths ?? []) {
        if (CLINICAL_PATH_RE.test(p) && !input.humanApproved) {
          return {
            ok: false,
            code: "clinical_path_human_required",
            reason: `clinical-adjacent path «${p}» requires human approval`,
            requiresHuman: true,
            riskFloor: "red",
          };
        }
        const v = pathAllowed(p, ws.allowedPaths, ws.forbiddenPaths);
        if (!v.ok) return v;
      }
      return { ok: true };
    }

    case "sms_patient":
      if (!input.humanApproved) {
        return {
          ok: false,
          code: "sms_patient_human_required",
          reason: "SMS/patient workflows require human approval",
          requiresHuman: true,
          riskFloor: "yellow",
        };
      }
      return { ok: true };

    case "journal_sign":
      return {
        ok: false,
        code: "no_auto_journal_sign",
        reason: "NO_AUTO_JOURNAL_SIGN — agents cannot sign journals",
        requiresHuman: true,
        riskFloor: "red",
      };

    case "raise_budget":
      return {
        ok: false,
        code: "agents_cannot_raise_budgets",
        reason: "only owner/support may raise budgets via BudgetGuard",
        requiresHuman: true,
        riskFloor: "yellow",
      };

    case "mark_approved_for_merge":
      if (!input.humanApproved || !input.approvedBy) {
        return {
          ok: false,
          code: "human_required_merge_mark",
          reason: "approved_for_merge is owner-only; merge remains manual",
          requiresHuman: true,
          riskFloor: "yellow",
        };
      }
      return { ok: true };

    default: {
      const _exhaustive: never = input.action;
      return {
        ok: false,
        code: "unknown_action",
        reason: `unknown action ${_exhaustive}`,
        requiresHuman: true,
      };
    }
  }
}

function listActiveWorkstreams(missionId: string): Workstream[] {
  return listWorkstreams({ missionId }).filter((w) =>
    [
      "queued",
      "running",
      "ready_for_review",
      "awaiting_human",
      "awaiting_verification",
      "blocked",
    ].includes(w.status),
  );
}

/** Detect overlapping file claims between active workstreams → blocked, not overwrite. */
export function detectPathConflict(input: {
  missionId: string;
  workstreamId: string;
  proposedFiles: string[];
}): PolicyVerdict & { conflictingWorkstreamId?: string; files?: string[] } {
  const others = listActiveWorkstreams(input.missionId).filter(
    (w) => w.id !== input.workstreamId,
  );
  const proposed = new Set(input.proposedFiles.map((f) => f.replace(/\\/g, "/")));
  for (const other of others) {
    const overlap = other.changedFiles.filter((f) =>
      proposed.has(f.replace(/\\/g, "/")),
    );
    if (overlap.length) {
      return {
        ok: false,
        code: "path_conflict",
        reason: `path conflict with workstream ${other.id}`,
        requiresHuman: true,
        riskFloor: "yellow",
        conflictingWorkstreamId: other.id,
        files: overlap,
      };
    }
  }
  return { ok: true };
}
