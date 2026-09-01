// S-agents · software specialists for savage worktree execution

import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  formatFindingForJournal,
  runResearchHarvest,
} from "@/lib/alphaxiv";
import type { ResearchTrackId } from "@/lib/alphaxiv/types";
import { runPrimeForSwarmTask } from "@/lib/prime/swarm-bridge";
import { CLINICAL_POLICY } from "@/lib/swarm/clinical-policy";
import { writeJournal } from "@/lib/swarm/journal";
import { getShadowGateSnapshot } from "@/lib/swarm/shadow-gates";
import { SWARM_INVARIANTS, type SAgentId, type SwarmTask } from "@/lib/swarm/types";
import {
  createWorktreeForTask,
  markWorktreeReadyForReview,
} from "@/lib/swarm/worktree-manager";

const execFileAsync = promisify(execFile);

export type SAgentResult = {
  summary: string;
  artifacts: string[];
  needsHuman: boolean;
};

function inferTrack(brief: string, title: string): ResearchTrackId {
  const t = `${brief} ${title}`.toLowerCase();
  if (/(nail|sss|manicure|atelier)/.test(t)) return "nail_materials";
  if (/(scan|mesh|orthotic|foot|3d)/.test(t)) return "foot_scanner";
  if (/(vlm|yolo|roboflow|lesion|sam)/.test(t)) return "vlm_detection";
  if (/(mdr|ce-mark|shadow|drift|audit)/.test(t)) return "mdr_safety";
  if (/(swarm|agent|worktree|harness)/.test(t)) return "agent_swarm";
  if (/(learn|tutor|quiz|rl|reward)/.test(t)) return "rl_elearning";
  return "rl_elearning";
}

async function lunaResearch(task: SwarmTask): Promise<SAgentResult> {
  writeJournal({
    agent: "LUNA_RESEARCH",
    kind: "thought",
    taskId: task.id,
    content: `Alphaxiv harvest · ${task.title}`,
  });

  const trackId = inferTrack(task.brief, task.title);
  const finding = await runResearchHarvest({
    trackId,
    query: task.brief || task.title,
    limit: 6,
  });

  writeJournal({
    agent: "LUNA_RESEARCH",
    kind: "result",
    taskId: task.id,
    content: formatFindingForJournal(finding),
    meta: {
      track: finding.track,
      live: finding.live,
      papers: finding.papers.map((p) => p.arxivId),
    },
  });

  return {
    summary: [
      `Track: ${finding.track} · live=${finding.live}`,
      ...finding.papers.slice(0, 5).map((p) => `- ${p.arxivId}: ${p.title}`),
      "",
      "Actions:",
      ...finding.extractedActions.map((a) => `- ${a}`),
    ].join("\n"),
    artifacts: [
      `research/${task.id}.md`,
      ...finding.papers.slice(0, 3).map((p) => p.url),
    ],
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
      "- Alphaxiv findings are citations, not auto-implemented code",
      "",
      "## Proposed steps",
      "1. Extend working-core data path if needed",
      "2. Add/adjust H-agent tools via MCP",
      "3. Vitest for invariants",
      "4. Human review → approve token → PR merge",
      "",
    ].join("\n"),
    "utf8",
  );

  let committed = false;
  try {
    await execFileAsync("git", ["add", "docs/swarm-plans"], { cwd: wt.path });
    await execFileAsync(
      "git",
      ["commit", "-m", `swarm(atlas): plan ${task.id} — ${task.title.slice(0, 60)}`],
      { cwd: wt.path },
    );
    committed = true;
  } catch {
    committed = false;
  }

  await markWorktreeReadyForReview(task.id);

  writeJournal({
    agent: "ATLAS_CODE",
    kind: "result",
    taskId: task.id,
    content: committed
      ? `Plan git-committed in worktree ${wt.branchName}`
      : `Plan written (git commit skipped) in ${wt.branchName}`,
    meta: { branchName: wt.branchName, path: wt.path, committed },
  });

  return {
    summary: committed
      ? `Worktree ${wt.branchName} has committed plan — awaiting human PR approve`
      : `Worktree ${wt.branchName} has plan file — awaiting human review`,
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
    "Persist swarm journals to Supabase swarm_snapshots when configured",
    "Rate-limit swarm task creation per tenant",
    "Expand Alphaxiv harvest tracks when ALPHAXIV_API_KEY is set",
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
  const shadow = getShadowGateSnapshot();
  const checks = [
    SWARM_INVARIANTS.NO_AUTO_MERGE === true,
    SWARM_INVARIANTS.NO_AUTO_DEPLOY === true,
    CLINICAL_POLICY.clinical_status === "suggestion_only",
    CLINICAL_POLICY.approved_for_active_routing === false,
    shadow.safeForNonVisionSwarm === true,
  ];
  const ok = checks.every(Boolean);

  writeJournal({
    agent: "FREJ_GATE",
    kind: "gate",
    taskId: task.id,
    content: ok
      ? `Compliance gate OK · clinical=${CLINICAL_POLICY.clinical_status} · shadowFlag=${shadow.shadowEvalFlag} · privacy=${shadow.privacyAllowed} · visionWouldRun=${shadow.visionShadowWouldRun}`
      : "Compliance gate FAIL — invariant or clinical policy broken",
    meta: {
      shadow,
      clinicalPolicy: CLINICAL_POLICY,
      invariants: SWARM_INVARIANTS,
    },
  });

  return {
    summary: ok
      ? "FREJ gate OK — suggestion-only clinical · human approval still required for merge/deploy · shadow gates read-only"
      : "FREJ gate FAIL — do not approve",
    artifacts: [`shadow_gates/${task.id}.json`],
    needsHuman: true,
  };
}

async function primeRl(task: SwarmTask): Promise<SAgentResult> {
  writeJournal({
    agent: "PRIME_RL",
    kind: "thought",
    taskId: task.id,
    content: `RLVR cycle · class_0 education · NO_MODEL_TRAINING · ${task.title}`,
  });

  const signal = runPrimeForSwarmTask(task);

  writeJournal({
    agent: "PRIME_RL",
    kind: "learning",
    taskId: task.id,
    content: signal.result.summary,
    meta: {
      meanReward: signal.result.meanReward,
      proposals: signal.result.proposals.map((p) => p.id),
      pack: signal.pack,
      ok: signal.result.ok,
      clinical_status: CLINICAL_POLICY.clinical_status,
    },
  });

  return {
    summary: signal.result.summary,
    artifacts: [
      `prime/rlvr/${task.id}.json`,
      ...signal.result.proposals.map((p) => `prime/policy/${p.id}`),
    ],
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
    case "PRIME_RL":
      return primeRl(task);
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
