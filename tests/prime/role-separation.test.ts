// Role separation guards for Prime execution.
//
// personaForRole() maps scout, verifier and reviewer all to `frej`, so persona
// cannot distinguish them. These tests pin the Prime execution identity instead.
// A distinct identity is not a claim of a separate external model or session.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertPrimeRoleSeparation,
  MISSION_ROLE_CAPABILITIES,
  primeIdentityForRole,
  roleExecutionBinding,
  roleMay,
} from "@/lib/prime/roles";
import type { MissionRole } from "@/lib/prime/mission-types";

const missionId = "msn_1";
const workstreamId = "ws_1";

function identity(role: MissionRole) {
  return primeIdentityForRole({ missionId, workstreamId, role });
}

const ALL_ROLES: MissionRole[] = [
  "prime_commander",
  "scout",
  "builder",
  "verifier",
  "reviewer",
  "release_steward",
];

describe("prime roles · distinct execution identity", () => {
  it("scout, verifier and reviewer resolve to distinct Prime identities", () => {
    const roles: MissionRole[] = ["scout", "verifier", "reviewer"];
    const identities = roles.map(identity);
    expect(new Set(identities).size).toBe(roles.length);
  });

  it("scout, builder, verifier and reviewer resolve to distinct identities", () => {
    const roles: MissionRole[] = ["scout", "builder", "verifier", "reviewer"];
    const identities = roles.map(identity);
    expect(new Set(identities).size).toBe(roles.length);
  });

  it("identity is stable for the same role and workstream", () => {
    expect(identity("verifier")).toBe(identity("verifier"));
  });

  it("identity differs across workstreams for the same role", () => {
    const a = primeIdentityForRole({ missionId, workstreamId: "ws_a", role: "verifier" });
    const b = primeIdentityForRole({ missionId, workstreamId: "ws_b", role: "verifier" });
    expect(a).not.toBe(b);
  });

  it("identity differs across missions for the same role", () => {
    const a = primeIdentityForRole({ missionId: "msn_a", workstreamId, role: "reviewer" });
    const b = primeIdentityForRole({ missionId: "msn_b", workstreamId, role: "reviewer" });
    expect(a).not.toBe(b);
  });
});

describe("prime roles · separation invariants", () => {
  it("builder cannot be its own verifier", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "verifier",
      priorIdentities: { builder: identity("verifier") },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("verifier_cannot_be_own_builder");
      expect(res.conflictingRole).toBe("builder");
    }
  });

  it("verifier cannot be its own reviewer", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "reviewer",
      priorIdentities: { verifier: identity("reviewer") },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("reviewer_cannot_be_own_verifier");
      expect(res.conflictingRole).toBe("verifier");
    }
  });

  it("builder cannot be its own reviewer", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "reviewer",
      priorIdentities: { builder: identity("reviewer") },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("reviewer_cannot_be_own_builder");
      expect(res.conflictingRole).toBe("builder");
    }
  });

  it("reviewer conflicting with both upstream roles is rejected", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "reviewer",
      priorIdentities: {
        builder: identity("reviewer"),
        verifier: identity("reviewer"),
      },
    });
    expect(res.ok).toBe(false);
  });

  it("a genuinely separate verifier passes", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "verifier",
      priorIdentities: { builder: identity("builder") },
    });
    expect(res.ok).toBe(true);
  });

  it("a genuinely separate reviewer passes", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "reviewer",
      priorIdentities: {
        builder: identity("builder"),
        verifier: identity("verifier"),
      },
    });
    expect(res.ok).toBe(true);
  });

  it("scout and builder have no upstream role to conflict with", () => {
    for (const role of ["scout", "builder"] as MissionRole[]) {
      expect(
        assertPrimeRoleSeparation({
          missionId,
          workstreamId,
          role,
          priorIdentities: { builder: identity(role) },
        }).ok,
      ).toBe(true);
    }
  });
});

describe("prime roles · no fabricated external session", () => {
  it("reviewer does not claim a separate external model or session", () => {
    const binding = roleExecutionBinding({
      missionId,
      workstreamId,
      role: "reviewer",
    });
    expect(binding.claimsSeparateExternalModel).toBe(false);
    expect(binding.claimsSeparateExternalSession).toBe(false);
    expect(binding.externalModelId).toBeNull();
    expect(binding.externalSessionId).toBeNull();
  });

  it("scout, verifier and reviewer stay logical Prime identities only", () => {
    for (const role of ["scout", "verifier", "reviewer"] as MissionRole[]) {
      const binding = roleExecutionBinding({ missionId, workstreamId, role });
      expect(binding.identity).toBe(identity(role));
      expect(binding.claimsSeparateExternalModel).toBe(false);
      expect(binding.claimsSeparateExternalSession).toBe(false);
    }
  });
});

describe("prime roles · human merge/deploy gates", () => {
  it("no mission role may merge or deploy", () => {
    for (const role of ALL_ROLES) {
      const caps = MISSION_ROLE_CAPABILITIES[role];
      expect(caps.canMerge).toBe(false);
      expect(caps.canDeploy).toBe(false);
      expect(roleMay(role, "merge")).toBe(false);
      expect(roleMay(role, "deploy")).toBe(false);
    }
  });

  it("no mission role may raise budget or sign a journal", () => {
    for (const role of ALL_ROLES) {
      const caps = MISSION_ROLE_CAPABILITIES[role];
      expect(caps.canRaiseBudget).toBe(false);
      expect(caps.canSignJournal).toBe(false);
      expect(roleMay(role, "raise_budget")).toBe(false);
      expect(roleMay(role, "journal_sign")).toBe(false);
    }
  });
});

describe("prime roles · clinical agents stay untouched", () => {
  it("roles module does not import or remap clinical agents", () => {
    const src = readFileSync(resolve("lib/prime/roles.ts"), "utf8");
    expect(src).not.toMatch(/@\/lib\/agents/);
    expect(src).not.toMatch(/agents\/runtime/);
    expect(src).not.toMatch(/personaForRole/);
  });
});

describe("prime roles · test-only override", () => {
  it("is not the default", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "verifier",
      priorIdentities: { builder: identity("verifier") },
    });
    expect(res.ok).toBe(false);
  });

  it("only relaxes the check when explicitly set", () => {
    const res = assertPrimeRoleSeparation({
      missionId,
      workstreamId,
      role: "verifier",
      priorIdentities: { builder: identity("verifier") },
      allowSameIdentity: true,
    });
    expect(res.ok).toBe(true);
  });
});
