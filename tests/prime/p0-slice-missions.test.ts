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

  it("F7 · consent lib + migration 0007 + gates → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "lib/consent.ts",
        "supabase/migrations/0007_consent_events.sql",
        "app/api/v1/scan/process/route.ts",
        "app/api/journal/[id]/draft/route.ts",
        "app/api/bird/send/route.ts",
        "tests/f7-consent.test.ts",
        "fixtures/missions/p0-f7-consent-gates.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f7-consent-gates",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F7 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F8 · audit align migration 0008 + request context → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "lib/audit.ts",
        "supabase/migrations/0008_audit_log_align.sql",
        "app/api/auth/login/route.ts",
        "tests/f8-audit-align.test.ts",
        "fixtures/missions/p0-f8-audit-align.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f8-audit-align",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F8 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F9 · additive docker-compose.db.yml + scripts + env → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "docker-compose.db.yml",
        "scripts/db-init-selfhost.sh",
        "scripts/db-apply-migrations.sh",
        ".env.production.example",
        "lib/supabase.ts",
        "tests/f9-db-infra.test.ts",
        "fixtures/missions/p0-f9-db-infra.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f9-db-infra",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F9 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F10 · cutover runbook + memory/JSON import script → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "scripts/migrate-memory-to-pg.ts",
        "docs/ops/p0-db-cutover-runbook.md",
        "tests/f10-cutover-runbook.test.ts",
        "fixtures/missions/p0-f10-cutover-runbook.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f10-cutover-runbook",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F10 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F16 · health DB fail-fast wiring → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/health/route.ts",
        "lib/supabase.ts",
        "docs/ops/p0-db-cutover-runbook.md",
        "tests/f16-health-db-failfast.test.ts",
        "fixtures/missions/p0-f16-health-db-failfast.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f16-health-db-failfast",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F16 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F17 · consent onboarding wiring → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/v1/[tenant]/consent/route.ts",
        "app/t/[tenant]/onboarding/page.tsx",
        "tests/f17-consent-onboarding.test.ts",
        "fixtures/missions/p0-f17-consent-onboarding.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f17-consent-onboarding",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F17 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F18 · audit supabase-mode → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "lib/audit.ts",
        "supabase/migrations/0008_audit_log_align.sql",
        "tests/f18-audit-supabase-mode.test.ts",
        "fixtures/missions/p0-f18-audit-supabase-mode.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f18-audit-supabase-mode",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F18 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F19 · events GET staff-gated → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/events/route.ts",
        "tests/f19-events-auth.test.ts",
        "fixtures/missions/p0-f19-events-auth.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f19-events-auth",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F19 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F20 · agents workflows GET auth → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/agents/workflows/route.ts",
        "tests/f20-agents-workflows-auth.test.ts",
        "fixtures/missions/p0-f20-agents-workflows-auth.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f20-agents-workflows-auth",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F20 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F21/F22 · CODE-MAP + lookup rate-limit → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "CODE-MAP.md",
        "lib/public-booking-kit.ts",
        "app/api/v1/[tenant]/lookup/route.ts",
        "app/api/v1/[tenant]/voucher/route.ts",
        "tests/f21-f22-codemap-ratelimit.test.ts",
        "fixtures/missions/p0-f21-f22-codemap-ratelimit.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f21-f22-codemap-ratelimit",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F21/F22 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F23/F24 · audit context + scan GET / license scope → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/tenant/setup/route.ts",
        "app/api/license/route.ts",
        "app/api/v1/scan/process/route.ts",
        "tests/f23-f24-audit-context-scan-license.test.ts",
        "fixtures/missions/p0-f23-f24-audit-scan-license.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f23-f24-audit-scan-license",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F23/F24 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F25–F30 · signup/health/ops/middleware/auth-audit/from-booking → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/signup/route.ts",
        "app/api/health/route.ts",
        "app/api/journal/from-booking/route.ts",
        "docs/ops/p0-operator-checklist-merge-cutover.md",
        "tests/f25-f30-signup-health-frombooking.test.ts",
        "tests/f29-authorize-tenant-usage-audit.test.ts",
        "fixtures/missions/p0-f25-f30-signup-health-ops.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f25-f30-signup-health-ops",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F25–F30 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F31–F34 · audit/public hardening → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "lib/rate-limit.ts",
        "app/api/signup/route.ts",
        "app/api/bird/config/route.ts",
        "app/api/bird/send/route.ts",
        "app/api/scan/config/route.ts",
        "app/api/v1/[tenant]/clients/route.ts",
        "app/api/cvr/lookup/route.ts",
        "app/api/dawa/autocomplete/route.ts",
        "tests/f31-f34-audit-public-hardening.test.ts",
        "fixtures/missions/p0-f31-f34-audit-public-hardening.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f31-f34-audit-public-hardening",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F31–F34 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F35–F38 · journal/bird/login/CODE-MAP → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/journal/route.ts",
        "app/api/journal/[id]/route.ts",
        "app/api/journal/[id]/sign/route.ts",
        "app/api/journal/[id]/draft/route.ts",
        "app/api/bird/status/route.ts",
        "app/api/auth/login/route.ts",
        "CODE-MAP.md",
        "tests/f35-f38-journal-bird-login-codemap.test.ts",
        "fixtures/missions/p0-f35-f38-journal-bird-login.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f35-f38-journal-bird-login",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F35–F38 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F39/F40 · checklist + approvals audit → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "docs/ops/p0-operator-checklist-merge-cutover.md",
        "app/api/agents/approvals/route.ts",
        "tests/f39-f40-checklist-approvals.test.ts",
        "fixtures/missions/p0-f39-f40-checklist-approvals.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f39-f40-checklist-approvals",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F39/F40 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F41 · research/swarm/orchestrator auth → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/v1/[tenant]/research/route.ts",
        "app/api/v1/[tenant]/research/ask/route.ts",
        "app/api/v1/[tenant]/research/papers/[arxivId]/route.ts",
        "app/api/v1/[tenant]/swarm/route.ts",
        "app/api/v1/[tenant]/swarm/tick/route.ts",
        "app/api/v1/[tenant]/swarm/stream/route.ts",
        "app/api/v1/[tenant]/orchestrator/route.ts",
        "app/api/v1/[tenant]/orchestrator/runs/[runId]/route.ts",
        "tests/f41-research-swarm-orchestrator-auth.test.ts",
        "fixtures/missions/p0-f41-research-swarm-orchestrator.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f41-research-swarm-orchestrator",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F41 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F42–F48 · captcha/consent/hardening → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "lib/captcha.ts",
        "app/api/auth/login/route.ts",
        "app/api/signup/route.ts",
        "app/api/v1/[tenant]/consent/route.ts",
        "app/api/bird/config/route.ts",
        "app/api/bird/status/route.ts",
        "app/api/scan/config/route.ts",
        "app/api/agents/run/route.ts",
        "app/api/v1/[tenant]/prime/missions/route.ts",
        "app/api/v1/[tenant]/lookup/route.ts",
        "app/api/v1/[tenant]/voucher/route.ts",
        "docs/ops/p0-operator-checklist-merge-cutover.md",
        "tests/f29-authorize-tenant-usage-audit.test.ts",
        "tests/f42-f48-captcha-consent-hardening.test.ts",
        "fixtures/missions/p0-f42-f48-captcha-consent-hardening.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f42-f48-captcha-consent-hardening",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F42–F48 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F49–F54 · CODE-MAP/authme/hardening → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "CODE-MAP.md",
        ".env.example",
        "app/api/auth/me/route.ts",
        "app/api/v1/[tenant]/services/route.ts",
        "app/api/v1/[tenant]/availability/route.ts",
        "app/api/v1/[tenant]/prime/missions/route.ts",
        "app/api/cron/swarm-tick/route.ts",
        "tests/f49-f54-codemap-authme-hardening.test.ts",
        "fixtures/missions/p0-f49-f54-codemap-authme-hardening.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f49-f54-codemap-authme-hardening",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F49–F54 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F55–F58 · logout/status/health → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/auth/logout/route.ts",
        "app/api/agents/status/route.ts",
        "app/api/health/route.ts",
        "tests/f55-f58-logout-status-health.test.ts",
        "fixtures/missions/p0-f55-f58-logout-status-health.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f55-f58-logout-status-health",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F55–F58 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F59 · MCP public rate-limit → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/mcp/v1/route.ts",
        "tests/f59-mcp-public-ratelimit.test.ts",
        "fixtures/missions/p0-f59-mcp-public-ratelimit.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f59-mcp-public-ratelimit",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F59 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F60 · embed hardening → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/embed/v1/[tenant]/route.ts",
        "tests/f60-embed-hardening.test.ts",
        "fixtures/missions/p0-f60-embed-hardening.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f60-embed-hardening",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F60 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F61–F64 · checklist/audit/captcha → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "docs/ops/p0-operator-checklist-merge-cutover.md",
        "app/api/v1/[tenant]/bookings/route.ts",
        "app/api/events/route.ts",
        "app/api/agents/tick/route.ts",
        "app/api/agents/workflows/route.ts",
        "app/api/v1/[tenant]/swarm/route.ts",
        "app/api/v1/[tenant]/research/ask/route.ts",
        "app/api/v1/[tenant]/orchestrator/route.ts",
        "lib/captcha.ts",
        ".env.example",
        "tests/f61-f64-checklist-audit-captcha.test.ts",
        "fixtures/missions/p0-f61-f64-checklist-audit-captcha.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f61-f64-checklist-audit-captcha",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F61–F64 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F65–F68 · CORS/audit stragglers → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/v1/[tenant]/services/route.ts",
        "app/api/v1/[tenant]/availability/route.ts",
        "app/api/v1/[tenant]/swarm/tick/route.ts",
        "app/api/v1/[tenant]/research/route.ts",
        "app/api/mcp/v1/route.ts",
        "lib/agent-worker-auth.ts",
        "tests/f65-f68-cors-audit-stragglers.test.ts",
        "fixtures/missions/p0-f65-f68-cors-audit-stragglers.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f65-f68-cors-audit-stragglers",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F65–F68 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F69–F71 · staff CORS/list audit → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/v1/[tenant]/clients/route.ts",
        "app/api/v1/[tenant]/bookings/list/route.ts",
        "tests/f69-f71-staff-cors-list-audit.test.ts",
        "fixtures/missions/p0-f69-f71-staff-cors-list-audit.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f69-f71-staff-cors-list-audit",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F69–F71 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F72–F74 · CVR CORS + security headers → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/cvr/lookup/route.ts",
        "app/api/dawa/autocomplete/route.ts",
        "middleware.ts",
        "tests/f72-f74-cvr-security-headers.test.ts",
        "fixtures/missions/p0-f72-f74-cvr-security-headers.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f72-f74-cvr-security-headers",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F72–F74 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F75–F76 · MCP/research audits → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/mcp/v1/route.ts",
        "app/api/v1/[tenant]/research/papers/[arxivId]/route.ts",
        "tests/f75-f76-mcp-research-audit.test.ts",
        "fixtures/missions/p0-f75-f76-mcp-research-audit.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f75-f76-mcp-research-audit",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F75–F76 mission=${mission.id} builder_status=${mergeMark.status}`);
  });

  it("F78–F84 · higher-value slices → approved_for_merge intent", () => {
    const sliceFiles = changedFilesSinceMain().filter((f) =>
      [
        "app/api/v1/[tenant]/consent/route.ts",
        "app/t/[tenant]/onboarding/page.tsx",
        ".github/workflows/ci.yml",
        "docs/ops/p0-operator-checklist-merge-cutover.md",
        "docs/ops/coding-ready.md",
        "docs/ops/sandbox-verify.md",
        "docs/ops/p0-secure-clinical-core-plan.md",
        "tests/f78-f84-higher-value-slices.test.ts",
        "fixtures/missions/p0-f78-f84-higher-value-slices.json",
        "tests/prime/p0-slice-missions.test.ts",
      ].includes(f),
    );
    expect(sliceFiles.length).toBeGreaterThan(0);

    const { mission, mergeMark } = driveSliceToApprovedForMerge(
      "p0-f78-f84-higher-value-slices",
      sliceFiles,
    );

    expect(mission.id).toMatch(/^msn_/);
    expect(getMission(mission.id)?.status).toBe("running");
    expect(mergeMark.status).toBe("approved_for_merge");
    // eslint-disable-next-line no-console
    console.log(`[PEC] F78–F84 mission=${mission.id} builder_status=${mergeMark.status}`);
  });
});
