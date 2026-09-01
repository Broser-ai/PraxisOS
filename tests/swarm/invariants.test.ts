import { describe, it, expect, beforeEach } from "vitest";
import {
  SWARM_INVARIANTS,
  enqueueSwarmTask,
  executeSwarmTask,
  getSwarmStatus,
  humanApproveTask,
  resetSwarmMemoryForTests,
  savageRun,
} from "@/lib/swarm";

describe("S-H Swarm · safety invariants", () => {
  beforeEach(() => {
    resetSwarmMemoryForTests();
  });

  it("NO_AUTO_MERGE and NO_AUTO_DEPLOY are locked true", () => {
    expect(SWARM_INVARIANTS.NO_AUTO_MERGE).toBe(true);
    expect(SWARM_INVARIANTS.NO_AUTO_DEPLOY).toBe(true);
  });

  it("research task completes via LUNA without merge", async () => {
    const task = await savageRun({
      type: "research",
      title: "E-learning RLVR fit",
      brief: "Map Lite PPO to anatomy quizzes",
      tenantSlug: "bypilar",
    });
    expect(task.assignedTo).toBe("LUNA_RESEARCH");
    expect(task.status).toBe("completed");
    expect(task.resultSummary).toContain("verifiable-reward");
  });

  it("improve task awaits human", async () => {
    const task = await savageRun({
      type: "improve",
      title: "Self-improve loop",
      brief: "Propose measurable upgrades",
      tenantSlug: "bypilar",
    });
    expect(task.assignedTo).toBe("FELIX_IMPROVE");
    expect(task.status).toBe("awaiting_human");
  });

  it("reject merge without approve token", async () => {
    const task = enqueueSwarmTask({
      type: "audit",
      title: "Gate check",
      brief: "audit",
      tenantSlug: "bypilar",
    });
    await executeSwarmTask(task.id);
    const result = await humanApproveTask({
      taskId: task.id,
      approveToken: "wrong",
      approvedBy: "tester",
    });
    expect("error" in result).toBe(true);
  });

  it("status reports invariants", () => {
    const s = getSwarmStatus();
    expect(s.invariants.NO_AUTO_MERGE).toBe(true);
    expect(s.enabled).toBe(true);
  });
});
