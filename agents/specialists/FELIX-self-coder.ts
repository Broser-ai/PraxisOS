// FELIX · auto-coding agent using Git worktrees (PraxisOS swarm)
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createAgentWorktree,
  listWorktrees,
  removeAgentWorktree,
  runInWorktree,
  type WorktreeInfo,
} from "@/lib/worktree/manager";
import { remember } from "@/agents/memory/swarm-memory";
import { reflect } from "@/agents/journal/journal-engine";

export const FELIX_ID = "felix" as const;

export type FelixTask = {
  title: string;
  relativePath: string;
  contents: string;
  baseBranch?: string;
  commit?: boolean;
};

export type FelixResult = {
  ok: boolean;
  worktree?: WorktreeInfo;
  writtenPath?: string;
  commitSha?: string;
  error?: string;
};

export async function felixImplement(task: FelixTask, tenant = "bypilar"): Promise<FelixResult> {
  let wt: WorktreeInfo | undefined;
  try {
    wt = createAgentWorktree(FELIX_ID, task.baseBranch ?? "main");
    const full = join(wt.path, task.relativePath);
    const dir = full.slice(0, full.lastIndexOf("/"));
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(full, task.contents, "utf8");

    let commitSha: string | undefined;
    if (task.commit !== false) {
      runInWorktree(wt.path, "git", ["add", task.relativePath]);
      runInWorktree(wt.path, "git", [
        "commit",
        "-m",
        `felix: ${task.title.slice(0, 72)}`,
        "--no-gpg-sign",
      ]);
      commitSha = runInWorktree(wt.path, "git", ["rev-parse", "HEAD"]).trim();
    }

    await remember({
      kind: "code",
      tenant,
      text: `FELIX skrev ${task.relativePath} i worktree ${wt.branch}`,
      meta: { agent: FELIX_ID, branch: wt.branch, commitSha },
    });
    await reflect({
      agentId: FELIX_ID,
      tenant,
      prompt: task.title,
      outcome: `committed ${task.relativePath}`,
      score: 0.8,
    });

    return { ok: true, worktree: wt, writtenPath: full, commitSha };
  } catch (err) {
    const message = err instanceof Error ? err.message : "felix_failed";
    await reflect({
      agentId: FELIX_ID,
      tenant,
      prompt: task.title,
      outcome: `error: ${message}`,
      score: 0.2,
    });
    return { ok: false, worktree: wt, error: message };
  }
}

export function felixListWorktrees() {
  return listWorktrees().filter((t) => t.branch.includes("felix") || t.path.includes("felix"));
}

export function felixCleanup(pathOrBranch: string) {
  removeAgentWorktree(pathOrBranch);
}
