// Role separation guards for Prime execution.
//
// personaForRole() maps scout, verifier and reviewer all to `frej`, so persona
// cannot distinguish them. These tests pin the execution identity instead, and
// prove that a role cannot fill its own upstream role on the same workstream.

import { describe, expect, it } from "vitest";
import {
  assertRoleSeparation,
  executionIdentityForRole,
} from "@/lib/prime/dispatcher";
import type { MissionRole } from "@/lib/prime/mission-types";

const missionId = "msn_1";
const workstreamId = "ws_1";

function identity(role: MissionRole) {
  return executionIdentityForRole({ missionId, workstreamId, role });
}

describe("prime roles · distinct execution identity", () => {
  it("scout, builder, verifier and reviewer resolve to distinct identities", () => {
    const roles: MissionRole[] = ["scout", "builder", "verifier", "reviewer"];
    const identities = roles.map(identity);
    expect(new Set(identities).size).toBe(roles.length);
  });

  it("identity is stable for the same role and workstream", () => {
    expect(identity("verifier")).toBe(identity("verifier"));
  });

  it("identity differs across workstreams for the same role", () => {
    const a = executionIdentityForRole({ missionId, workstreamId: "ws_a", role: "verifier" });
    const b = executionIdentityForRole({ missionId, workstreamId: "ws_b", role: "verifier" });
    expect(a).not.toBe(b);
  });

  it("identity differs across missions for the same role", () => {
    const a = executionIdentityForRole({ missionId: "msn_a", workstreamId, role: "reviewer" });
    const b = executionIdentityForRole({ missionId: "msn_b", workstreamId, role: "reviewer" });
    expect(a).not.toBe(b);
  });
});

describe("prime roles · separation invariants", () => {
  it("builder cannot be its own verifier", () => {
    const res = assertRoleSeparation({
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
    const res = assertRoleSeparation({
      missionId,
      workstreamId,
      role: "reviewer",
      priorIdentities: { verifier: identity("reviewer") },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("reviewer_cannot_be_own_verifier");
    }
  });

  it("a genuinely separate verifier passes", () => {
    const res = assertRoleSeparation({
      missionId,
      workstreamId,
      role: "verifier",
      priorIdentities: { builder: identity("builder") },
    });
    expect(res.ok).toBe(true);
  });

  it("a genuinely separate reviewer passes", () => {
    const res = assertRoleSeparation({
      missionId,
      workstreamId,
      role: "reviewer",
      priorIdentities: { verifier: identity("verifier") },
    });
    expect(res.ok).toBe(true);
  });

  it("scout and builder have no upstream role to conflict with", () => {
    for (const role of ["scout", "builder"] as MissionRole[]) {
      expect(
        assertRoleSeparation({
          missionId,
          workstreamId,
          role,
          priorIdentities: { builder: identity(role) },
        }).ok,
      ).toBe(true);
    }
  });
});

describe("prime roles · test-only override", () => {
  it("is not the default", () => {
    const res = assertRoleSeparation({
      missionId,
      workstreamId,
      role: "verifier",
      priorIdentities: { builder: identity("verifier") },
    });
    expect(res.ok).toBe(false);
  });

  it("only relaxes the check when explicitly set", () => {
    const res = assertRoleSeparation({
      missionId,
      workstreamId,
      role: "verifier",
      priorIdentities: { builder: identity("verifier") },
      allowSameIdentity: true,
    });
    expect(res.ok).toBe(true);
  });
});
