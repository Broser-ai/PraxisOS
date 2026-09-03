// DefinitionOfDoneValidator — workstream cannot become ready_for_review on empty shells.

import {
  getEvidenceForWorkstream,
  getWorkstream,
} from "@/lib/prime/mission-store";
import type { Workstream, WorkstreamEvidence } from "@/lib/prime/mission-types";
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

  // UI actions verified or disabled — require an explicit check note in limitations or human decision
  const uiFiles = files.filter((f) => /\.(tsx)$/.test(f) && !/page\.tsx$/.test(f) === false);
  if (uiFiles.some((f) => f.includes("components/") || f.includes("admin/"))) {
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
