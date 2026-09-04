// Planway absence guard.
// Locks in the Planway-free state of the active codebase. Planway was the legacy
// booking provider for by Pilar; the active booking surface is PraxisOS
// (app.bypilar.dk/t/{tenant}/book).
//
// Scope note: this scans runtime and configuration surfaces only. Docs, tests and
// AGENTS.md may describe the ban in prose without tripping the guard.
//
// Detection targets runtime-meaningful references (live URLs and env keys) rather
// than any occurrence of the substring. A purge/rewrite implementation must be able
// to name the legacy host in order to neutralise it.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");

const SCAN_DIRS = [
  "app",
  "lib",
  "components",
  "agents",
  "modules",
  "scripts",
  "wordpress",
];

const SCAN_FILES = ["middleware.ts", "next.config.ts", "next.config.js"];

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".worktrees",
  ".swarm-data",
  "coverage",
]);

const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|zip|tar|gz|mp4|webm)$/i;

/** A live Planway URL, e.g. https://bypilar.planway.com/book or //planway.com */
export const LIVE_PLANWAY_URL = /(?:https?:)?\/\/[\w.-]*planway\.com/i;

/** A Planway environment variable, e.g. PLANWAY_API_KEY */
export const PLANWAY_ENV_KEY = /\bPLANWAY_[A-Z0-9_]+/;

/** True if text contains a runtime-meaningful Planway reference. */
export function hasActivePlanwayReference(text: string): boolean {
  return LIVE_PLANWAY_URL.test(text) || PLANWAY_ENV_KEY.test(text);
}

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
    else if (!BINARY_EXT.test(name)) out.push(full);
  }
}

function activeSurfaceFiles(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    const full = join(ROOT, dir);
    if (existsSync(full)) walk(full, files);
  }
  for (const file of SCAN_FILES) {
    const full = join(ROOT, file);
    if (existsSync(full)) files.push(full);
  }
  const workflows = join(ROOT, ".github", "workflows");
  if (existsSync(workflows)) walk(workflows, files);
  for (const name of readdirSync(ROOT)) {
    if (/^docker-compose[\w.-]*\.ya?ml$/i.test(name)) files.push(join(ROOT, name));
  }
  return files;
}

describe("Planway absence · active surfaces", () => {
  it("no live Planway URLs or env keys in runtime/config files", () => {
    const hits: string[] = [];
    for (const file of activeSurfaceFiles()) {
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (hasActivePlanwayReference(text)) hits.push(relative(ROOT, file));
    }
    expect(hits).toEqual([]);
  });

  it("detector flags a live Planway URL (negative regression)", () => {
    expect(
      hasActivePlanwayReference('<a href="https://bypilar.planway.com/book">Book</a>'),
    ).toBe(true);
    expect(hasActivePlanwayReference("iframe src=//planway.com/embed")).toBe(true);
    expect(hasActivePlanwayReference("PLANWAY_API_KEY=abc123")).toBe(true);
  });

  it("detector ignores prose and purge logic that merely names the host", () => {
    expect(hasActivePlanwayReference("Planway is no longer used.")).toBe(false);
    expect(
      hasActivePlanwayReference("if (stripos($url, 'planway.com') !== false) { rewrite(); }"),
    ).toBe(false);
  });

  it("scans a non-empty set of active files", () => {
    expect(activeSurfaceFiles().length).toBeGreaterThan(50);
  });
});
