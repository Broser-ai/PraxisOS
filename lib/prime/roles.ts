// Mission roles — capabilities and hard limits (Prime Execution Control).

import type { MissionRole } from "@/lib/prime/mission-types";
import type { PolicyActionKind } from "@/lib/prime/mission-types";

export type RoleCapabilities = {
  role: MissionRole;
  description: string;
  may: PolicyActionKind[];
  mayNot: PolicyActionKind[];
  canRaiseBudget: false;
  canMerge: false;
  canDeploy: false;
  canSignJournal: false;
};

export const MISSION_ROLE_CAPABILITIES: Record<MissionRole, RoleCapabilities> = {
  prime_commander: {
    role: "prime_commander",
    description: "Owns mission lifecycle draft/approve/start/pause/cancel; never merges",
    may: ["mark_approved_for_merge"],
    mayNot: [
      "merge",
      "deploy",
      "write_main",
      "prod_env_secrets",
      "journal_sign",
      "raise_budget",
      "clinical_policy",
      "mdr_claim",
      "pathology_claim",
      "patient_claim",
    ],
    canRaiseBudget: false,
    canMerge: false,
    canDeploy: false,
    canSignJournal: false,
  },
  scout: {
    role: "scout",
    description: "Read/research only — propose paths and acceptance criteria",
    may: [],
    mayNot: [
      "write_main",
      "merge",
      "deploy",
      "migration",
      "prod_env_secrets",
      "sms_patient",
      "journal_sign",
      "raise_budget",
      "clinical_policy",
      "mdr_claim",
      "pathology_claim",
      "patient_claim",
      "mark_approved_for_merge",
    ],
    canRaiseBudget: false,
    canMerge: false,
    canDeploy: false,
    canSignJournal: false,
  },
  builder: {
    role: "builder",
    description: "Implements within allowedPaths; cannot approve own DoD",
    may: ["write_path"],
    mayNot: [
      "write_main",
      "merge",
      "deploy",
      "prod_env_secrets",
      "journal_sign",
      "raise_budget",
      "mark_approved_for_merge",
      "clinical_policy",
      "mdr_claim",
      "pathology_claim",
      "patient_claim",
    ],
    canRaiseBudget: false,
    canMerge: false,
    canDeploy: false,
    canSignJournal: false,
  },
  verifier: {
    role: "verifier",
    description: "Runs tests/typecheck/build evidence; cannot merge",
    may: ["write_path"],
    mayNot: [
      "merge",
      "deploy",
      "write_main",
      "raise_budget",
      "journal_sign",
      "mark_approved_for_merge",
    ],
    canRaiseBudget: false,
    canMerge: false,
    canDeploy: false,
    canSignJournal: false,
  },
  reviewer: {
    role: "reviewer",
    description: "Reviews evidence + DoD; blocks on policy; never self-merges",
    may: [],
    mayNot: [
      "merge",
      "deploy",
      "write_main",
      "raise_budget",
      "journal_sign",
      "mark_approved_for_merge",
    ],
    canRaiseBudget: false,
    canMerge: false,
    canDeploy: false,
    canSignJournal: false,
  },
  release_steward: {
    role: "release_steward",
    description: "May mark approved_for_merge only; manual merge by human",
    may: ["mark_approved_for_merge"],
    mayNot: [
      "merge",
      "deploy",
      "write_main",
      "raise_budget",
      "journal_sign",
      "prod_env_secrets",
    ],
    canRaiseBudget: false,
    canMerge: false,
    canDeploy: false,
    canSignJournal: false,
  },
};

export function roleMay(role: MissionRole, action: PolicyActionKind): boolean {
  const caps = MISSION_ROLE_CAPABILITIES[role];
  if (caps.mayNot.includes(action)) return false;
  if (caps.may.length === 0 && action === "write_path") return role === "builder" || role === "verifier";
  return caps.may.includes(action) || (action === "write_path" && caps.may.includes("write_path"));
}

/** Default orchestration order after scout. */
export const DEFAULT_FLOW: MissionRole[] = [
  "scout",
  "builder",
  "verifier",
  "reviewer",
];
