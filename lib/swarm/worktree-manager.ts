// Git worktree manager for savage parallel execution.
// SAFETY: creates branches + worktrees only. Merge to main is NEVER automatic.

import { execFile } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { appendAgentLedger } from "@/lib/agents/ledger";
import { getSwarmMemory } from "@/lib/swarm/memory";
import { writeJournal } from "@/lib/swarm/journal";
import { SWARM_INVARIANTS, type WorktreeJob } from "@/lib/swarm/types";
import {
  cleanupAgentWorktrees,
  getWorktreeStatus,
  listWorktrees,
  type WorktreeStatus,
} from "@/lib/worktree/manager";

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

/** All tracked swarm worktree jobs (any status). */
export function listWorktreeJobs(opts?: {
  status?: WorktreeJob["status"];
}): WorktreeJob[] {
  const jobs = getSwarmMemory().worktrees;
  return opts?.status ? jobs.filter((j) => j.status === opts.status) : [...jobs];
}

/** Git porcelain + swarm job status for one task or branch. */
export function getSwarmWorktreeStatus(
  taskIdOrBranch: string,
): { job: WorktreeJob | null; git: WorktreeStatus | null } {
  const mem = getSwarmMemory();
  const job =
    mem.worktrees.find(
      (w) => w.taskId === taskIdOrBranch || w.branchName === taskIdOrBranch,
    ) ?? null;
  const git = getWorktreeStatus(job?.path ?? job?.branchName ?? taskIdOrBranch);
  return { job, git };
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
  appendAgentLedger({
    agent: "ATLAS_CODE",
    workflow: "swarm_worktree",
    event: "worktree_create",
    payload: { taskId: input.taskId, branchName, path },
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
  appendAgentLedger({
    agent: "FREJ_GATE",
    workflow: "swarm_worktree",
    event: "human_approve_pr_intent",
    payload: {
      taskId: input.taskId,
      approvedBy: input.approvedBy,
      target,
      branchName: job.branchName,
      noAutoMerge: true,
    },
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
  appendAgentLedger({
    agent: "SYSTEM",
    workflow: "swarm_worktree",
    event: "worktree_discard",
    payload: { taskId, branchName: job.branchName },
  });
}

/**
 * Cleanup discarded/merged swarm jobs + orphaned git worktrees under .worktrees.
 * Does not merge. Does not touch primary checkout.
 */
export async function cleanupSwarmWorktrees(opts?: {
  discardReady?: boolean;
  orphanedOnly?: boolean;
}): Promise<{ discarded: string[]; removedGit: string[] }> {
  const mem = getSwarmMemory();
  const discarded: string[] = [];
  const statuses: WorktreeJob["status"][] = opts?.discardReady
    ? ["merged", "discarded", "ready_for_review"]
    : ["merged", "discarded"];

  for (const job of [...mem.worktrees]) {
    if (!statuses.includes(job.status) && job.status !== "active") continue;
    if (job.status === "active") {
      // only drop active if path missing (orphan)
      if (existsSync(job.path)) continue;
    }
    if (job.status === "ready_for_review" && !opts?.discardReady) continue;
    if (job.status === "merged" || job.status === "discarded" || !existsSync(job.path)) {
      await discardWorktree(job.taskId);
      discarded.push(job.branchName);
    }
  }

  const { removed } = cleanupAgentWorktrees({
    branchIncludes: "swarm",
    orphanedOnly: opts?.orphanedOnly ?? false,
  });

  // Reconcile memory against live git worktrees
  const live = new Set(listWorktrees().map((t) => t.branch));
  for (const job of mem.worktrees) {
    if (
      (job.status === "active" || job.status === "ready_for_review") &&
      !live.has(job.branchName) &&
      !existsSync(job.path)
    ) {
      job.status = "discarded";
      discarded.push(job.branchName);
    }
  }

  return { discarded: [...new Set(discarded)], removedGit: removed };
}
