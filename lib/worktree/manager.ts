// PraxisOS parallel Git worktree manager (Felix)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export type WorktreeInfo = {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
};

function repoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return process.cwd();
  }
}

function worktreeBase(): string {
  const root = repoRoot();
  const base = join(root, ".praxis-worktrees");
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

export function createAgentWorktree(agentId: string, baseBranch = "main"): WorktreeInfo {
  const safe = agentId.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const branch = `cursor/felix-${safe}-${stamp}-2c11`.toLowerCase();
  const path = resolve(worktreeBase(), `${safe}-${stamp}`);

  // Ensure base exists locally
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

function existsRemote(branch: string): boolean {
  const r = spawnSync("git", ["rev-parse", "--verify", `origin/${branch}`], {
    cwd: repoRoot(),
  });
  return r.status === 0;
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

export function runInWorktree(path: string, command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: path,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
}
