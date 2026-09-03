// F29 · authorizeTenantRequest / requireTenantAccess / resolveRequestAuth usage audit
// Ensures sensitive mutation + staff routes import a real guard (not open).
// Documents intentional public routes. Fails if a sensitive path loses its guard.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API = join(ROOT, "app/api");

function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

const GUARD_MARKERS = [
  "requireTenantAccess",
  "authorizeTenantRequest",
  "resolveRequestAuth",
  "requireRole",
  "requireJournalAccess",
  "verifyApiKey",
  "resolveApiKey",
  "decodeSession",
  "sessionFromRequest",
  "authorizeWorker",
  "CRON_SECRET",
  "x-vercel-cron",
  "x-praxis-signature",
  "getBackoffMs", // public rate-limited (signup/login)
];

/** Routes that MUST have a staff/API/machine guard (not open). */
const SENSITIVE_SUBSTRINGS = [
  "journal/",
  "journal/from-booking",
  "bird/send",
  "bird/config",
  "scan/config",
  "scan/process",
  "license",
  "tenant/setup",
  "agents/",
  "mcp/",
  "clients",
  "bookings/list",
  "events",
  "cron/",
  "prime/missions",
  "orchestrator",
  "swarm/",
  "research/",
];

/** Intentionally public (or public+rate-limit) — must NOT appear as unguarded failures. */
const PUBLIC_OK = [
  "app/api/health/route.ts",
  "app/api/signup/route.ts",
  "app/api/auth/login/route.ts",
  "app/api/auth/logout/route.ts",
  "app/api/cvr/lookup/route.ts",
  "app/api/dawa/autocomplete/route.ts",
  "app/api/v1/[tenant]/bookings/route.ts",
  "app/api/v1/[tenant]/services/route.ts",
  "app/api/v1/[tenant]/availability/route.ts",
  "app/api/v1/[tenant]/lookup/route.ts",
  "app/api/v1/[tenant]/voucher/route.ts",
  "app/api/v1/[tenant]/consent/route.ts",
];

describe("F29 · authorizeTenantRequest usage audit", () => {
  const routes = walkRoutes(API).map((p) => relative(ROOT, p));

  it("every sensitive route imports a guard / session verifier", () => {
    const ungarded: string[] = [];
    for (const rel of routes) {
      if (PUBLIC_OK.includes(rel)) continue;
      const isSensitive = SENSITIVE_SUBSTRINGS.some((s) => rel.includes(s));
      if (!isSensitive) continue;
      const src = readFileSync(join(ROOT, rel), "utf8");
      const hasGuard = GUARD_MARKERS.some((m) => src.includes(m));
      if (!hasGuard) ungarded.push(rel);
    }
    expect(ungarded).toEqual([]);
  });

  it("core tenant APIs use requireTenantAccess or authorizeTenantRequest", () => {
    const mustUseTenantGuard = [
      "app/api/journal/route.ts",
      "app/api/journal/from-booking/route.ts",
      "app/api/v1/[tenant]/clients/route.ts",
      "app/api/v1/[tenant]/bookings/list/route.ts",
      // F41 / F46 · research / swarm / orchestrator / prime
      "app/api/v1/[tenant]/research/route.ts",
      "app/api/v1/[tenant]/swarm/route.ts",
      "app/api/v1/[tenant]/orchestrator/route.ts",
      "app/api/v1/[tenant]/prime/missions/route.ts",
    ];
    for (const rel of mustUseTenantGuard) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(
        src.includes("requireTenantAccess") ||
          src.includes("authorizeTenantRequest"),
      ).toBe(true);
    }
  });

  it("F46 · no raw decodeSession left on research/swarm/orchestrator/prime", () => {
    const mustNotDecode = [
      "app/api/v1/[tenant]/research/route.ts",
      "app/api/v1/[tenant]/research/ask/route.ts",
      "app/api/v1/[tenant]/research/papers/[arxivId]/route.ts",
      "app/api/v1/[tenant]/swarm/route.ts",
      "app/api/v1/[tenant]/swarm/tick/route.ts",
      "app/api/v1/[tenant]/swarm/stream/route.ts",
      "app/api/v1/[tenant]/orchestrator/route.ts",
      "app/api/v1/[tenant]/orchestrator/runs/[runId]/route.ts",
      "app/api/v1/[tenant]/prime/missions/route.ts",
    ];
    for (const rel of mustNotDecode) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/requireTenantAccess/);
      expect(src, rel).not.toMatch(/decodeSession/);
    }
  });

  it("admin mutation routes use resolveRequestAuth (session cookie)", () => {
    const mustResolve = [
      "app/api/tenant/setup/route.ts",
      "app/api/license/route.ts",
      "app/api/v1/scan/process/route.ts",
      "app/api/bird/send/route.ts",
      "app/api/agents/workflows/route.ts",
    ];
    for (const rel of mustResolve) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toMatch(/resolveRequestAuth/);
    }
  });

  it("documents public OK list is non-empty and health/signup included", () => {
    expect(PUBLIC_OK.length).toBeGreaterThan(5);
    expect(PUBLIC_OK).toContain("app/api/health/route.ts");
    expect(PUBLIC_OK).toContain("app/api/signup/route.ts");
  });
});
