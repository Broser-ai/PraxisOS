// PraxisOS · Sprint 6 Batch 3 · CSP + security-headers verifikation
// Kontrakt: COMPLETE-AUDIT-REPORT.md · SEC-12 "Zero security headers"
//
// Tester at:
//   1. next.config.mjs eksporterer korrekt CSP med krav'ede direktiver
//   2. Alle baseline security-headers er sat (HSTS, X-Frame-Options osv.)
//   3. Middleware injecterer et unikt CSP-nonce pr. request
//   4. Nonce erstatter placeholder {NONCE} i script-src

import { describe, it, expect } from "vitest";

// Vi importerer direkte fra next.config.mjs (ESM). Vitest kan resolve
// project-root next.config takket vaere alias '@' i vitest.config.ts.
import { CSP_DIRECTIVES, securityHeaders } from "../../next.config.mjs";
import { _test as middlewareTest } from "../../middleware";

describe("CSP · direktiver", () => {
  it("indeholder default-src 'self'", () => {
    expect(CSP_DIRECTIVES).toContain("default-src 'self'");
  });

  it("indeholder strict-dynamic i script-src", () => {
    expect(CSP_DIRECTIVES).toContain("'strict-dynamic'");
  });

  it("indeholder nonce-placeholder i script-src", () => {
    expect(CSP_DIRECTIVES).toContain("'nonce-{NONCE}'");
  });

  it("frame-ancestors er 'none' (INV: kliniker-journal aldrig iframed)", () => {
    expect(CSP_DIRECTIVES).toContain("frame-ancestors 'none'");
  });

  it("form-action laast til 'self' (blokerer POST-hijack)", () => {
    expect(CSP_DIRECTIVES).toContain("form-action 'self'");
  });

  it("img-src tillader data: og https: (previews + assets)", () => {
    expect(CSP_DIRECTIVES).toContain("img-src");
    expect(CSP_DIRECTIVES).toMatch(/img-src[^;]*data:/);
    expect(CSP_DIRECTIVES).toMatch(/img-src[^;]*https:/);
  });

  it("object-src er 'none' (blokerer plugin-flader)", () => {
    expect(CSP_DIRECTIVES).toContain("object-src 'none'");
  });

  it("base-uri er 'self' (blokerer <base>-tag omdirigering)", () => {
    expect(CSP_DIRECTIVES).toContain("base-uri 'self'");
  });

  it("upgrade-insecure-requests er sat", () => {
    expect(CSP_DIRECTIVES).toContain("upgrade-insecure-requests");
  });
});

describe("Security-headers · baseline for medical-grade surface", () => {
  it("Content-Security-Policy header er inkluderet", () => {
    const csp = securityHeaders.find(
      (h: { key: string }) => h.key === "Content-Security-Policy",
    );
    expect(csp).toBeDefined();
    expect(csp!.value).toBe(CSP_DIRECTIVES);
  });

  it("HSTS 2-aar med includeSubDomains + preload", () => {
    const hsts = securityHeaders.find(
      (h: { key: string }) => h.key === "Strict-Transport-Security",
    );
    expect(hsts).toBeDefined();
    expect(hsts!.value).toContain("max-age=63072000");
    expect(hsts!.value).toContain("includeSubDomains");
    expect(hsts!.value).toContain("preload");
  });

  it("X-Content-Type-Options: nosniff", () => {
    const xcto = securityHeaders.find(
      (h: { key: string }) => h.key === "X-Content-Type-Options",
    );
    expect(xcto?.value).toBe("nosniff");
  });

  it("X-Frame-Options: DENY", () => {
    const xfo = securityHeaders.find(
      (h: { key: string }) => h.key === "X-Frame-Options",
    );
    expect(xfo?.value).toBe("DENY");
  });

  it("Referrer-Policy: strict-origin", () => {
    const rp = securityHeaders.find(
      (h: { key: string }) => h.key === "Referrer-Policy",
    );
    expect(rp?.value).toBe("strict-origin");
  });

  it("Permissions-Policy default-denyer camera/microphone/geolocation", () => {
    const pp = securityHeaders.find(
      (h: { key: string }) => h.key === "Permissions-Policy",
    );
    expect(pp?.value).toContain("camera=()");
    expect(pp?.value).toContain("microphone=()");
    expect(pp?.value).toContain("geolocation=()");
  });

  it("Cross-Origin-Opener-Policy er same-origin", () => {
    const coop = securityHeaders.find(
      (h: { key: string }) => h.key === "Cross-Origin-Opener-Policy",
    );
    expect(coop?.value).toBe("same-origin");
  });
});

