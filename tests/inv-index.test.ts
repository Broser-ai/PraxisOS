// INV coverage index · Sprint 6 blocker B12
// Kontrakt: COMPLETE-AUDIT-REPORT.md §B12
//           "33 of 47 declared invariants have zero test asserting the failure mode"
//
// Denne test kører hver CI-run og fejler hvis en INV-code er MENTIONED i
// kilde-koden (lib/, components/, app/, supabase/migrations/) men INGEN test
// under tests/ nævner den. Formålet er at forhindre stille regression når
// nye INV-koder tilføjes uden matching assertion.
//
// Godkendte undtagelser vedligeholdes i INV_ALLOWLIST — hver med kommentar
// om HVORFOR den er accepteret utestet (marketing/UI-copy, dokumentations-
// reference, deprecated, planned-in-next-sprint osv.).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = join(__dirname, "..");

// INV-koder der er acceptable at have i kildekoden UDEN test-dækning.
// Tilføj kun her hvis du dokumenterer HVORFOR.
const INV_ALLOWLIST = new Set<string>([
  // Marketing-copy i Topbar + admin-plan · rene UI-strings, ingen invariant-adfærd
  "INV-2026",
  // INV-4 er migreret ind i INV-2/INV-15 (LangGraph state-transition) — kun
  // referet i migration-header som kommentar til ældre design
  "INV-4",
]);

// Hvor "declared" INV-koder må komme fra
const CODE_DIRS = [
  "lib",
  "components",
  "app",
  "supabase/migrations",
];

// Hvor "covered" INV-koder skal komme fra
const TEST_DIRS = ["tests"];

// Kildefiler + test-filer scannes efter denne pattern
const INV_PATTERN = /INV-[A-Z]{0,3}-?\d+/g;
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".sql", ".md"]);
const TEST_EXTENSIONS = new Set([".ts", ".tsx", ".jsonl"]);

function walk(dir: string, exts: Set<string>): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.has(extname(name))) {
      out.push(full);
    }
  }
  return out;
}

type InvHit = { code: string; file: string; line: number };

function collectHits(dir: string, exts: Set<string>): InvHit[] {
  const hits: InvHit[] = [];
  for (const file of walk(dir, exts)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const src = readFileSync(file, "utf8");
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const found = lines[i]!.match(INV_PATTERN);
      if (!found) continue;
      for (const code of found) {
        hits.push({ code, file: rel, line: i + 1 });
      }
    }
  }
  return hits;
}

describe("INV-index · Sprint 6 blocker B12", () => {
  const declaredHits = CODE_DIRS.flatMap((d) => collectHits(join(ROOT, d), CODE_EXTENSIONS));
  const coveredHits = TEST_DIRS.flatMap((d) => collectHits(join(ROOT, d), TEST_EXTENSIONS));

  const declared = new Set(declaredHits.map((h) => h.code));
  const covered = new Set(coveredHits.map((h) => h.code));

  // Fjern allowlist-koder fra "declared" så de aldrig regnes som gap
  for (const allowed of INV_ALLOWLIST) declared.delete(allowed);

  it("mindst 1 INV-code fundet i kilde-koden (sanity check)", () => {
    expect(declared.size).toBeGreaterThan(0);
  });

  it("mindst 1 INV-code dækket af en test (sanity check)", () => {
    expect(covered.size).toBeGreaterThan(0);
  });

  // Ratchet-pattern: known-gaps må aldrig VOKSE, kun krympe. Nye INV-koder
  // uden test fejler CI. Fixede INV-koder skal aktivt fjernes fra JSON'en så
  // ratchet'en ikke slækkes.
  const knownGapsFile = join(ROOT, "tests", "inv-known-gaps.json");
  const knownGaps = new Set<string>(
    (JSON.parse(readFileSync(knownGapsFile, "utf8")) as { known_gaps: string[] }).known_gaps,
  );

  it("hver declared INV-code har mindst én test-reference (ratchet: kun NYE gaps fejler)", () => {
    const gaps = [...declared].filter((code) => !covered.has(code)).sort();
    const newGaps = gaps.filter((c) => !knownGaps.has(c));
    const closedGaps = [...knownGaps].filter((c) => !gaps.includes(c)).sort();

    if (newGaps.length > 0) {
      const details = newGaps.map((code) => {
        const example = declaredHits.find((h) => h.code === code);
        return `  - ${code}   declared at ${example?.file}:${example?.line}`;
      });
      throw new Error(
        [
          `INV-index B12: ${newGaps.length} NYE declared invariants uden test-coverage.`,
          "Ratchet-brud — skriv testen ELLER tilføj koden til INV_ALLOWLIST med kommentar.",
          "",
          ...details,
        ].join("\n"),
      );
    }

    if (closedGaps.length > 0) {
      throw new Error(
        [
          `INV-index B12: ${closedGaps.length} INV-koder er nu dækket af tests — fjern dem fra tests/inv-known-gaps.json så ratchet'en tights:`,
          ...closedGaps.map((c) => `  - ${c}`),
        ].join("\n"),
      );
    }
  });

  it("ingen test refererer en INV-code der IKKE findes i koden (dead-test detection)", () => {
    const orphans = [...covered]
      .filter((code) => !declared.has(code) && !INV_ALLOWLIST.has(code))
      .sort();

    if (orphans.length > 0) {
      const details = orphans.map((code) => {
        const example = coveredHits.find((h) => h.code === code);
        return `  - ${code}   test at ${example?.file}:${example?.line}`;
      });
      const message = [
        `INV-index B12: ${orphans.length} tests refererer INV-koder der ikke findes i koden.`,
        "Enten har koden mistet en INV-reference (regression), eller testen bør slettes.",
        "",
        ...details,
      ].join("\n");
      throw new Error(message);
    }
  });
});
