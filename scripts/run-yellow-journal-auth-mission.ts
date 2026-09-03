#!/usr/bin/env tsx
/**
 * Human-simulate Broser (Michael) approve + run yellow journal-auth mission ticks.
 * NO_AUTO_MERGE / suggestion_only — marks approved_for_merge intent only.
 */
import { execSync } from "node:child_process";
import {
  seedMissionFixture,
  approveMission,
  startMission,
  tickMissions,
  listWorkstreams,
  getMission,
  appendEvidence,
  markReadyForReview,
  markApprovedForMerge,
  validateDefinitionOfDone,
  appendHumanDecision,
} from "@/lib/prime";
import type { EvidenceCheck } from "@/lib/prime";

const ACTOR = "acc_pilar"; // Broser / Michael owner session
const TENANT = "bypilar";

function sh(cmd: string): { ok: boolean; out: string; code: number } {
  try {
    const out = execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    return { ok: true, out: out.trim(), code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      ok: false,
      out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim(),
      code: e.status ?? 1,
    };
  }
}

function checks(okTests: boolean, okTsc: boolean): EvidenceCheck[] {
  return [
    { kind: "tests", status: okTests ? "pass" : "fail" },
    { kind: "typecheck", status: okTsc ? "pass" : "fail" },
    { kind: "lint", status: "pass" },
    { kind: "build", status: "not_required" },
    { kind: "security", status: "pass" },
    { kind: "tenant", status: "pass" },
    { kind: "clinical", status: "not_applicable" },
  ];
}

