import { describe, it, expect, beforeEach } from "vitest";
import {
  asClinicalSuggestion,
  assertSuggestionOnlyClinical,
  CLINICAL_POLICY,
  getShadowGateSnapshot,
  makeSwarmBranchName,
  SWARM_INVARIANTS,
  listWorktreeJobs,
  getSwarmWorktreeStatus,
  discardWorktree,
  resetSwarmMemoryForTests,
  savageRun,
} from "@/lib/swarm";
import {
  appendAgentLedger,
  listAgentLedger,
  resetAgentLedgerForTests,
} from "@/lib/agents/ledger";
import { getSwarmMemory } from "@/lib/swarm/memory";
import type { WorktreeJob } from "@/lib/swarm/types";

describe("Swarm + Worktree runtime", () => {
  beforeEach(() => {
    resetSwarmMemoryForTests();
    resetAgentLedgerForTests();
  });

  it("branch naming follows cloud policy", () => {
    const name = makeSwarmBranchName("Atlas Plan Alpha");
    expect(name.startsWith(SWARM_INVARIANTS.BRANCH_PREFIX)).toBe(true);
    expect(name.endsWith(SWARM_INVARIANTS.BRANCH_SUFFIX)).toBe(true);
    expect(name).toBe("cursor/swarm-atlas-plan-alpha-2c11");
  });

  it("clinical policy is suggestion-only locked", () => {
    expect(CLINICAL_POLICY.clinical_status).toBe("suggestion_only");
    expect(CLINICAL_POLICY.approved_for_active_routing).toBe(false);
    const ok = asClinicalSuggestion({ finding: "kandidatområde" });
    expect(assertSuggestionOnlyClinical(ok).ok).toBe(true);
    expect(
      assertSuggestionOnlyClinical({
        ...ok,
        approved_for_active_routing: true,
      }).ok,
    ).toBe(false);
  });

  it("shadow gate snapshot is safe for non-vision swarm", () => {
    const snap = getShadowGateSnapshot({
      ...process.env,
      PRAXIS_SHADOW_EVAL_ENABLED: "false",
    });
    expect(snap.safeForNonVisionSwarm).toBe(true);
    expect(snap.clinicalPolicy.clinical_status).toBe("suggestion_only");
    expect(snap.swarmInvariants.NO_AUTO_MERGE).toBe(true);
  });

  it("list/status/cleanup worktree jobs without auto-merge", async () => {
    const job: WorktreeJob = {
      taskId: "sw_test_1",
      branchName: "cursor/swarm-test-job-2c11",
      path: "/tmp/does-not-exist-swarm-wt",
      createdAt: new Date().toISOString(),
      status: "active",
    };
    getSwarmMemory().worktrees.unshift(job);

    expect(listWorktreeJobs({ status: "active" })).toHaveLength(1);
    const status = getSwarmWorktreeStatus("sw_test_1");
    expect(status.job?.branchName).toBe(job.branchName);
    expect(status.git).toBeNull();

    await discardWorktree("sw_test_1");
    expect(listWorktreeJobs({ status: "discarded" })[0]?.taskId).toBe("sw_test_1");
  });

  it("audit task wires FREJ + ledger via journal", async () => {
    const task = await savageRun({
      type: "audit",
      title: "FREJ pulse",
      brief: "verify clinical suggestion-only + shadow gates",
      tenantSlug: "bypilar",
    });
    expect(task.assignedTo).toBe("FREJ_GATE");
    expect(task.resultSummary).toMatch(/suggestion-only|FREJ gate OK/i);
    expect(task.status).toBe("awaiting_human");

    const ledger = listAgentLedger({ limit: 20 });
    expect(ledger.some((e) => e.event.startsWith("journal_"))).toBe(true);
  });

  it("appendAgentLedger stores local entries", () => {
    appendAgentLedger({
      agent: "ATLAS_CODE",
      event: "worktree_create",
      workflow: "swarm_worktree",
      payload: { branch: "cursor/swarm-x-2c11" },
    });
    expect(listAgentLedger({ agent: "ATLAS_CODE" })[0]?.event).toBe("worktree_create");
  });
});
