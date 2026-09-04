// CI workflow guard.
// A YAML syntax error in .github/workflows/ci.yml is only surfaced by GitHub
// after a push, and shows up as a run that "fails" in 0 seconds without logs.
// This test parses the workflow locally and asserts the required quality gates
// are still wired.
//
// No network, no GitHub API, no secrets.

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = join(__dirname, "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "ci.yml");

type Step = { name?: string; run?: string; uses?: string };

function parseWorkflow(): Record<string, unknown> {
  const raw = readFileSync(WORKFLOW, "utf8");
  try {
    return parse(raw) as Record<string, unknown>;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `.github/workflows/ci.yml is not valid YAML — GitHub would reject the run ` +
        `before any step executes.\n${detail}`,
    );
  }
}

function steps(): Step[] {
  const doc = parseWorkflow() as {
    jobs?: Record<string, { steps?: Step[] }>;
  };
  const jobs = doc.jobs ?? {};
  return Object.values(jobs).flatMap((job) => job.steps ?? []);
}

/** A step counts as present if its name or its run command matches. */
function hasStep(match: RegExp): boolean {
  return steps().some(
    (s) => match.test(s.name ?? "") || match.test(s.run ?? ""),
  );
}

describe("CI workflow · parses", () => {
  it("ci.yml exists", () => {
    expect(existsSync(WORKFLOW)).toBe(true);
  });

  it("ci.yml is valid YAML with at least one job and steps", () => {
    const doc = parseWorkflow() as { jobs?: Record<string, unknown> };
    expect(Object.keys(doc.jobs ?? {}).length).toBeGreaterThan(0);
    expect(steps().length).toBeGreaterThan(0);
  });

  it("every step has a name or a uses/run directive", () => {
    const nameless = steps().filter((s) => !s.name && !s.uses && !s.run);
    expect(nameless).toEqual([]);
  });
});

describe("CI workflow · required quality gates", () => {
  const required: Array<[string, RegExp]> = [
    ["dependency installation", /npm ci|actions\/setup-node/i],
    ["typecheck", /typecheck/i],
    ["tests", /npm test|vitest/i],
    ["build", /npm run build/i],
    ["Planway absence guard", /planway-absence/i],
    ["agent safety guard", /agent-safety-invariants/i],
  ];

  for (const [label, match] of required) {
    it(`runs ${label}`, () => {
      expect(hasStep(match)).toBe(true);
    });
  }

  // package.json has no lint script; a lint gate here would be theatre.
  it("does not claim a lint gate the repository cannot run", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const hasLintScript = Boolean(pkg.scripts?.lint?.trim());
    const runsLint = steps().some((s) => /npm run lint\b/.test(s.run ?? ""));
    expect(runsLint && !hasLintScript).toBe(false);
  });
});

describe("CI workflow · parser rejects broken YAML", () => {
  it("flags an unquoted scalar containing a colon", () => {
    // This is the exact shape that broke the workflow: `run: echo "lint: x"`
    const broken = 'jobs:\n  test:\n    steps:\n      - run: echo "lint: x"\n';
    expect(() => parse(broken)).toThrow();
  });

  it("accepts the corrected form", () => {
    const fixed = 'jobs:\n  test:\n    steps:\n      - run: echo "lint x"\n';
    expect(() => parse(fixed)).not.toThrow();
  });
});
