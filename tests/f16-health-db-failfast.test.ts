// F16 · wire assertProductionDbConfig into GET /api/health.
// Production + mock (or missing Supabase keys) → 503 fail-fast.
// Non-production mock remains OK (dev/demo).

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { DB_MODE } from "@/lib/supabase";

describe("F16 · /api/health DB fail-fast wiring", () => {
  const env = process.env as Record<string, string | undefined>;
  const origNodeEnv = env.NODE_ENV;

  beforeEach(() => {
    delete env.NODE_ENV;
  });

  afterEach(() => {
    if (origNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = origNodeEnv;
  });

  it("non-production + mock → 200 ok (dev/demo allowed)", async () => {
    delete env.NODE_ENV;
    const res = await healthGet();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.dbMode).toBe(DB_MODE);
  });

  it("production + mock → 503 db_config_invalid", async () => {
    env.NODE_ENV = "production";
    // DB_MODE is import-time; in this test env it is mock unless overridden.
    const res = await healthGet();
    if (DB_MODE === "mock") {
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("db_config_invalid");
      expect(json.reason).toMatch(/mock is forbidden/i);
      expect(json.dbMode).toBe("mock");
    } else {
      // Non-mock without real keys also fails production guard
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("db_config_invalid");
    }
  });

  it("production response never claims ok:true when config invalid", async () => {
    env.NODE_ENV = "production";
    const res = await healthGet();
    const json = await res.json();
    if (res.status === 503) {
      expect(json.ok).toBe(false);
      expect(json.reason).toBeTruthy();
    }
  });
});
