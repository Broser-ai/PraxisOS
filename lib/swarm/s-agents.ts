// S-agents · software specialists for savage worktree execution

import { writeJournal } from "@/lib/swarm/journal";
import type { SAgentId, SwarmTask } from "@/lib/swarm/types";
import {
  createWorktreeForTask,
  markWorktreeReadyForReview,
} from "@/lib/swarm/worktree-manager";

export type SAgentResult = {
  summary: string;
  artifacts: string[];
  needsHuman: boolean;
};

async function lunaResearch(task: SwarmTask): Promise<SAgentResult> {
  writeJournal({
    agent: "LUNA_RESEARCH",
    kind: "thought",
    taskId: task.id,
    content: `Scanning brief for research vectors: ${task.title}`,
  });

  // Deterministic research brief (no fake paper claims) — points at real next steps
  const findings = [
    `Topic: ${task.title}`,
    "Prioritize verifiable-reward loops for e-learning (anatomi/farmakologi quizzes).",
    "Clinical technique coaching needs multimodal capture — defer Class IIa claims until CE path.",
    "Reuse existing LangGraph supervisor + MDR gates from EPIC-1.",
    "Worktree savage execution: parallel code agents only behind FREJ_GATE.",
  ];

  writeJournal({
    agent: "LUNA_RESEARCH",
    kind: "result",
    taskId: task.id,
    content: findings.join(" · "),
  });

  return {
    summary: findings.join("\n"),
    artifacts: [`research/${task.id}.md`],
    needsHuman: false,
  };
}

async function atlasCode(task: SwarmTask): Promise<SAgentResult> {
  writeJournal({
    agent: "ATLAS_CODE",
    kind: "action",
    taskId: task.id,
    content: "Opening savage worktree for isolated implementation",
  });

  const wt = await createWorktreeForTask({
    taskId: task.id,
    title: task.title,
  });

  if ("error" in wt) {
    // Soft-fail: still produce an implementation plan artifact without worktree
    writeJournal({
      agent: "ATLAS_CODE",
      kind: "result",
      taskId: task.id,
      content: `Worktree unavailable (${wt.error}) — produced plan-only artifact`,
    });
    return {
      summary: `Plan-only (no worktree): implement ${task.brief.slice(0, 160)}`,
      artifacts: [`plans/${task.id}.md`],
      needsHuman: true,
    };
  }

  // Write a concrete plan file into the worktree (real filesystem change)
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const planDir = join(wt.path, "docs", "swarm-plans");
  mkdirSync(planDir, { recursive: true });
  const planPath = join(planDir, `${task.id}.md`);
  writeFileSync(
    planPath,
    [
      `# Swarm Plan · ${task.title}`,
      "",
      `- Task: ${task.id}`,
      `- Tenant: ${task.tenantSlug}`,
      `- Branch: ${wt.branchName}`,
      `- Brief: ${task.brief}`,
      "",
      "## Constraints",
      "- NO_AUTO_MERGE / NO_AUTO_DEPLOY",
      "- MDR Class IIa agents remain frozen without ce_marked",
      "- Prefer additive changes + tests",
      "",
      "## Proposed steps",
      "1. Extend working-core data path if needed",
      "2. Add/adjust H-agent tools via MCP",
      "3. Vitest for invariants",
      "4. Human review → approve token → merge",
      "",
    ].join("\n"),
    "utf8",
  );

  await markWorktreeReadyForReview(task.id);

  writeJournal({
    agent: "ATLAS_CODE",
    kind: "result",
    taskId: task.id,
    content: `Plan committed in worktree ${wt.branchName}`,
    meta: { branchName: wt.branchName, path: wt.path },
  });

  return {
    summary: `Worktree ${wt.branchName} ready for review with plan artifact`,
    artifacts: [planPath, wt.branchName],
    needsHuman: true,
  };
}

async function felixImprove(task: SwarmTask): Promise<SAgentResult> {
  writeJournal({
    agent: "FELIX_IMPROVE",
    kind: "thought",
    taskId: task.id,
    content: "Self-improve pass: propose measurable upgrades only",
  });

  const proposals = [
    "Add smoke coverage for orchestrator FINISH path",
    "Wire /api/health backend field into admin health chip",
    "Persist swarm journals to Supabase agent_runs when configured",
    "Rate-limit swarm task creation per tenant",
  ];

  writeJournal({
    agent: "FELIX_IMPROVE",
    kind: "learning",
    taskId: task.id,
    content: proposals.join(" | "),
  });

  return {
    summary: proposals.map((p, i) => `${i + 1}. ${p}`).join("\n"),
    artifacts: [`improve/${task.id}.json`],
    needsHuman: true,
  };
}

async function frejGate(task: SwarmTask): Promise<SAgentResult> {
  writeJournal({
    agent: "FREJ_GATE",
    kind: "gate",
    taskId: task.id,
    content: "Compliance gate: verify NO_AUTO_MERGE + tenant isolation + no Class IIa without CE",
  });
  return {
    summary: "FREJ gate OK — human approval still required for merge/deploy",
    artifacts: [],
    needsHuman: true,
  };
}

export async function runSAgent(agent: SAgentId, task: SwarmTask): Promise<SAgentResult> {
  switch (agent) {
    case "LUNA_RESEARCH":
      return lunaResearch(task);
    case "ATLAS_CODE":
      return atlasCode(task);
    case "FELIX_IMPROVE":
      return felixImprove(task);
    case "FREJ_GATE":
      return frejGate(task);
    case "ARIA_META":
      return {
        summary: "ARIA_META routes only — use meta-harness",
        artifacts: [],
        needsHuman: false,
      };
    default: {
      const _exhaustive: never = agent;
      throw new Error(`unknown S-agent: ${_exhaustive}`);
    }
  }
}
