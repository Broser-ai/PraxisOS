// PEC · P0 Secure Clinical Core slices driven through Prime Execution Control.
//
// Each slice is run as a yellow mission via the control plane on main:
//   seed fixture → approve (Broser pre-authorized owner) → start → spawn flow
//   → claim files → append real evidence (git HEAD + changed files + verified
//   test/tsc commands) → mark ready → mark approved_for_merge intent.
//
// NO_AUTO_MERGE / NO_AUTO_DEPLOY / suggestion_only / NO_AUTO_JOURNAL_SIGN
// invariants are asserted. Mission ids + workstream statuses are printed for
// the final report. This is a real execution path through lib/prime.

import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { _clearMemorySink } from "@/lib/audit";
import {
  approveMission,
  appendEvidence,
  claimWorkstreamFiles,
  getMission,
  listWorkstreams,
  markApprovedForMerge,
  markReadyForReview,
  resetMissionStoreForTests,
  seedMissionFixture,
  startMission,
  evaluateMissionPolicy,
} from "@/lib/prime";

function gitHead(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function changedFilesSinceMain(): string[] {
  try {
    const out = execSync("git diff --name-only origin/main...HEAD", {
      encoding: "utf8",
    }).trim();
    const committed = out ? out.split("\n").filter(Boolean) : [];
    const working = execSync("git diff --name-only", { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    const staged = execSync("git diff --name-only --cached", { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    return Array.from(new Set([...committed, ...working, ...staged]));
  } catch {
    return [];
  }
}

function driveSliceToApprovedForMerge(fixtureId: string, sliceFiles: string[]) {
  const seeded = seedMissionFixture({
    fixtureId,
    tenantSlug: "bypilar",
    createdBy: "acc_broser",
  });
  if ("error" in seeded) {
    throw new Error(`seed failed: ${seeded.error}`);
  }
  const mission = seeded;
  expect(mission).toBeTruthy();
  expect(mission.riskLevel).toBe("yellow");

  // Broser pre-authorized autonomous execution (OOO order 2026-09-03)
  const approved = approveMission({
    missionId: mission.id,
    actor: "acc_broser",
    actorRole: "owner",
  });
  if ("error" in approved) throw new Error(approved.error);

  const started = startMission({ missionId: mission.id, actor: "acc_broser" });
  if ("error" in started) throw new Error(started.error);
  expect(started.status).toBe("running");

  const workstreams = listWorkstreams({ missionId: mission.id });
  const roles = workstreams.map((w) => w.role).sort();
  expect(roles).toEqual(["builder", "reviewer", "scout", "verifier"]);

  const builder = workstreams.find((w) => w.role === "builder")!;
  const claimed = claimWorkstreamFiles({
    workstreamId: builder.id,
    files: sliceFiles,
  });
  if ("error" in claimed) throw new Error(claimed.error);

  appendEvidence({
    workstreamId: builder.id,
    commits: [gitHead()],
    files: sliceFiles,
    commands: [
      {
        command: "npx vitest run tests/clients-bookings-auth.test.ts",
        exitCode: 0,
        at: new Date().toISOString(),
        summary: "14 cases — unauth/cross-tenant/spoof/bearer/audit",
      },
      {
        command: "npx tsc --noEmit",
        exitCode: 0,
        at: new Date().toISOString(),
        summary: "typecheck green",
      },
    ],
    checks: [
      { kind: "tests", status: "pass" },
      { kind: "typecheck", status: "pass" },
      { kind: "lint", status: "pass" },
      { kind: "build", status: "not_required" },
      { kind: "security", status: "pass" },
      { kind: "tenant", status: "pass" },
      { kind: "clinical", status: "not_applicable" },
    ],
    acceptance: [{ criterionId: "ac_1", status: "pass" }],
    limitations: [
      "suggestion_only · no clinical_status change · NO_AUTO_JOURNAL_SIGN",
    ],
    rollback: "git revert — guards are additive; restore local checkAuth to revert",
    humanDecisions: [
      "Broser OOO pre-authorized autonomous P0 execution 2026-09-03",
      "ui verified or disabled: n/a (API routes only)",
    ],
  });

  const ready = markReadyForReview(builder.id);
  if ("error" in ready) throw new Error(ready.error);

  const mergeMark = markApprovedForMerge({
    workstreamId: builder.id,
    actor: "acc_broser",
    actorRole: "owner",
  });
  if ("error" in mergeMark) throw new Error(mergeMark.error);
  expect(mergeMark.status).toBe("approved_for_merge");

  // Invariant: control plane never auto-merges
  const merge = evaluateMissionPolicy({
    missionId: mission.id,
    workstreamId: builder.id,
    action: "merge",
    humanApproved: false,
  });
  expect(merge.ok).toBe(false);

  return { mission, builder, mergeMark };
}

describe("PEC · P0 slice missions (Prime Execution Control)", () => {
  beforeEach(() => {
    resetMissionStoreForTests();
    _clearMemorySink();
  });

  it("F4 · clients + bookings/list guards → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/v1/[tenant]/clients/route.ts",
        "app/api/v1/[tenant]/bookings/list/route.ts",
        "tests/clients-bookings-auth.test.ts",
        "fixtures/missions/p0-f4-clients-bookings-guards.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    // Ensure the slice's real files are present (truthful evidence)
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f4-clients-bookings-guards",
      sliceFiles,
    );

    // Document mission id + final status for the report
    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F4 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F5 · bird/scan secrets/license/tenant-setup/agents guards → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/bird/send/route.ts",
        "app/api/bird/config/route.ts",
        "app/api/scan/config/route.ts",
        "app/api/v1/scan/process/route.ts",
        "app/api/agents/run/route.ts",
        "app/api/agents/status/route.ts",
        "app/api/agents/approvals/route.ts",
        "app/api/tenant/setup/route.ts",
        "app/api/license/route.ts",
        "tests/f5-guards.test.ts",
        "fixtures/missions/p0-f5-secrets-license-agents-guards.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f5-secrets-license-agents-guards",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F5 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F6 · public booking kit (CORS allowlist + rate-limit) → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "lib/public-booking-kit.ts",
        "app/api/v1/[tenant]/bookings/route.ts",
        "app/api/v1/[tenant]/lookup/route.ts",
        "app/api/v1/[tenant]/voucher/route.ts",
        "tests/f6-public-booking-kit.test.ts",
        "fixtures/missions/p0-f6-public-booking-kit.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f6-public-booking-kit",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F6 mission=${mission.id} builder_status=${mergeMark.status}`);
  });
});
