// Regression guards for the mission domain foundation.
// Each test here corresponds to a defect found reviewing PR #49.

import { beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryMissionDomainRepository,
  type MissionDomainRepository,
} from "@/lib/prime/mission-domain-repo";
import { getMission as storeGetMission } from "@/lib/prime/mission-store";

const baseMission = {
  tenantSlug: "bypilar",
  title: "Foundation",
  objective: "Establish domain foundation",
  createdBy: "review",
  riskLevel: "green" as const,
  budgets: {},
  acceptanceCriteria: [{ text: "repo compiles" }],
};

function mustMission(repo: MissionDomainRepository, title = "Foundation") {
  const m = repo.createMission({ ...baseMission, title });
  if ("error" in m) throw new Error(`mission setup failed: ${m.error}`);
  return m;
}

describe("mission domain · referential integrity", () => {
  let repo: MissionDomainRepository;
  beforeEach(() => {
    repo = createMemoryMissionDomainRepository();
    repo.resetForTests();
  });

  it("rejects an agent run for an unknown mission", () => {
    const run = repo.createAgentRun({
      missionId: "msn_missing",
      role: "builder",
      status: "queued",
    });
    expect(run).toMatchObject({ error: "mission_not_found" });
  });

  it("rejects an agent run for an unknown workstream", () => {
    const mission = mustMission(repo);
    const run = repo.createAgentRun({
      missionId: mission.id,
      workstreamId: "ws_missing",
      role: "builder",
      status: "queued",
    });
    expect(run).toMatchObject({
      error: "workstream_not_found",
      field: "workstreamId",
    });
  });

  it("rejects an agent run whose workstream belongs to another mission", () => {
    const a = mustMission(repo, "Mission A");
    const b = mustMission(repo, "Mission B");
    const ws = repo.createWorkstream({
      missionId: a.id,
      title: "W",
      objective: "work",
      assignedRole: "builder",
    });
    if ("error" in ws) throw new Error("workstream setup failed");

    const run = repo.createAgentRun({
      missionId: b.id,
      workstreamId: ws.id,
      role: "builder",
      status: "queued",
    });
    expect(run).toMatchObject({
      error: "workstream_mission_mismatch",
      field: "workstreamId",
    });
  });

  it("accepts an agent run whose workstream belongs to the same mission", () => {
    const mission = mustMission(repo);
    const ws = repo.createWorkstream({
      missionId: mission.id,
      title: "W",
      objective: "work",
      assignedRole: "builder",
    });
    if ("error" in ws) throw new Error("workstream setup failed");

    const run = repo.createAgentRun({
      missionId: mission.id,
      workstreamId: ws.id,
      role: "builder",
      status: "queued",
    });
    expect("error" in run).toBe(false);
  });

  it("rejects a workstream for an unknown mission", () => {
    const ws = repo.createWorkstream({
      missionId: "msn_missing",
      title: "W",
      objective: "work",
      assignedRole: "builder",
    });
    expect(ws).toMatchObject({ error: "mission_not_found" });
  });
});

describe("mission domain · budget validation", () => {
  let repo: MissionDomainRepository;
  beforeEach(() => {
    repo = createMemoryMissionDomainRepository();
    repo.resetForTests();
  });

  // Infinity would make budget-guard's exhaustion check unreachable, and
  // JSON.stringify persists it as null, which flips it to instant exhaustion.
  it("rejects a non-finite budget", () => {
    for (const value of [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ]) {
      const m = repo.createMission({
        ...baseMission,
        budgets: { maxTotalTokens: value },
      });
      expect(m).toMatchObject({
        error: "budget_negative_or_invalid",
        field: "maxTotalTokens",
      });
    }
  });

  it("rejects a negative budget", () => {
    const m = repo.createMission({
      ...baseMission,
      budgets: { maxTokensPerRun: -1 },
    });
    expect(m).toMatchObject({ error: "budget_negative_or_invalid" });
  });

  it("survives a JSON round-trip with finite budgets", () => {
    const mission = mustMission(repo);
    const restored = JSON.parse(JSON.stringify(mission)) as typeof mission;
    for (const value of Object.values(restored.budgets)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      expect(value).not.toBeNull();
    }
  });
});

describe("mission domain · returned objects are copies", () => {
  let repo: MissionDomainRepository;
  beforeEach(() => {
    repo = createMemoryMissionDomainRepository();
    repo.resetForTests();
  });

  it("mutating a created mission does not change stored state", () => {
    const mission = mustMission(repo);
    mission.title = "MUTATED";
    mission.budgets.maxTotalTokens = 1;
    expect(repo.getMission(mission.id)?.title).toBe("Foundation");
    expect(storeGetMission(mission.id)?.budgets.maxTotalTokens).not.toBe(1);
  });

  it("mutating a listed mission does not change stored state", () => {
    const mission = mustMission(repo);
    const listed = repo.listMissions({ tenantSlug: "bypilar" });
    listed[0]!.status = "cancelled";
    expect(repo.getMission(mission.id)?.status).toBe("draft");
  });

  it("mutating a returned workstream does not change stored state", () => {
    const mission = mustMission(repo);
    const ws = repo.createWorkstream({
      missionId: mission.id,
      title: "W",
      objective: "work",
      assignedRole: "builder",
    });
    if ("error" in ws) throw new Error("workstream setup failed");
    ws.status = "done";
    expect(repo.listWorkstreams({ missionId: mission.id })[0]?.status).toBe(
      "queued",
    );
  });

  it("mutating a returned agent run does not change stored state", () => {
    const mission = mustMission(repo);
    const run = repo.createAgentRun({
      missionId: mission.id,
      role: "builder",
      status: "queued",
    });
    if ("error" in run) throw new Error("run setup failed");
    run.status = "completed";
    expect(repo.getAgentRun(run.id)?.status).toBe("queued");
  });
});

describe("mission domain · unknown ids on update", () => {
  let repo: MissionDomainRepository;
  beforeEach(() => {
    repo = createMemoryMissionDomainRepository();
    repo.resetForTests();
  });

  it("reports not-found for unknown mission, workstream and run", () => {
    expect(repo.updateMissionStatus("msn_missing", "running")).toMatchObject({
      error: "mission_not_found",
    });
    expect(repo.updateWorkstreamStatus("ws_missing", "running")).toMatchObject({
      error: "workstream_not_found",
    });
    expect(repo.updateAgentRun("run_missing", { status: "running" })).toMatchObject(
      { error: "agent_run_not_found" },
    );
  });
});
