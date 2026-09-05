// DefinitionOfDoneValidator — workstream cannot become ready_for_review on empty shells.
// Fan-in join lives here so dispatcher stays lease/fan-out focused.

import {
  appendHumanDecision,
  getEvidenceForWorkstream,
  getMission,
  getWorkstream,
  listWorkstreams,
  updateMission,
} from "@/lib/prime/mission-store";
import {
  EXECUTION_CONTROL_INVARIANTS,
  type Mission,
  type Workstream,
  type WorkstreamEvidence,
} from "@/lib/prime/mission-types";
import { evaluateMissionPolicy } from "@/lib/prime/mission-policy";

export type DodVerdict =
  | { ok: true; evidenceId: string }
  | { ok: false; code: string; reasons: string[] };

const FAKE_SUCCESS_RE =
  /\b(TODO|FIXME|pass\s*with\s*no\s*tests|fake\s*success|not\s*implemented|throw new Error\(['\"]not implemented)/i;

const UI_API_RUNTIME_RE =
  /^(app\/|components\/|lib\/agents\/|lib\/swarm\/|lib\/prime\/|middleware\.ts|next\.config)/;

function checkStatus(
  evidence: WorkstreamEvidence,
  kind: WorkstreamEvidence["checks"][number]["kind"],
): string | undefined {
  const c = evidence.checks.find((x) => x.kind === kind);
  if (!c) return `${kind}_missing`;
  if (c.status === "pass" || c.status === "not_required" || c.status === "not_applicable") {
    return undefined;
  }
  if (c.status === "not_run" || c.status === "not_verified") return `${kind}_${c.status}`;
  return `${kind}_failed`;
}

/**
 * Static + evidence checks (not grep-only). Clinical changes never self-approve.
 */
export function validateDefinitionOfDone(workstreamId: string): DodVerdict {
  const ws = getWorkstream(workstreamId);
  if (!ws) return { ok: false, code: "workstream_not_found", reasons: ["workstream_not_found"] };

  const reasons: string[] = [];
  const evidence = getEvidenceForWorkstream(workstreamId);

  if (!evidence) {
    return {
      ok: false,
      code: "evidence_required",
      reasons: ["cannot_mark_ready_without_evidence"],
    };
  }

  // Empty shell: no changed files in scope
  if (!ws.changedFiles.length && !evidence.files.length) {
    reasons.push("empty_shell_no_changed_files");
  }

  const inScope = (ws.changedFiles.length ? ws.changedFiles : evidence.files).filter(
    (f) => {
      const v = evaluateMissionPolicy({
        missionId: ws.missionId,
        workstreamId: ws.id,
        action: "write_path",
        paths: [f],
      });
      return v.ok;
    },
  );
  if (ws.changedFiles.length && inScope.length === 0) {
    reasons.push("changed_files_outside_allowed_paths");
  }

  // ≥1 acceptance criterion with evidence pass
  if (ws.acceptanceCriteria.length === 0) {
    reasons.push("acceptance_criteria_missing");
  } else {
    const passed = ws.acceptanceCriteria.filter(
      (c) =>
        c.status === "pass" &&
        (c.evidenceIds?.length ||
          evidence.acceptance.some((a) => a.criterionId === c.id && a.status === "pass")),
    );
    if (passed.length < 1) {
      reasons.push("acceptance_needs_pass_with_evidence");
    }
  }

  const testsFail = checkStatus(evidence, "tests");
  const tscFail = checkStatus(evidence, "typecheck");
  if (testsFail) reasons.push(testsFail);
  if (tscFail) reasons.push(tscFail);

  const touchesRuntime = (ws.changedFiles.length ? ws.changedFiles : evidence.files).some(
    (f) => UI_API_RUNTIME_RE.test(f.replace(/\\/g, "/")),
  );
  if (touchesRuntime) {
    const buildFail = checkStatus(evidence, "build");
    if (buildFail) reasons.push(buildFail);
  }

  // Schema-only ≠ done
  const files = ws.changedFiles.length ? ws.changedFiles : evidence.files;
  const onlySchema =
    files.length > 0 &&
    files.every((f) => /\.(sql)$|migrations\//i.test(f)) &&
    !files.some((f) => /\.(ts|tsx|js|mjs)$/i.test(f));
  if (onlySchema) {
    reasons.push("schema_only_not_done");
  }

  // Unapproved TODO/FIXME / fake success in limitations or rollback notes
  const blob = [
    ...evidence.limitations,
    evidence.rollback,
    ...ws.acceptanceCriteria.map((c) => c.text),
  ].join("\n");
  if (FAKE_SUCCESS_RE.test(blob)) {
    reasons.push("unapproved_todo_fixme_or_fake_success");
  }

  // New routes need domain logic signal (evidence command or non-empty files under app/api|app/( )
  const newRoutes = files.filter((f) => /app\/.*\/route\.ts$|app\/.*\/page\.tsx$/.test(f));
  if (newRoutes.length) {
    const hasDomain =
      files.some((f) => f.startsWith("lib/")) ||
      evidence.commands.some((c) => c.exitCode === 0 && /test|typecheck|build/.test(c.command));
    if (!hasDomain) reasons.push("new_routes_need_domain_logic");
  }

  // UI actions verified or disabled — require explicit note when admin/components touched
  const uiFiles = files.filter(
    (f) =>
      /\.(tsx)$/.test(f) &&
      (f.includes("components/") || f.includes("/admin/")),
  );
  if (uiFiles.length) {
    const verified =
      evidence.humanDecisions.some((d) => /ui.*(verified|disabled)/i.test(d)) ||
      evidence.limitations.some((l) => /ui.*(verified|disabled)/i.test(l)) ||
      evidence.commands.some((c) => /playwright|cypress|ui.?test/i.test(c.command));
    if (!verified) {
      reasons.push("ui_actions_not_verified_or_disabled");
    }
  }

  // Clinical never self-approves
  const clinicalTouch = files.some((f) =>
    /(clinical|pathology|journal|soap|mdr)/i.test(f),
  );
  if (clinicalTouch) {
    const clinicalCheck = evidence.checks.find((c) => c.kind === "clinical");
    if (!clinicalCheck || clinicalCheck.status === "pass") {
      // "pass" without human decision is self-approve — require human decision + not_verified or not_applicable with human note
      const humanClinical = evidence.humanDecisions.some((d) =>
        /clinical|suggestion_only|human/i.test(d),
      );
      if (!humanClinical) {
        reasons.push("clinical_changes_never_self_approve");
      }
    }
  }

  if (!evidence.rollback.trim()) {
    reasons.push("rollback_plan_required");
  }

  if (reasons.length) {
    return { ok: false, code: "dod_failed", reasons };
  }
  return { ok: true, evidenceId: evidence.id };
}

/** Attempt transition to ready_for_review — fails closed without DoD. */
export function assertReadyForReview(ws: Workstream): DodVerdict {
  return validateDefinitionOfDone(ws.id);
}

// ---------------------------------------------------------------------------
// Mission fan-in (join) — memory/JSON mission domain only; never merge/deploy.
// Persistence is the same in-memory + optional PRAXIS_DATA_DIR JSON mirror as
// mission-store — NOT Postgres-durable.
// ---------------------------------------------------------------------------

const FANIN_OK_STATUSES = new Set([
  "done",
  "ready_for_review",
  "approved_for_merge",
]);

export type MissionFanInVerdict =
  | {
      ok: true;
      code: "ready_for_review";
      missionId: string;
      /** Explicit: fan-in ready ≠ completed merge/deploy */
      completedMeansMerge: false;
      completedMeansDeploy: false;
      NO_AUTO_MERGE: true;
      NO_AUTO_DEPLOY: true;
    }
  | {
      ok: false;
      code:
        | "mission_not_found"
        | "mission_not_running"
        | "workstreams_incomplete"
        | "mission_blocked_failed"
        | "mission_blocked_blocked"
        | "verifier_required"
        | "reviewer_required";
      missionId: string;
      reasons: string[];
      blockingWorkstreamIds?: string[];
    };

/**
 * Fan-in gate: mission is ready_for_review only when every workstream is in an
 * OK terminal, at least one verifier + reviewer finished, and nothing is
 * failed/blocked. Never equates ready/completed with merge or deploy.
 */
export function evaluateMissionFanIn(missionId: string): MissionFanInVerdict {
  const mission = getMission(missionId);
  if (!mission) {
    return {
      ok: false,
      code: "mission_not_found",
      missionId,
      reasons: ["mission_not_found"],
    };
  }
  if (mission.status !== "running" && mission.status !== "paused") {
    return {
      ok: false,
      code: "mission_not_running",
      missionId,
      reasons: [`invalid_status_${mission.status}`],
    };
  }

  const streams = listWorkstreams({ missionId });
  if (streams.length === 0) {
    return {
      ok: false,
      code: "workstreams_incomplete",
      missionId,
      reasons: ["no_workstreams"],
    };
  }

  const failed = streams.filter((w) => w.status === "failed");
  if (failed.length) {
    return {
      ok: false,
      code: "mission_blocked_failed",
      missionId,
      reasons: failed.map((w) => `failed:${w.id}`),
      blockingWorkstreamIds: failed.map((w) => w.id),
    };
  }

  const blocked = streams.filter((w) => w.status === "blocked");
  if (blocked.length) {
    return {
      ok: false,
      code: "mission_blocked_blocked",
      missionId,
      reasons: blocked.map((w) => `blocked:${w.id}:${w.blockedReason ?? ""}`),
      blockingWorkstreamIds: blocked.map((w) => w.id),
    };
  }

  const incomplete = streams.filter(
    (w) => w.status !== "cancelled" && !FANIN_OK_STATUSES.has(w.status),
  );
  if (incomplete.length) {
    return {
      ok: false,
      code: "workstreams_incomplete",
      missionId,
      reasons: incomplete.map((w) => `${w.id}:${w.status}`),
      blockingWorkstreamIds: incomplete.map((w) => w.id),
    };
  }

  const verifiers = streams.filter((w) => w.role === "verifier");
  if (
    verifiers.length === 0 ||
    !verifiers.some((w) => FANIN_OK_STATUSES.has(w.status))
  ) {
    return {
      ok: false,
      code: "verifier_required",
      missionId,
      reasons: ["verifier_not_ready"],
    };
  }

  const reviewers = streams.filter((w) => w.role === "reviewer");
  if (
    reviewers.length === 0 ||
    !reviewers.some((w) => FANIN_OK_STATUSES.has(w.status))
  ) {
    return {
      ok: false,
      code: "reviewer_required",
      missionId,
      reasons: ["reviewer_not_ready"],
    };
  }

  // Hard locks — fan-in never authorizes merge/deploy
  if (
    EXECUTION_CONTROL_INVARIANTS.NO_AUTO_MERGE !== true ||
    EXECUTION_CONTROL_INVARIANTS.NO_AUTO_DEPLOY !== true
  ) {
    return {
      ok: false,
      code: "workstreams_incomplete",
      missionId,
      reasons: ["invariant_lock_broken"],
    };
  }

  return {
    ok: true,
    code: "ready_for_review",
    missionId,
    completedMeansMerge: false,
    completedMeansDeploy: false,
    NO_AUTO_MERGE: true,
    NO_AUTO_DEPLOY: true,
  };
}

/**
 * Apply fan-in: on success record human-facing ready_for_review intent only.
 * Does NOT set mission.status=completed (completed ≠ merge/deploy).
 * Failed/blocked workstreams pause the mission.
 */
export function applyMissionFanIn(missionId: string): MissionFanInVerdict {
  const verdict = evaluateMissionFanIn(missionId);
  const mission = getMission(missionId);
  if (!mission) return verdict;

  if (!verdict.ok) {
    if (
      verdict.code === "mission_blocked_failed" ||
      verdict.code === "mission_blocked_blocked"
    ) {
      if (mission.status === "running") {
        updateMission(missionId, { status: "paused" });
        appendHumanDecision(missionId, {
          kind: "pause",
          actor: "fan_in",
          detail: `Fan-in blocked: ${verdict.code} — ${verdict.reasons.join("; ")}`,
          meta: {
            fanInCode: verdict.code,
            blockingWorkstreamIds: verdict.blockingWorkstreamIds,
          },
        });
      }
    }
    return verdict;
  }

  appendHumanDecision(missionId, {
    kind: "approve_action",
    actor: "fan_in",
    detail:
      "Mission fan-in ready_for_review — NO_AUTO_MERGE / NO_AUTO_DEPLOY; human merge/deploy only",
    meta: {
      fanInCode: "ready_for_review",
      completedMeansMerge: false,
      completedMeansDeploy: false,
    },
  });
  // Keep mission running (or paused) — never auto-complete as merge/deploy.
  return verdict;
}

/** True when mission.completed must not be treated as merge/deploy. */
export function missionCompletedIsNotMergeDeploy(_mission?: Mission): boolean {
  return (
    EXECUTION_CONTROL_INVARIANTS.NO_AUTO_MERGE === true &&
    EXECUTION_CONTROL_INVARIANTS.NO_AUTO_DEPLOY === true &&
    EXECUTION_CONTROL_INVARIANTS.MANUAL_MERGE_ONLY === true
  );
}