describe("Middleware · CSP-nonce injektion", () => {
  it("genererer 128-bit nonce base64", () => {
    const nonce = middlewareTest.generateNonce();
    // 16 bytes -> 24 chars base64 (med padding =/==)
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22,24}={0,2}$/);
  });

  it("nonce er unikt pr. kald", () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) nonces.add(middlewareTest.generateNonce());
    expect(nonces.size).toBe(100);
  });

  it("extractTenant tager tenant fra /api/v1/{tenant}/...", () => {
    expect(middlewareTest.extractTenant("/api/v1/by-pilar/scans/upload"))
      .toBe("by-pilar");
    expect(middlewareTest.extractTenant("/api/v1/ortos/orchestrator"))
      .toBe("ortos");
  });

  it("extractTenant tager tenant fra /admin/{tenant}/...", () => {
    expect(middlewareTest.extractTenant("/admin/by-pilar/settings"))
      .toBe("by-pilar");
    expect(middlewareTest.extractTenant("/admin/by-pilar"))
      .toBe("by-pilar");
  });

  it("extractTenant returnerer null uden tenant-prefix", () => {
    expect(middlewareTest.extractTenant("/api/health")).toBeNull();
    expect(middlewareTest.extractTenant("/")).toBeNull();
  });

  it("isProtectedRoute markerer /admin/* + /api/v1/{tenant}/*", () => {
    expect(middlewareTest.isProtectedRoute("/admin/by-pilar")).toBe(true);
    expect(middlewareTest.isProtectedRoute("/api/v1/by-pilar/scans")).toBe(true);
    expect(middlewareTest.isProtectedRoute("/login")).toBe(false);
    expect(middlewareTest.isProtectedRoute("/api/health")).toBe(false);
  });

  it("isPublicRoute whitelister /api/auth/login + /api/health", () => {
    expect(middlewareTest.isPublicRoute("/api/auth/login")).toBe(true);
    expect(middlewareTest.isPublicRoute("/api/auth/logout")).toBe(true);
    expect(middlewareTest.isPublicRoute("/api/health")).toBe(true);
    expect(middlewareTest.isPublicRoute("/api/v1/by-pilar/public/status")).toBe(true);
    expect(middlewareTest.isPublicRoute("/admin/by-pilar")).toBe(false);
  });
});

describe("Middleware · session-verify (edge-Web-Crypto path)", () => {
  it("null cookie -> ok=false", async () => {
    const r = await middlewareTest.verifySession(undefined, "any-secret-here-longer-than-min");
    expect(r.ok).toBe(false);
  });

  it("malformed cookie (ingen '.') -> ok=false", async () => {
    const r = await middlewareTest.verifySession("no-dot-here", "any-secret-here-longer-than-min");
    expect(r.ok).toBe(false);
  });

  it("token uden secret -> ok=false", async () => {
    const r = await middlewareTest.verifySession("aaa.bbb", undefined);
    expect(r.ok).toBe(false);
  });

  it("tampered signatur -> ok=false", async () => {
    // Byg gyldig payload med et andet secret · verify med korrekt secret vil fejle
    const payload = { accountId: "u1", tenant: "by-pilar", role: "owner" };
    const secret = "praxisos-test-signing-key-32chars-min-ok";
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const payloadB64 = btoa(String.fromCharCode(...encoded))
      .replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    // Tampered signatur
    const badToken = `${payloadB64}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const r = await middlewareTest.verifySession(badToken, secret);
    expect(r.ok).toBe(false);
  });
});

describe("Middleware · edge-rate-limit stub", () => {
  it("tillader foerste kald", () => {
    const r = middlewareTest.checkRateLimit("test-ip-alpha");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeGreaterThan(0);
  });

  it("returnerer remaining der tæller ned", () => {
    const ip = "test-ip-beta";
    const r1 = middlewareTest.checkRateLimit(ip);
    const r2 = middlewareTest.checkRateLimit(ip);
    expect(r2.remaining).toBeLessThan(r1.remaining);
  });
});
