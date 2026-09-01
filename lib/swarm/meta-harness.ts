// ARIA_META · meta-harness for S-H swarm (savage execution, human-gated merge)

import { flushSwarmMemory, getSwarmMemory } from "@/lib/swarm/memory";
import { writeJournal } from "@/lib/swarm/journal";
import { publishSwarmEvent } from "@/lib/swarm/events";
import { runSAgent } from "@/lib/swarm/s-agents";
import { runHBridge } from "@/lib/swarm/h-bridge";
import { approveMergeWorktree } from "@/lib/swarm/worktree-manager";
import {
  SWARM_INVARIANTS,
  type SAgentId,
  type SwarmTask,
  type SwarmTaskType,
} from "@/lib/swarm/types";

function newTaskId(): string {
  return `sw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function routeToAgent(type: SwarmTaskType, brief: string): SAgentId | "H_BRIDGE" {
  switch (type) {
    case "research":
      return "LUNA_RESEARCH";
    case "code":
    case "worktree_exec":
      return "ATLAS_CODE";
    case "improve":
      return "FELIX_IMPROVE";
    case "audit":
      return "FREJ_GATE";
    case "clinical_h":
      return "H_BRIDGE";
    case "rl_eval":
      return "PRIME_RL";
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      // keyword fallback
      const lower = brief.toLowerCase();
      if (lower.includes("research") || lower.includes("paper")) return "LUNA_RESEARCH";
      if (lower.includes("book") || lower.includes("journal")) return "H_BRIDGE";
      if (/\brl\b|rlvr|quiz|verifiable.?reward/.test(lower)) return "PRIME_RL";
      return "ATLAS_CODE";
    }
  }
}

export function isSwarmEnabled(): boolean {
  return process.env.PRAXIS_SWARM_ENABLED !== "false";
}

export function enqueueSwarmTask(input: {
  type: SwarmTaskType;
  title: string;
  brief: string;
  tenantSlug: string;
  priority?: 1 | 2 | 3;
}): SwarmTask {
  const assignedTo = routeToAgent(input.type, input.brief);
  const now = new Date().toISOString();
  const task: SwarmTask = {
    id: newTaskId(),
    type: input.type,
    title: input.title,
    brief: input.brief,
    tenantSlug: input.tenantSlug,
    priority: input.priority ?? 2,
    assignedTo,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    humanApprovalRequired: true,
  };
  getSwarmMemory().tasks.unshift(task);
  writeJournal({
    agent: "ARIA_META",
    kind: "action",
    taskId: task.id,
    content: `Queued ${task.type} → ${task.assignedTo}: ${task.title}`,
  });
  return task;
}

export async function executeSwarmTask(taskId: string): Promise<SwarmTask> {
  const mem = getSwarmMemory();
  const task = mem.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("task_not_found");

  task.status = "running";
  task.updatedAt = new Date().toISOString();

  writeJournal({
    agent: "ARIA_META",
    kind: "thought",
    taskId: task.id,
    content: `Savage execute · agent=${task.assignedTo} · invariants merge=${SWARM_INVARIANTS.NO_AUTO_MERGE} deploy=${SWARM_INVARIANTS.NO_AUTO_DEPLOY}`,
  });

  try {
    if (task.assignedTo === "H_BRIDGE") {
      const h = await runHBridge(task);
      task.resultSummary = h.summary;
      task.status = h.status === "completed" ? "completed" : "failed";
      if (h.status === "failed") task.error = h.summary;
    } else {
      const result = await runSAgent(task.assignedTo, task);
      task.resultSummary = result.summary;
      task.artifacts = result.artifacts;
      task.status = result.needsHuman ? "awaiting_human" : "completed";
      if (task.assignedTo === "ATLAS_CODE") {
        const wt = mem.worktrees.find((w) => w.taskId === task.id);
        if (wt) {
          task.worktreePath = wt.path;
          task.branchName = wt.branchName;
        }
      }
    }
  } catch (err) {
    task.status = "failed";
    task.error = err instanceof Error ? err.message : String(err);
    writeJournal({
      agent: "ARIA_META",
      kind: "result",
      taskId: task.id,
      content: `Task failed: ${task.error}`,
    });
  }

  task.updatedAt = new Date().toISOString();
  publishSwarmEvent({ type: "task", task });
  flushSwarmMemory();
  return task;
}

/** Enqueue + immediately execute (savage mode). */
export async function savageRun(input: {
  type: SwarmTaskType;
  title: string;
  brief: string;
  tenantSlug: string;
  priority?: 1 | 2 | 3;
}): Promise<SwarmTask> {
  const task = enqueueSwarmTask(input);
  return executeSwarmTask(task.id);
}

export function listSwarmTasks(tenantSlug?: string): SwarmTask[] {
  const tasks = getSwarmMemory().tasks;
  return tenantSlug ? tasks.filter((t) => t.tenantSlug === tenantSlug) : tasks;
}

export async function humanApproveTask(input: {
  taskId: string;
  approveToken: string;
  approvedBy: string;
  targetBranch?: string;
}): Promise<SwarmTask | { error: string }> {
  const task = getSwarmMemory().tasks.find((t) => t.id === input.taskId);
  if (!task) return { error: "task_not_found" };

  // Always run FREJ gate before any approval
  await runSAgent("FREJ_GATE", task);

  const expected =
    process.env.SWARM_APPROVE_TOKEN ||
    (process.env.NODE_ENV === "production" ? null : "I-APPROVE-MERGE");
  if (!expected || input.approveToken !== expected) {
    task.status = "rejected";
    task.error = "invalid_approve_token";
    task.updatedAt = new Date().toISOString();
    writeJournal({
      agent: "FREJ_GATE",
      kind: "gate",
      taskId: task.id,
      content: "Approve REJECTED — invalid token (NO_AUTO_MERGE)",
    });
    return { error: "invalid_approve_token" };
  }

  if (task.branchName || task.worktreePath) {
    const merge = await approveMergeWorktree({
      taskId: task.id,
      approveToken: input.approveToken,
      approvedBy: input.approvedBy,
      targetBranch: input.targetBranch,
    });
    if ("error" in merge) {
      task.status = "rejected";
      task.error = merge.error;
      task.updatedAt = new Date().toISOString();
      return { error: merge.error };
    }
  }

  task.status = "completed";
  task.approvedBy = input.approvedBy;
  task.approvedAt = new Date().toISOString();
  task.updatedAt = task.approvedAt;
  writeJournal({
    agent: "ARIA_META",
    kind: "gate",
    taskId: task.id,
    content: `Human approved by ${input.approvedBy}`,
  });
  return task;
}

export function getSwarmStatus() {
  const mem = getSwarmMemory();
  return {
    enabled: isSwarmEnabled(),
    invariants: SWARM_INVARIANTS,
    tasks: mem.tasks.length,
    byStatus: mem.tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {}),
    worktrees: mem.worktrees.filter((w) => w.status === "active" || w.status === "ready_for_review").length,
    journals: mem.journals.length,
  };
}
