// PraxisOS parallel Git worktree manager (Felix + Swarm sessions)
// create / list / status / cleanup — merge to main is NEVER automatic.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export type WorktreeInfo = {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
};

export type WorktreeStatus = WorktreeInfo & {
  dirty: boolean;
  ahead: number;
  behind: number;
  lastCommitAt: string | null;
  existsOnDisk: boolean;
};

export type AgentSessionKind = "felix" | "swarm" | "atlas" | "generic";

function repoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return process.cwd();
  }
}

function worktreeBase(kind: AgentSessionKind = "felix"): string {
  const root = repoRoot();
  const base =
    kind === "swarm" || kind === "atlas"
      ? join(root, ".worktrees")
      : join(root, ".praxis-worktrees");
  if (!existsSync(base)) mkdirSync(base, { recursive: true });
  return base;
}

export function listWorktrees(): WorktreeInfo[] {
  const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot(),
    encoding: "utf8",
  });
  const blocks = out.split("\n\n").filter(Boolean);
  const items: WorktreeInfo[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const pathLine = lines.find((l) => l.startsWith("worktree "));
    const headLine = lines.find((l) => l.startsWith("HEAD "));
    const branchLine = lines.find((l) => l.startsWith("branch "));
    if (!pathLine) continue;
    items.push({
      path: pathLine.slice("worktree ".length),
      head: headLine?.slice("HEAD ".length) ?? "",
      branch: branchLine?.slice("branch refs/heads/".length) ?? "(detached)",
      bare: lines.includes("bare"),
    });
  }
  return items;
}

function existsRemote(branch: string): boolean {
  const r = spawnSync("git", ["rev-parse", "--verify", `origin/${branch}`], {
    cwd: repoRoot(),
  });
  return r.status === 0;
}

export function createAgentWorktree(
  agentId: string,
  baseBranch = "main",
  opts?: { kind?: AgentSessionKind; branchName?: string },
): WorktreeInfo {
  const kind = opts?.kind ?? "felix";
  const safe = agentId.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const branch =
    opts?.branchName ??
    (kind === "swarm" || kind === "atlas"
      ? `cursor/swarm-${safe}-${stamp}-2c11`.toLowerCase()
      : `cursor/felix-${safe}-${stamp}-2c11`.toLowerCase());
  const path = resolve(worktreeBase(kind), `${safe}-${stamp}`);

  spawnSync("git", ["fetch", "origin", baseBranch], { cwd: repoRoot() });
  const startPoint = existsRemote(baseBranch) ? `origin/${baseBranch}` : baseBranch;

  execFileSync(
    "git",
    ["worktree", "add", "-b", branch, path, startPoint],
    { cwd: repoRoot(), encoding: "utf8" },
  );

  return {
    path,
    branch,
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: path, encoding: "utf8" }).trim(),
    bare: false,
  };
}

export function getWorktreeStatus(pathOrBranch: string): WorktreeStatus | null {
  const trees = listWorktrees();
  const match = trees.find(
    (t) =>
      t.path === pathOrBranch ||
      t.branch === pathOrBranch ||
      t.path.endsWith(pathOrBranch) ||
      t.branch.endsWith(pathOrBranch),
  );
  if (!match) return null;

  const existsOnDisk = existsSync(match.path);
  let dirty = false;
  let ahead = 0;
  let behind = 0;
  let lastCommitAt: string | null = null;

  if (existsOnDisk) {
    try {
      const porcelain = execFileSync("git", ["status", "--porcelain"], {
        cwd: match.path,
        encoding: "utf8",
      });
      dirty = porcelain.trim().length > 0;
    } catch {
      dirty = false;
    }
    try {
      const counts = execFileSync(
        "git",
        ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
        { cwd: match.path, encoding: "utf8" },
      ).trim();
      const [a, b] = counts.split(/\s+/).map((n) => Number(n) || 0);
      ahead = a ?? 0;
      behind = b ?? 0;
    } catch {
      // no upstream
    }
    try {
      lastCommitAt = execFileSync("git", ["log", "-1", "--format=%cI"], {
        cwd: match.path,
        encoding: "utf8",
      }).trim();
    } catch {
      lastCommitAt = null;
    }
  }

  return { ...match, dirty, ahead, behind, lastCommitAt, existsOnDisk };
}

export function removeAgentWorktree(pathOrBranch: string): void {
  const root = repoRoot();
  const trees = listWorktrees();
  const match = trees.find(
    (t) => t.path === pathOrBranch || t.branch === pathOrBranch || t.path.endsWith(pathOrBranch),
  );
  if (!match) return;
  execFileSync("git", ["worktree", "remove", "--force", match.path], {
    cwd: root,
    encoding: "utf8",
  });
  try {
    rmSync(match.path, { recursive: true, force: true });
  } catch {
    // already removed
  }
}

/**
 * Remove agent worktrees under .praxis-worktrees / .worktrees that match filter.
 * Never touches the primary checkout. Never merges.
 */
export function cleanupAgentWorktrees(opts?: {
  /** Only remove branches matching this substring (default: felix|swarm) */
  branchIncludes?: string;
  /** Also remove when path missing on disk */
  orphanedOnly?: boolean;
}): { removed: string[] } {
  const needle = (opts?.branchIncludes ?? "felix|swarm").toLowerCase();
  const patterns = needle.split("|").map((p) => p.trim()).filter(Boolean);
  const removed: string[] = [];
  const primary = repoRoot();

  for (const t of listWorktrees()) {
    if (t.path === primary || t.bare) continue;
    const hit = patterns.some(
      (p) => t.branch.toLowerCase().includes(p) || t.path.toLowerCase().includes(p),
    );
    if (!hit) continue;
    if (opts?.orphanedOnly && existsSync(t.path)) continue;
    try {
      removeAgentWorktree(t.path);
      removed.push(t.branch);
    } catch {
      // best-effort
    }
  }
  return { removed };
}

export function runInWorktree(path: string, command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: path,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
}
