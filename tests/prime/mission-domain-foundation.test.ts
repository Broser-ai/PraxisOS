import { describe, it, expect, beforeEach } from "vitest";
import {
  createMemoryMissionDomainRepository,
  type MissionDomainRepository,
} from "@/lib/prime/mission-domain-repo";

function repo(): MissionDomainRepository {
  return createMemoryMissionDomainRepository();
}

const baseBudgets = {
  maxTotalTokens: 100_000,
  maxTokensPerRun: 16_000,
  maxToolCallsPerRun: 20,
  maxRuntimeMinutes: 60,
  maxAgents: 2,
  maxChangedFiles: 20,
  maxReworkLoops: 2,
  reservedTokens: 0,
  maxParallelWorkstreams: 2,
};

describe("Mission domain foundation (memory repo)", () => {
  let r: MissionDomainRepository;

  beforeEach(() => {
    r = repo();
    r.resetForTests();
  });

  it("creates and reads a Mission", () => {
    const created = r.createMission({
      tenantSlug: "bypilar",
      title: "Secure journal auth",
      objective: "Guard journal routes",
      createdBy: "acc_test",
      riskLevel: "yellow",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "Journal routes require auth" }],
    });
    expect("error" in created).toBe(false);
    if ("error" in created) return;

    expect(created.title).toBe("Secure journal auth");
    expect(created.objective).toBe("Guard journal routes");
    expect(created.goal).toBe("Guard journal routes");
    expect(created.acceptanceCriteria).toHaveLength(1);
    expect(created.status).toBe("draft");

    const got = r.getMission(created.id);
    expect(got?.id).toBe(created.id);
    expect(r.listMissions({ tenantSlug: "bypilar" })).toHaveLength(1);
  });

  it("creates and lists Workstreams for the correct Mission only", () => {
    const m1 = r.createMission({
      tenantSlug: "bypilar",
      title: "M1",
      objective: "Obj1",
      createdBy: "acc_test",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "AC1" }],
    });
    const m2 = r.createMission({
      tenantSlug: "bypilar",
      title: "M2",
      objective: "Obj2",
      createdBy: "acc_test",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "AC2" }],
    });
    expect("error" in m1 || "error" in m2).toBe(false);
    if ("error" in m1 || "error" in m2) return;

    const ws1 = r.createWorkstream({
      missionId: m1.id,
      title: "Build auth",
      objective: "Implement route guards",
      assignedRole: "builder",
    });
    const ws2 = r.createWorkstream({
      missionId: m2.id,
      title: "Other",
      objective: "Other objective",
      assignedRole: "scout",
    });
    expect("error" in ws1 || "error" in ws2).toBe(false);
    if ("error" in ws1 || "error" in ws2) return;

    const listed = r.listWorkstreams({ missionId: m1.id });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(ws1.id);
    expect(listed[0]?.assignedRole).toBe("builder");
    expect(listed[0]?.objective).toBe("Implement route guards");
  });

  it("creates and updates an AgentRun", () => {
    const m = r.createMission({
      tenantSlug: "bypilar",
      title: "Run mission",
      objective: "Track runs",
      createdBy: "acc_test",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "Runs tracked" }],
    });
    expect("error" in m).toBe(false);
    if ("error" in m) return;

    const run = r.createAgentRun({
      missionId: m.id,
      role: "builder",
      status: "queued",
    });
    expect("error" in run).toBe(false);
    if ("error" in run) return;

    expect(r.getAgentRun(run.id)?.status).toBe("queued");

    const updated = r.updateAgentRun(run.id, { status: "running" });
    expect("error" in updated).toBe(false);
    if ("error" in updated) return;
    expect(updated.status).toBe("running");
    expect(r.listAgentRuns({ missionId: m.id })).toHaveLength(1);
  });

  it("keeps missions, workstreams, and runs isolated across missions", () => {
    const a = r.createMission({
      tenantSlug: "t1",
      title: "A",
      objective: "A-obj",
      createdBy: "u",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "a" }],
    });
    const b = r.createMission({
      tenantSlug: "t1",
      title: "B",
      objective: "B-obj",
      createdBy: "u",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "b" }],
    });
    if ("error" in a || "error" in b) throw new Error("mission create failed");

    r.createWorkstream({
      missionId: a.id,
      title: "WA",
      objective: "WA-obj",
      assignedRole: "builder",
    });
    r.createAgentRun({ missionId: a.id, role: "scout", status: "queued" });
    r.createAgentRun({ missionId: b.id, role: "verifier", status: "queued" });

    expect(r.listWorkstreams({ missionId: a.id })).toHaveLength(1);
    expect(r.listWorkstreams({ missionId: b.id })).toHaveLength(0);
    expect(r.listAgentRuns({ missionId: a.id })).toHaveLength(1);
    expect(r.listAgentRuns({ missionId: b.id })).toHaveLength(1);
    expect(r.listMissions({ tenantSlug: "t1" })).toHaveLength(2);
  });

  it("rejects invalid budgets and missing required fields", () => {
    const missingTitle = r.createMission({
      tenantSlug: "bypilar",
      title: "  ",
      objective: "Obj",
      createdBy: "u",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "ac" }],
    });
    expect(missingTitle).toMatchObject({ error: "title_required" });

    const missingAc = r.createMission({
      tenantSlug: "bypilar",
      title: "T",
      objective: "Obj",
      createdBy: "u",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [],
    });
    expect(missingAc).toMatchObject({ error: "acceptance_criterion_required" });

    const negBudget = r.createMission({
      tenantSlug: "bypilar",
      title: "T",
      objective: "Obj",
      createdBy: "u",
      riskLevel: "green",
      budgets: { ...baseBudgets, maxTotalTokens: -1 },
      acceptanceCriteria: [{ text: "ac" }],
    });
    expect(negBudget).toMatchObject({ error: "budget_negative_or_invalid" });

    const badAgents = r.createMission({
      tenantSlug: "bypilar",
      title: "T",
      objective: "Obj",
      createdBy: "u",
      riskLevel: "green",
      budgets: { ...baseBudgets, maxAgents: 0 },
      acceptanceCriteria: [{ text: "ac" }],
    });
    expect(badAgents).toMatchObject({ error: "maxAgents_min_1" });

    const badWs = r.createWorkstream({
      missionId: "",
      title: "W",
      objective: "O",
      assignedRole: "builder",
    });
    expect(badWs).toMatchObject({ error: "missionId_required" });

    const badRun = r.createAgentRun({
      missionId: "msn_missing",
      role: "builder",
      status: "queued",
    });
    expect(badRun).toMatchObject({ error: "mission_not_found" });
  });

  it("verifies status updates on mission and workstream", () => {
    const m = r.createMission({
      tenantSlug: "bypilar",
      title: "Status mission",
      objective: "Flip statuses",
      createdBy: "u",
      riskLevel: "green",
      budgets: baseBudgets,
      acceptanceCriteria: [{ text: "status ok" }],
    });
    if ("error" in m) throw new Error(m.error);

    const mUp = r.updateMissionStatus(m.id, "approved");
    expect("error" in mUp).toBe(false);
    if ("error" in mUp) return;
    expect(mUp.status).toBe("approved");
    expect(r.getMission(m.id)?.status).toBe("approved");

    const ws = r.createWorkstream({
      missionId: m.id,
      title: "WS",
      objective: "Do work",
      assignedRole: "builder",
    });
    if ("error" in ws) throw new Error(ws.error);

    const wUp = r.updateWorkstreamStatus(ws.id, "running");
    expect("error" in wUp).toBe(false);
    if ("error" in wUp) return;
    expect(wUp.status).toBe("running");
    expect(r.listWorkstreams({ missionId: m.id })[0]?.status).toBe("running");
  });
});
