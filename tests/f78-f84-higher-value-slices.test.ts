// F78–F84 · higher-value continue-dev slices (auth audit, consent UX,
// journal guard consistency, CI scripts, operator/docs hygiene).

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { POST as consentPost } from "@/app/api/v1/[tenant]/consent/route";
import {
  _resetConsentEventsForTests,
  _readConsentEventsForTests,
  hasActiveConsent,
} from "@/lib/consent";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { _resetBookingRateLimitForTests } from "@/lib/public-booking-kit";

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

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

function postConsent(tenant: string, body: unknown) {
  return consentPost(
    new Request(`http://localhost/api/v1/${tenant}/consent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(tenant),
  );
}

const JOURNAL_ROUTES = [
  "app/api/journal/route.ts",
  "app/api/journal/from-booking/route.ts",
  "app/api/journal/[id]/route.ts",
  "app/api/journal/[id]/draft/route.ts",
  "app/api/journal/[id]/sign/route.ts",
];

describe("F78 · authorizeTenantRequest / requireTenantAccess straggler scan", () => {
  it("no sensitive route still uses raw decodeSession without a tenant guard", () => {
    const routes = walkRoutes(API).map((p) => relative(ROOT, p));
    const offenders: string[] = [];
    for (const rel of routes) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      if (!src.includes("decodeSession(")) continue;
      // decodeSession via sessionFromRequest / authorize helpers is OK —
      // only flag routes that call decodeSession directly AND lack a guard helper
      const hasGuard =
        src.includes("requireTenantAccess") ||
        src.includes("authorizeTenantRequest") ||
        src.includes("resolveRequestAuth") ||
        src.includes("requireJournalAccess") ||
        src.includes("sessionFromRequest");
      if (!hasGuard) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("documents F78 finding: core staff APIs already on requireTenantAccess", () => {
    const core = [
      "app/api/journal/route.ts",
      "app/api/v1/[tenant]/clients/route.ts",
      "app/api/v1/[tenant]/bookings/list/route.ts",
      "app/api/v1/[tenant]/research/route.ts",
      "app/api/v1/[tenant]/swarm/route.ts",
      "app/api/v1/[tenant]/orchestrator/route.ts",
      "app/api/v1/[tenant]/prime/missions/route.ts",
    ];
    for (const rel of core) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/requireTenantAccess/);
    }
  });
});

describe("F79 · consent onboarding already-recorded + UX polish", () => {
  beforeEach(() => {
    _resetConsentEventsForTests();
    _resetBookingRateLimitForTests();
    _clearMemorySink();
  });

  it("re-POST same clientId+purposes → 200 alreadyRecorded without duplicate events", async () => {
    const body = {
      clientId: "cli_f79_idem",
      consents: { treatment: true, journal: true, marketing: true },
      consentVersion: "bypilar-onboarding-v1",
    };
    const first = await postConsent("bypilar", body);
    expect(first.status).toBe(201);
    const firstJson = await first.json();
    expect(firstJson.alreadyRecorded).toBe(false);
    expect(firstJson.recorded.length).toBe(3);

    const before = _readConsentEventsForTests().filter(
      (e) => e.clientId === "cli_f79_idem",
    ).length;

    const second = await postConsent("bypilar", body);
    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.ok).toBe(true);
    expect(secondJson.alreadyRecorded).toBe(true);
    expect(secondJson.already.sort()).toEqual(
      ["journal", "sms_marketing", "treatment"].sort(),
    );
    expect(secondJson.recorded).toEqual([]);

    const after = _readConsentEventsForTests().filter(
      (e) => e.clientId === "cli_f79_idem",
    ).length;
    expect(after).toBe(before);

    expect(
      hasActiveConsent({
        tenantId: "bypilar",
        clientId: "cli_f79_idem",
        purpose: "treatment",
      }).ok,
    ).toBe(true);
  });

  it("partial new purpose on re-POST records only the new grant", async () => {
    await postConsent("bypilar", {
      clientId: "cli_f79_partial",
      consents: { treatment: true, journal: true },
    });
    const res = await postConsent("bypilar", {
      clientId: "cli_f79_partial",
      consents: { treatment: true, journal: true, research: true },
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.alreadyRecorded).toBe(false);
    expect(json.recorded.map((r: { purpose: string }) => r.purpose)).toEqual([
      "research",
    ]);
    expect(json.already.sort()).toEqual(["journal", "treatment"].sort());
  });

  it("emits consent.onboarding_batch with alreadyRecorded meta on idempotent retry", async () => {
    const body = {
      clientId: "cli_f79_audit",
      consents: { treatment: true, journal: true },
    };
    await postConsent("bypilar", body);
    _clearMemorySink();
    await postConsent("bypilar", body);
    const batch = _readMemorySink().find(
      (e) => e.event === "consent.onboarding_batch",
    );
    expect(batch).toBeTruthy();
    // nested under audit meta.meta (route passes { meta: { alreadyRecorded, ... } })
    const nested = (batch?.meta as { meta?: { alreadyRecorded?: boolean } } | undefined)
      ?.meta;
    expect(nested?.alreadyRecorded).toBe(true);
  });

  it("onboarding page maps rate_limited / required errors + accepts alreadyRecorded", () => {
    const src = readFileSync(
      join(ROOT, "app/t/[tenant]/onboarding/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/consentErrorMessage/);
    expect(src).toMatch(/rate_limited/);
    expect(src).toMatch(/required_consents_missing/);
    expect(src).toMatch(/alreadyRecorded/);
    expect(src).toMatch(/role=\"alert\"/);
  });
});

describe("F83 · journal routes share request-auth guard helpers", () => {
  it("every journal route imports jsonAuthFail + requireTenantAccess|requireJournalAccess", () => {
    for (const rel of JOURNAL_ROUTES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/jsonAuthFail/);
      expect(src, rel).toMatch(
        /requireTenantAccess|requireJournalAccess/,
      );
      expect(src, rel).not.toMatch(/decodeSession\(/);
      expect(src, rel).not.toMatch(/checkAuth/);
    }
  });

  it("collection + from-booking use requireTenantAccess; by-id use requireJournalAccess", () => {
    expect(
      readFileSync(join(ROOT, "app/api/journal/route.ts"), "utf8"),
    ).toMatch(/requireTenantAccess/);
    expect(
      readFileSync(join(ROOT, "app/api/journal/from-booking/route.ts"), "utf8"),
    ).toMatch(/requireTenantAccess/);
    for (const rel of [
      "app/api/journal/[id]/route.ts",
      "app/api/journal/[id]/draft/route.ts",
      "app/api/journal/[id]/sign/route.ts",
    ]) {
      expect(readFileSync(join(ROOT, rel), "utf8"), rel).toMatch(
        /requireJournalAccess/,
      );
    }
  });

  it("sign route excludes reception from roles allow-list", () => {
    const src = readFileSync(
      join(ROOT, "app/api/journal/[id]/sign/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/practitioner/);
    expect(src).toMatch(/owner/);
    expect(src).not.toMatch(/reception/);
  });
});

describe("F84 · CI workflow npm script edge cases", () => {
  it("package.json defines typecheck + test scripts", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.typecheck).toBeTruthy();
    expect(pkg.scripts?.test).toBeTruthy();
    expect(pkg.scripts?.typecheck).toMatch(/tsc/);
    expect(pkg.scripts?.test).toMatch(/vitest/);
  });

  it("ci.yml verifies scripts exist before typecheck/test", () => {
    const yml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(yml).toMatch(/Verify package scripts|verify.*scripts/i);
    expect(yml).toMatch(/typecheck/);
    expect(yml).toMatch(/npm test|npm run test/);
    expect(yml).not.toMatch(/deploy|auto-merge|vercel --prod/i);
  });

  it("ci.yml + package.json scripts file exist", () => {
    expect(existsSync(join(ROOT, ".github/workflows/ci.yml"))).toBe(true);
    expect(existsSync(join(ROOT, "package.json"))).toBe(true);
  });
});

describe("F80/F82 · operator checklist + coding-ready/sandbox docs", () => {
  it("operator checklist covers merge #33+#34 and F78–F84 smoke", () => {
    const src = readFileSync(
      join(ROOT, "docs/ops/p0-operator-checklist-merge-cutover.md"),
      "utf8",
    );
    expect(src).toMatch(/PR #33/);
    expect(src).toMatch(/PR #34/);
    expect(src).toMatch(/F78/);
    expect(src).toMatch(/F79/);
    expect(src).toMatch(/F83/);
    expect(src).toMatch(/F84/);
    expect(src).toMatch(/p0-db-cutover-runbook/);
  });

  it("sandbox-verify + coding-ready reflect continue-dev / 500+ tests era", () => {
    const sandbox = readFileSync(
      join(ROOT, "docs/ops/sandbox-verify.md"),
      "utf8",
    );
    const coding = readFileSync(
      join(ROOT, "docs/ops/coding-ready.md"),
      "utf8",
    );
    expect(sandbox).toMatch(/F4|F11|continue-dev|PR #34/i);
    expect(coding).toMatch(/F4|secure clinical|PR #33|PR #34/i);
    // stale "83 tests" claim must be gone
    expect(sandbox).not.toMatch(/\b83 tests\b/);
  });
});
