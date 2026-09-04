// F15 · orphan cleanup regression guard.
// Asserts that the deleted orphan components (FootScan, SwarmPanel) are not
// re-introduced and that no app/lib/test code imports them. The active scan UI
// is NexusScanPanel (lib/scanner/alpha-pipeline); the active agent panel is
// /admin/swarm.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "lib", "components", "agents", "modules", "scripts"];

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === ".git" || name === ".worktrees" || name === ".swarm-data") continue;
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

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const d of SCAN_DIRS) walk(join(ROOT, d), out);
  return out.filter((f) => /\.(ts|tsx|mjs|js)$/i.test(f));
}

describe("F15 · orphan cleanup regression guard", () => {
  it("deleted components/FootScan.tsx and components/SwarmPanel.tsx are gone", () => {
    expect(existsSync(join(ROOT, "components/FootScan.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/SwarmPanel.tsx"))).toBe(false);
  });

  it("no app/lib/test source imports FootScan or SwarmPanel", () => {
    const offenders: string[] = [];
    const importRe = /\bimport\s+[^;]*\b(FootScan|SwarmPanel)\b/;
    for (const f of sourceFiles()) {
      const text = readFileSync(f, "utf8");
      if (importRe.test(text)) offenders.push(relative(ROOT, f));
    }
    expect(offenders).toEqual([]);
  });

  it("no JSX usage of <FootScan> or <SwarmPanel> in app/components", () => {
    const offenders: string[] = [];
    const jsxRe = /<(FootScan|SwarmPanel)\b/;
    for (const f of sourceFiles()) {
      if (!/\.tsx$/i.test(f)) continue;
      const text = readFileSync(f, "utf8");
      if (jsxRe.test(text)) offenders.push(relative(ROOT, f));
    }
    expect(offenders).toEqual([]);
  });
});
