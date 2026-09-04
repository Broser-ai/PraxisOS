// F60 · embed hardening (/embed/v1 + booking CORS alignment)

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET as embedGet } from "@/app/embed/v1/[tenant]/route";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";

const ROOT = process.cwd();

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("F60 · embed source hardening", () => {
  it("uses bookingAllowedOrigin + checkIpRateLimit + postMessage origin check", () => {
    const src = readFileSync(
      join(ROOT, "app/embed/v1/[tenant]/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/bookingAllowedOrigin/);
    expect(src).toMatch(/checkIpRateLimit/);
    expect(src).toMatch(/e\.origin !== ORIGIN/);
    expect(src).not.toMatch(/access-control-allow-origin": "\*"/);
  });
});

describe("F60 · embed CORS alignment", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("echoes allowlisted origin on ACAO", async () => {
    const res = await embedGet(
      new Request("http://localhost/embed/v1/bypilar", {
        headers: {
          origin: "https://bypilar.dk",
          "x-forwarded-for": "198.51.100.10",
        },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://bypilar.dk",
    );
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    const body = await res.text();
    expect(body).toMatch(/PraxisOS/);
    expect(body).toMatch(/e\.origin !== ORIGIN/);
  });

  it("omits ACAO for non-allowlisted origin", async () => {
    const res = await embedGet(
      new Request("http://localhost/embed/v1/bypilar", {
        headers: {
          origin: "https://evil.example.com",
          "x-forwarded-for": "198.51.100.11",
        },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("still serves script without Origin (script-tag / curl smoke)", async () => {
    const res = await embedGet(
      new Request("http://localhost/embed/v1/bypilar", {
        headers: { "x-forwarded-for": "198.51.100.12" },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/data-praxis-book/);
  });
});

describe("F60 · embed rate-limit", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("returns 429 under burst from same IP", async () => {
    let last = 0;
    for (let i = 0; i < 125; i++) {
      const res = await embedGet(
        new Request("http://localhost/embed/v1/bypilar", {
          headers: { "x-forwarded-for": "198.51.100.13" },
        }),
        ctx("bypilar"),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });
});