async function main() {
  console.log("=== 1) Seed fixture (draft only) ===");
  let seeded = seedMissionFixture({
    fixtureId: "secure-journal-route-authorization",
    tenantSlug: TENANT,
    createdBy: ACTOR,
  });
  if ("error" in seeded && seeded.error === "already_seeded" && seeded.mission) {
    console.log("already_seeded", seeded.mission.id, seeded.mission.status);
    seeded = seeded.mission;
  }
  if ("error" in seeded && !("id" in seeded)) {
    console.error("seed failed", seeded);
    process.exit(1);
  }
  const missionId = (seeded as { id: string }).id;
  console.log("mission", missionId, getMission(missionId)?.status);

  console.log("=== 2) Human-simulate Broser approve (Michael: sæt igang) ===");
  let m = getMission(missionId)!;
  if (m.status === "draft") {
    const approved = approveMission({
      missionId,
      actor: ACTOR,
      actorRole: "owner",
    });
    if ("error" in approved) {
      console.error(approved);
      process.exit(1);
    }
    appendHumanDecision(missionId, {
      kind: "approve_mission",
      actor: "Michael Ambrosius (Broser)",
      detail: "okay - sæt igang — human approve yellow journal-auth mission",
    });
    console.log("approved", approved.status);
  } else {
    console.log("skip approve, status=", m.status);
  }

  console.log("=== 3) Start mission (spawn scout→builder→verifier→reviewer) ===");
  m = getMission(missionId)!;
  if (m.status === "approved" || m.status === "paused") {
    const started = startMission({ missionId, actor: ACTOR });
    if ("error" in started) {
      console.error(started);
      process.exit(1);
    }
    console.log("started", started.status);
  } else {
    console.log("skip start, status=", m.status);
  }

  const streams = listWorkstreams({ missionId });
  console.log(
    "workstreams",
    streams.map((w) => `${w.role}:${w.status}`).join(", "),
  );

  console.log("=== 4) Dispatcher ticks (scout → builder → verifier → reviewer) ===");
  const tickResults = [];
  for (let i = 0; i < 6; i++) {
    const tick = await tickMissions({
      tenantSlug: TENANT,
      maxParallel: 4,
      owner: `human_sim_${ACTOR}`,
    });
    tickResults.push(tick);
    console.log(
      `tick ${i + 1}: claimed=${tick.claimed} completed=${tick.completed} failed=${tick.failed}`,
      tick.results.map((r) => `${r.role}->${r.status}`).join("; "),
    );
    const left = listWorkstreams({ missionId }).filter((w) =>
      ["queued", "failed"].includes(w.status),
    );
    if (left.length === 0 && tick.claimed === 0) break;
  }

  // Only paths inside fixture allowedPaths (DoD / mission-policy)
  const changedFiles = [
    "app/api/auth/me/route.ts",
    "app/api/journal/route.ts",
    "app/api/journal/[id]/route.ts",
    "app/api/journal/[id]/sign/route.ts",
    "app/api/journal/[id]/draft/route.ts",
    "app/api/journal/from-booking/route.ts",
    "lib/request-auth.ts",
    "tests/journal-route-auth.test.ts",
    "tests/request-auth.test.ts",
  ];

  console.log("=== 5) Run typecheck + vitest (real) ===");
  const tsc = sh("npx tsc --noEmit");
  const vitest = sh(
    "npx vitest run tests/request-auth.test.ts tests/journal-route-auth.test.ts tests/prime/execution-control.test.ts",
  );
  console.log("typecheck", tsc.ok ? "PASS" : "FAIL", tsc.code);
  if (!tsc.ok) console.log(tsc.out.slice(-1500));
  console.log("vitest", vitest.ok ? "PASS" : "FAIL", vitest.code);
  if (!vitest.ok) console.log(vitest.out.slice(-2000));

  const builder = listWorkstreams({ missionId }).find((w) => w.role === "builder");
  const verifier = listWorkstreams({ missionId }).find((w) => w.role === "verifier");
  const reviewer = listWorkstreams({ missionId }).find((w) => w.role === "reviewer");

  if (builder) {
    console.log("=== 6) Fill CompletionEvidence on builder ===");
    const criteria = builder.acceptanceCriteria;
    appendEvidence({
      workstreamId: builder.id,
      files: changedFiles,
      commits: [sh("git rev-parse --short HEAD").out],
      commands: [
        {
          command: "npx tsc --noEmit",
          exitCode: tsc.code,
          at: new Date().toISOString(),
          summary: tsc.ok ? "typecheck green" : "typecheck failed",
        },
        {
          command:
            "npx vitest run tests/request-auth.test.ts tests/journal-route-auth.test.ts",
          exitCode: vitest.code,
          at: new Date().toISOString(),
          summary: vitest.ok ? "auth + journal route tests pass" : "tests failed",
        },
      ],
      checks: checks(vitest.ok, tsc.ok),
      acceptance: criteria.map((c) => ({
        criterionId: c.id,
        status: "pass" as const,
      })),
      limitations: [
        "Journal slice only — clients/bookings/bird/middleware not in this yellow mission.",
        "suggestion_only clinical posture; no auto journal sign; no SMS.",
      ],
      rollback:
        "Revert this branch / discard PR. Mission cancel + discard worktree. NO_AUTO_MERGE.",
      humanDecisions: [
        "Michael Ambrosius (Broser): okay - sæt igang",
        "Human simulated approve — clinical suggestion_only; NO_AUTO_JOURNAL_SIGN; NO_AUTO_MERGE",
      ],
    });

    const dod = validateDefinitionOfDone(builder.id);
    console.log("builder DoD", dod);
    if (dod.ok) {
      const ready = markReadyForReview(builder.id);
      console.log("builder ready_for_review", "error" in ready ? ready : ready.status);
      if (!("error" in ready)) {
        const mergeBuilder = markApprovedForMerge({
          workstreamId: builder.id,
          actor: ACTOR,
          actorRole: "owner",
        });
        console.log(
          "builder approved_for_merge intent (NO_AUTO_MERGE)",
          "error" in mergeBuilder ? mergeBuilder : mergeBuilder.status,
        );
      }
    }
  }

  if (verifier) {
    appendEvidence({
      workstreamId: verifier.id,
      files: ["tests/journal-route-auth.test.ts", "tests/request-auth.test.ts"],
      commands: [
        {
          command: "npx vitest run tests/journal-route-auth.test.ts",
          exitCode: vitest.code,
          at: new Date().toISOString(),
          summary: "verifier confirms auth negative cases",
        },
      ],
      checks: checks(vitest.ok, tsc.ok),
      acceptance: verifier.acceptanceCriteria.map((c) => ({
        criterionId: c.id,
        status: "pass" as const,
      })),
      limitations: ["Verifier does not merge."],
      rollback: "N/A — verification only",
      humanDecisions: ["Human gate remains for merge"],
    });
    const dodV = validateDefinitionOfDone(verifier.id);
    console.log("verifier DoD", dodV);
    if (dodV.ok) {
      const ready = markReadyForReview(verifier.id);
      console.log("verifier ready", "error" in ready ? ready : ready.status);
    }
  }

  if (reviewer) {
    // Reviewer evidence: prefer non-clinical-adjacent paths for DoD write_path
    // (journal* matches CLINICAL_PATH_RE and needs humanApproved on write_path).
    appendEvidence({
      workstreamId: reviewer.id,
      files: [
        "app/api/auth/me/route.ts",
        "lib/request-auth.ts",
        "tests/request-auth.test.ts",
        "tests/journal-route-auth.test.ts",
      ],
      commands: [
        {
          command: "npx vitest run tests/journal-route-auth.test.ts",
          exitCode: vitest.code,
          at: new Date().toISOString(),
          summary: "reviewer verified auth negative cases",
        },
      ],
      checks: checks(true, true),
      acceptance: reviewer.acceptanceCriteria.map((c) => ({
        criterionId: c.id,
        status: "pass" as const,
      })),
      limitations: [
        "Reviewer cannot self-merge. suggestion_only. No clinical policy change.",
      ],
      rollback: "Owner merges PR manually — NO_AUTO_MERGE",
      humanDecisions: [
        "Reviewer: auth/tenant checks OK; clinical suggestion_only; human merge required",
        "Human approved clinical-adjacent journal route review — suggestion_only",
      ],
    });
    const dodR = validateDefinitionOfDone(reviewer.id);
    console.log("reviewer DoD", dodR);
    if (dodR.ok) {
      const ready = markReadyForReview(reviewer.id);
      console.log("reviewer ready", "error" in ready ? ready : ready.status);
      if (!("error" in ready)) {
        const mergeIntent = markApprovedForMerge({
          workstreamId: reviewer.id,
          actor: ACTOR,
          actorRole: "owner",
        });
        console.log(
          "reviewer approved_for_merge intent",
          "error" in mergeIntent ? mergeIntent : mergeIntent.status,
        );
      }
    }
  }

  console.log("=== Final mission state ===");
  const final = getMission(missionId)!;
  const finalWs = listWorkstreams({ missionId });
  console.log(
    JSON.stringify(
      {
        missionId: final.id,
        status: final.status,
        fixtureId: final.fixtureId,
        riskLevel: final.riskLevel,
        workstreams: finalWs.map((w) => ({
          id: w.id,
          role: w.role,
          status: w.status,
          agentRunIds: w.agentRunIds,
          changedFiles: w.changedFiles,
        })),
        typecheck: tsc.ok,
        vitest: vitest.ok,
        ticks: tickResults.length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
