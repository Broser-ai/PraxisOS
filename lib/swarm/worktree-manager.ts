// Git worktree manager for savage parallel execution.
// SAFETY: creates branches + worktrees only. Merge to main is NEVER automatic.

import { execFile } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { getSwarmMemory } from "@/lib/swarm/memory";
import { writeJournal } from "@/lib/swarm/journal";
import { SWARM_INVARIANTS, type WorktreeJob } from "@/lib/swarm/types";

const execFileAsync = promisify(execFile);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
}

export function makeSwarmBranchName(title: string): string {
  return `${SWARM_INVARIANTS.BRANCH_PREFIX}${slugify(title) || "task"}${SWARM_INVARIANTS.BRANCH_SUFFIX}`;
}

async function git(args: string[], cwd = process.cwd()): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

export async function listActiveWorktrees(): Promise<WorktreeJob[]> {
  return getSwarmMemory().worktrees.filter((w) => w.status === "active" || w.status === "ready_for_review");
}

/**
 * Create an isolated git worktree for a swarm task.
 * Returns null if MAX_WORKTREES exceeded or git unavailable.
 */
export async function createWorktreeForTask(input: {
  taskId: string;
  title: string;
  baseRef?: string;
}): Promise<WorktreeJob | { error: string }> {
  const mem = getSwarmMemory();
  const active = mem.worktrees.filter((w) => w.status === "active" || w.status === "ready_for_review");
  if (active.length >= SWARM_INVARIANTS.MAX_WORKTREES) {
    return { error: `max_worktrees_${SWARM_INVARIANTS.MAX_WORKTREES}` };
  }

  const branchName = makeSwarmBranchName(input.title);
  const root = join(process.cwd(), SWARM_INVARIANTS.WORKTREE_ROOT);
  const path = join(root, branchName.replace(/\//g, "__"));

  if (mem.worktrees.some((w) => w.branchName === branchName && w.status !== "discarded")) {
    return { error: "branch_exists" };
  }

  try {
    mkdirSync(root, { recursive: true });
    const base = input.baseRef ?? "HEAD";
    // Create branch without checking it out in main worktree
    await git(["branch", branchName, base]);
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
    await git(["worktree", "add", path, branchName]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeJournal({
      agent: "SYSTEM",
      kind: "gate",
      taskId: input.taskId,
      content: `Worktree create failed: ${message}`,
    });
    return { error: message.slice(0, 200) };
  }

  const job: WorktreeJob = {
    taskId: input.taskId,
    branchName,
    path,
    createdAt: new Date().toISOString(),
    status: "active",
  };
  mem.worktrees.unshift(job);
  writeJournal({
    agent: "ATLAS_CODE",
    kind: "action",
    taskId: input.taskId,
    content: `Worktree ready · ${branchName} @ ${path}`,
    meta: { branchName, path },
  });
  return job;
}

export async function markWorktreeReadyForReview(taskId: string): Promise<WorktreeJob | null> {
  const job = getSwarmMemory().worktrees.find((w) => w.taskId === taskId);
  if (!job) return null;
  job.status = "ready_for_review";
  writeJournal({
    agent: "FREJ_GATE",
    kind: "gate",
    taskId,
    content: "Worktree marked ready_for_review — awaiting human approve (NO_AUTO_MERGE)",
  });
  return job;
}

/**
 * Explicit human-gated merge. Requires approveToken === process.env.SWARM_APPROVE_TOKEN
 * or "I-APPROVE-MERGE" in non-production for local demos.
 * Never merges to main without this gate.
 */
export async function approveMergeWorktree(input: {
  taskId: string;
  approveToken: string;
  targetBranch?: string;
  approvedBy: string;
}): Promise<{ ok: true; mergedInto: string } | { error: string }> {
  if (SWARM_INVARIANTS.NO_AUTO_MERGE !== true) {
    return { error: "invariant_broken_no_auto_merge" };
  }

  const expected =
    process.env.SWARM_APPROVE_TOKEN ||
    (process.env.NODE_ENV === "production" ? null : "I-APPROVE-MERGE");
  if (!expected || input.approveToken !== expected) {
    writeJournal({
      agent: "FREJ_GATE",
      kind: "gate",
      taskId: input.taskId,
      content: "Merge REJECTED — invalid approve token",
    });
    return { error: "invalid_approve_token" };
  }

  const target = input.targetBranch ?? "main";
  if (target === "main" && process.env.SWARM_ALLOW_MAIN_MERGE !== "1") {
    // Default: even with token, only allow merge into a review branch unless explicitly enabled
    writeJournal({
      agent: "FREJ_GATE",
      kind: "gate",
      taskId: input.taskId,
      content: "Merge to main blocked — set SWARM_ALLOW_MAIN_MERGE=1 for explicit main merges",
    });
    return { error: "main_merge_requires_SWARM_ALLOW_MAIN_MERGE" };
  }

  const job = getSwarmMemory().worktrees.find((w) => w.taskId === input.taskId);
  if (!job) return { error: "worktree_not_found" };

  // Never merge into the running app's checkout from a web request.
  // Approval records intent + marks worktree ready for human/CI PR merge.
  job.status = "merged";
  writeJournal({
    agent: "FREJ_GATE",
    kind: "result",
    taskId: input.taskId,
    content: `Human-approved by ${input.approvedBy} → open PR from ${job.branchName} into ${target} (no auto-merge executed)`,
    meta: { approvedBy: input.approvedBy, target, branchName: job.branchName },
  });
  return { ok: true, mergedInto: target };
}

export async function discardWorktree(taskId: string): Promise<void> {
  const mem = getSwarmMemory();
  const job = mem.worktrees.find((w) => w.taskId === taskId);
  if (!job) return;
  try {
    if (existsSync(job.path)) {
      await git(["worktree", "remove", "--force", job.path]);
    }
  } catch {
    // best-effort
    if (existsSync(job.path)) rmSync(job.path, { recursive: true, force: true });
  }
  job.status = "discarded";
  writeJournal({
    agent: "SYSTEM",
    kind: "action",
    taskId,
    content: `Worktree discarded · ${job.branchName}`,
  });
}
