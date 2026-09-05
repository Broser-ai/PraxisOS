// Agent safety guard.
// Fails if a change to active repository files weakens the hard invariants that
// keep coding agents from merging, deploying or relaxing clinical policy.
//
// Scope note: docs, tests and AGENTS.md describe these rules in prose and are
// deliberately not scanned — only runtime code, CI workflows and compose files.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { SWARM_INVARIANTS } from "@/lib/swarm/types";
import { PRIME_INVARIANTS } from "@/lib/prime/types";
import { CLINICAL_POLICY } from "@/lib/swarm/clinical-policy";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "lib", "components", "agents", "modules", "scripts"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".worktrees",
  ".swarm-data",
  "coverage",
]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** Assignments that would turn a hard invariant off. */
const DISABLED_INVARIANT =
  /\b(NO_AUTO_MERGE|NO_AUTO_DEPLOY|NO_AUTO_JOURNAL_SIGN|NO_MODEL_TRAINING|PATHOLOGY_SHADOW_UNTIL_GATES|AI_SUGGESTIONS_ONLY|HUMAN_ADJUDICATION_REQUIRED)\b\s*[:=]\s*false/;

/** CI steps that would merge or deploy without a human. */
const AUTO_MERGE_STEP =
  /(gh\s+pr\s+merge[^\n]*--auto|enable-pull-request-automerge|automerge:\s*true|merge_method)/i;
const AUTO_DEPLOY_STEP =
  /(vercel[^\n]*--prod|amondnet\/vercel-action|appleboy\/ssh-action|docker[^\n]*compose[^\n]*up[^\n]*-d)/i;

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

function codeFiles(): string[] {
  const out: string[] = [];
  for (const dir of SCAN_DIRS) {
    const full = join(ROOT, dir);
    if (existsSync(full)) walk(full, out);
  }
  const middleware = join(ROOT, "middleware.ts");
  if (existsSync(middleware)) out.push(middleware);
  return out.filter((f) => CODE_EXT.test(f));
}

function workflowFiles(): string[] {
  const dir = join(ROOT, ".github", "workflows");
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  walk(dir, out);
  return out.filter((f) => /\.ya?ml$/i.test(f));
}

describe("Agent safety · hard invariants", () => {
  it("swarm invariants stay enabled", () => {
    expect(SWARM_INVARIANTS.NO_AUTO_MERGE).toBe(true);
    expect(SWARM_INVARIANTS.NO_AUTO_DEPLOY).toBe(true);
  });

  it("prime clinical invariants stay enabled", () => {
    expect(PRIME_INVARIANTS.NO_MODEL_TRAINING).toBe(true);
    expect(PRIME_INVARIANTS.NO_AUTONOMOUS_CLINICAL).toBe(true);
    expect(PRIME_INVARIANTS.PATHOLOGY_SHADOW_UNTIL_GATES).toBe(true);
    expect(PRIME_INVARIANTS.AI_SUGGESTIONS_ONLY).toBe(true);
    expect(PRIME_INVARIANTS.HUMAN_ADJUDICATION_REQUIRED).toBe(true);
  });

  it("clinical suggestion-only invariants stay enabled", () => {
    expect(CLINICAL_POLICY.clinical_status).toBe("suggestion_only");
    expect(CLINICAL_POLICY.NO_AUTO_JOURNAL_SIGN).toBe(true);
  });

  it("CI workflow keeps typecheck, tests and build", () => {
    const ci = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).toMatch(/npm run typecheck/);
    expect(ci).toMatch(/\bnpm test\b/);
    expect(ci).toMatch(/npm run build/);
  });

  it("no runtime file disables an invariant", () => {
    const hits: string[] = [];
    for (const file of codeFiles()) {
      const text = readFileSync(file, "utf8");
      if (DISABLED_INVARIANT.test(text)) hits.push(relative(ROOT, file));
    }
    expect(hits).toEqual([]);
  });

  it("no CI workflow auto-merges or auto-deploys", () => {
    const merge: string[] = [];
    const deploy: string[] = [];
    for (const file of workflowFiles()) {
      const text = readFileSync(file, "utf8");
      if (AUTO_MERGE_STEP.test(text)) merge.push(relative(ROOT, file));
      if (AUTO_DEPLOY_STEP.test(text)) deploy.push(relative(ROOT, file));
    }
    expect({ merge, deploy }).toEqual({ merge: [], deploy: [] });
  });

  it("detectors flag real violations (negative regression)", () => {
    expect(DISABLED_INVARIANT.test("NO_AUTO_MERGE: false,")).toBe(true);
    expect(DISABLED_INVARIANT.test("PATHOLOGY_SHADOW_UNTIL_GATES = false")).toBe(true);
    expect(AUTO_MERGE_STEP.test("run: gh pr merge 42 --auto --squash")).toBe(true);
    expect(AUTO_DEPLOY_STEP.test("run: vercel deploy --prod")).toBe(true);
  });

  it("detectors ignore prose that describes the ban", () => {
    expect(DISABLED_INVARIANT.test("Never set NO_AUTO_MERGE to false.")).toBe(false);
    expect(AUTO_MERGE_STEP.test("No agent may merge to main.")).toBe(false);
  });
});
