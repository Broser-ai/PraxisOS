// Evidence ledger — completion evidence per workstream; required before done.

import { randomBytes } from "node:crypto";
import { auditLog } from "@/lib/audit";
import {
  getEvidence,
  getEvidenceForWorkstream,
  getWorkstream,
  saveEvidence,
  updateWorkstream,
} from "@/lib/prime/mission-store";
import type {
  EvidenceCheck,
  EvidenceCommand,
  WorkstreamEvidence,
} from "@/lib/prime/mission-types";
import { validateDefinitionOfDone } from "@/lib/prime/definition-of-done";

function nid(): string {
  return `ev_${randomBytes(5).toString("hex")}`;
}

export function ensureEvidence(workstreamId: string): WorkstreamEvidence | { error: string } {
  const ws = getWorkstream(workstreamId);
  if (!ws) return { error: "workstream_not_found" };
  const existing = getEvidenceForWorkstream(workstreamId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const ev: WorkstreamEvidence = {
    id: nid(),
    workstreamId: ws.id,
    missionId: ws.missionId,
    commits: [],
    files: [],
    commands: [],
    checks: [
      { kind: "tests", status: "not_run" },
      { kind: "typecheck", status: "not_run" },
      { kind: "lint", status: "not_run" },
      { kind: "build", status: "not_required" },
      { kind: "security", status: "not_verified" },
      { kind: "tenant", status: "not_verified" },
      { kind: "clinical", status: "not_applicable" },
    ],
    acceptance: ws.acceptanceCriteria.map((c) => ({
      criterionId: c.id,
      status: c.status,
    })),
    limitations: [],
    rollback: "",
    humanDecisions: [],
    createdAt: now,
    updatedAt: now,
  };
  saveEvidence(ev);
  updateWorkstream(ws.id, { evidenceId: ev.id });
  return ev;
}

export function appendEvidence(input: {
  workstreamId: string;
  commits?: string[];
  files?: string[];
  commands?: EvidenceCommand[];
  checks?: EvidenceCheck[];
  acceptance?: WorkstreamEvidence["acceptance"];
  limitations?: string[];
  rollback?: string;
  humanDecisions?: string[];
}): WorkstreamEvidence | { error: string } {
  const base = ensureEvidence(input.workstreamId);
  if ("error" in base) return base;

  const next: WorkstreamEvidence = {
    ...base,
    commits: [...base.commits, ...(input.commits ?? [])],
    files: unique([...base.files, ...(input.files ?? [])]),
    commands: [...base.commands, ...(input.commands ?? [])],
    checks: mergeChecks(base.checks, input.checks ?? []),
    acceptance: input.acceptance ?? base.acceptance,
    limitations: [...base.limitations, ...(input.limitations ?? [])],
    rollback: input.rollback ?? base.rollback,
    humanDecisions: [...base.humanDecisions, ...(input.humanDecisions ?? [])],
    updatedAt: new Date().toISOString(),
  };
  saveEvidence(next);

  // Mirror files onto workstream changedFiles for DoD / conflict detection
  if (input.files?.length) {
    const ws = getWorkstream(input.workstreamId);
    if (ws) {
      updateWorkstream(ws.id, {
        changedFiles: unique([...ws.changedFiles, ...input.files]),
      });
    }
  }

  if (input.acceptance) {
    const ws = getWorkstream(input.workstreamId);
    if (ws) {
      updateWorkstream(ws.id, {
        acceptanceCriteria: ws.acceptanceCriteria.map((c) => {
          const a = input.acceptance!.find((x) => x.criterionId === c.id);
          return a
            ? {
                ...c,
                status: a.status,
                evidenceIds: unique([...(c.evidenceIds ?? []), next.id]),
              }
            : c;
        }),
      });
    }
  }

  auditLog("prime.evidence_updated", {
    tenant_id: next.missionId,
    target_ref: `evidence/${next.id}`,
    workstreamId: next.workstreamId,
    files: next.files.length,
    commands: next.commands.length,
  });

  return next;
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

function mergeChecks(
  base: EvidenceCheck[],
  patch: EvidenceCheck[],
): EvidenceCheck[] {
  const map = new Map(base.map((c) => [c.kind, c]));
  for (const p of patch) map.set(p.kind, p);
  return [...map.values()];
}

/**
 * Mark workstream done — requires evidence + DoD. Fails closed.
 */
export function markWorkstreamDone(workstreamId: string): {
  ok: true;
  workstreamId: string;
} | { ok: false; error: string; reasons?: string[] } {
  const ws = getWorkstream(workstreamId);
  if (!ws) return { ok: false, error: "workstream_not_found" };
  if (!ws.evidenceId && !getEvidenceForWorkstream(workstreamId)) {
    return { ok: false, error: "evidence_required" };
  }
  const dod = validateDefinitionOfDone(workstreamId);
  if (!dod.ok) {
    return { ok: false, error: dod.code, reasons: dod.reasons };
  }
  updateWorkstream(workstreamId, { status: "done" });
  return { ok: true, workstreamId };
}

export function getEvidenceOrThrow(id: string): WorkstreamEvidence | undefined {
  return getEvidence(id);
}
