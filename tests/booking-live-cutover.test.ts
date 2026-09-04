// Public origin + production DB fail-fast hardening for live Traefik booking.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { publicOrigin } from "@/lib/public-origin";
import {
  assertProductionDbConfig,
  DB_MODE,
  isProductionRuntime,
} from "@/lib/supabase";
import { GET as servicesGet } from "@/app/api/v1/[tenant]/services/route";
import { GET as availabilityGet } from "@/app/api/v1/[tenant]/availability/route";
import { GET as embedGet } from "@/app/embed/v1/[tenant]/route";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("publicOrigin · Traefik / bind-address", () => {
  const env = process.env as Record<string, string | undefined>;
  const keys = ["PRAXIS_PUBLIC_BASE_URL", "NEXT_PUBLIC_BASE_URL"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      saved[k] = env[k];
      delete env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete env[k];
      else env[k] = saved[k];
    }
  });

  it("prefers PRAXIS_PUBLIC_BASE_URL over 0.0.0.0 req.url", () => {
    env.PRAXIS_PUBLIC_BASE_URL = "https://app.bypilar.dk";
    const req = new Request("http://0.0.0.0:3000/api/v1/bypilar/services");
    expect(publicOrigin(req)).toBe("https://app.bypilar.dk");
  });

  it("uses x-forwarded-proto + x-forwarded-host when env unset", () => {
    const req = new Request("http://0.0.0.0:3000/embed/v1/bypilar", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.bypilar.dk",
      },
    });
    expect(publicOrigin(req)).toBe("https://app.bypilar.dk");
  });
});

describe("isProductionRuntime · fail-fast triggers", () => {
  const env = process.env as Record<string, string | undefined>;
  const keys = [
    "NODE_ENV",
    "PRAXIS_ENV",
    "PRAXIS_REQUIRE_REAL_DB",
    "NEXT_PUBLIC_BASE_URL",
    "PRAXIS_PUBLIC_BASE_URL",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      saved[k] = env[k];
      delete env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete env[k];
      else env[k] = saved[k];
    }
  });

  it("false when no production signals", () => {
    expect(isProductionRuntime()).toBe(false);
  });

  it("true when PRAXIS_REQUIRE_REAL_DB=1", () => {
    env.PRAXIS_REQUIRE_REAL_DB = "1";
    expect(isProductionRuntime()).toBe(true);
  });

  it("true when public base is app.bypilar.dk", () => {
    env.NEXT_PUBLIC_BASE_URL = "https://app.bypilar.dk";
    expect(isProductionRuntime()).toBe(true);
  });

  it("assertProductionDbConfig rejects mock when REQUIRE_REAL_DB", () => {
    env.PRAXIS_REQUIRE_REAL_DB = "1";
    const r = assertProductionDbConfig();
    if (DB_MODE === "mock") {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/mock is forbidden/i);
    }
  });
});

describe("services bookUrl · no bind-address leak", () => {
  const env = process.env as Record<string, string | undefined>;
  const prev = env.PRAXIS_PUBLIC_BASE_URL;

  afterEach(() => {
    if (prev === undefined) delete env.PRAXIS_PUBLIC_BASE_URL;
    else env.PRAXIS_PUBLIC_BASE_URL = prev;
  });

  it("emits https://app.bypilar.dk bookUrl even when req host is 0.0.0.0", async () => {
    env.PRAXIS_PUBLIC_BASE_URL = "https://app.bypilar.dk";
    const res = await servicesGet(
      new Request("http://0.0.0.0:3000/api/v1/bypilar/services"),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.services.length).toBeGreaterThan(0);
    for (const s of json.services) {
      expect(s.bookUrl).toMatch(/^https:\/\/app\.bypilar\.dk\/t\/bypilar\/book\?service=/);
      expect(s.bookUrl).not.toMatch(/0\.0\.0\.0/);
    }
    const ids = json.services.map((s: { id: string }) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["fod-std", "fod-ext", "fod-lux", "mani"]));
  });
});

describe("availability · unknown service 404", () => {
  it("returns service_not_found (no silent fallback)", async () => {
    const res = await availabilityGet(
      new Request(
        "http://localhost/api/v1/bypilar/availability?service=does-not-exist",
      ),
      ctx("bypilar"),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("service_not_found");
  });

  it("returns fod-std when requested", async () => {
    const res = await availabilityGet(
      new Request(
        "http://localhost/api/v1/bypilar/availability?service=fod-std&days=2",
      ),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.service.id).toBe("fod-std");
  });
});

describe("embed ORIGIN · publicOrigin", () => {
  it("script embeds https://app.bypilar.dk when env pinned", async () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = env.PRAXIS_PUBLIC_BASE_URL;
    env.PRAXIS_PUBLIC_BASE_URL = "https://app.bypilar.dk";
    try {
      const res = await embedGet(
        new Request("http://0.0.0.0:3000/embed/v1/bypilar"),
        ctx("bypilar"),
      );
      const body = await res.text();
      expect(body).toContain('var ORIGIN = "https://app.bypilar.dk"');
      expect(body).not.toContain("0.0.0.0");
    } finally {
      if (prev === undefined) delete env.PRAXIS_PUBLIC_BASE_URL;
      else env.PRAXIS_PUBLIC_BASE_URL = prev;
    }
  });

  it("compose pins production public base + require real DB", () => {
    const compose = readFileSync(join(process.cwd(), "docker-compose.praxis.yml"), "utf8");
    expect(compose).toMatch(/NODE_ENV:\s*production/);
    expect(compose).toMatch(/PRAXIS_ENV:\s*production/);
    expect(compose).toMatch(/PRAXIS_REQUIRE_REAL_DB/);
    expect(compose).toMatch(/https:\/\/app\.bypilar\.dk/);
  });

  it("ops cutover + smoke docs exist", () => {
    const cutover = readFileSync(
      join(process.cwd(), "docs/ops/planway-praxisos-booking-cutover.md"),
      "utf8",
    );
    const smoke = readFileSync(
      join(process.cwd(), "docs/ops/praxisos-booking-smoke-checklist.md"),
      "utf8",
    );
    expect(cutover).toMatch(/Planway/);
    expect(cutover).toMatch(/production-cutover-main\.sh/);
    expect(smoke).toMatch(/fod-std/);
    expect(smoke).toMatch(/dbMode/);
  });
});
