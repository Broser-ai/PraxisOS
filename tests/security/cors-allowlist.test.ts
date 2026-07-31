// Sprint 6 Batch 2
// Verificerer at CORS-allowlisten på /api/mcp/v1 kun echoer whitelistede
// origins, og at wildcard '*' kun accepteres i development.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveCorsOrigin } from "@/app/api/mcp/v1/route";

const ORIG_ORIGINS = process.env.PRAXIS_MCP_ORIGINS;
const ORIG_ENV = process.env.NODE_ENV;

function setEnv(env: string, origins: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = env;
  if (origins === undefined) delete process.env.PRAXIS_MCP_ORIGINS;
  else process.env.PRAXIS_MCP_ORIGINS = origins;
}

describe("MCP CORS allowlist", () => {
  beforeEach(() => {
    // ryd før hver case
    delete process.env.PRAXIS_MCP_ORIGINS;
  });

  afterEach(() => {
    if (ORIG_ORIGINS === undefined) delete process.env.PRAXIS_MCP_ORIGINS;
    else process.env.PRAXIS_MCP_ORIGINS = ORIG_ORIGINS;
    (process.env as Record<string, string | undefined>).NODE_ENV = ORIG_ENV;
  });

  it("production uden konfiguration afviser alle origins", () => {
    setEnv("production", undefined);
    expect(resolveCorsOrigin("https://evil.example")).toBeNull();
    expect(resolveCorsOrigin("https://praxisos.dk")).toBeNull();
  });

  it("production wildcard afvises helt (ingen '*'-echo)", () => {
    setEnv("production", "*");
    expect(resolveCorsOrigin("https://praxisos.dk")).toBeNull();
  });

  it("production med konkret allowlist echoer kun matches", () => {
    setEnv("production", "https://praxisos.dk,https://admin.praxisos.dk");
    expect(resolveCorsOrigin("https://praxisos.dk")).toBe("https://praxisos.dk");
    expect(resolveCorsOrigin("https://admin.praxisos.dk")).toBe("https://admin.praxisos.dk");
    expect(resolveCorsOrigin("https://evil.example")).toBeNull();
  });

  it("test-mode med konkret allowlist virker som prod", () => {
    setEnv("test", "https://ci.local");
    expect(resolveCorsOrigin("https://ci.local")).toBe("https://ci.local");
    expect(resolveCorsOrigin("https://other")).toBeNull();
  });

  it("development uden config falder tilbage til '*' (bekvemt til lokal MCP-klient)", () => {
    setEnv("development", undefined);
    expect(resolveCorsOrigin("http://localhost:5173")).toBe("*");
  });

  it("null origin (fx server-til-server kald) resulterer i ingen CORS-header", () => {
    setEnv("production", "https://praxisos.dk");
    expect(resolveCorsOrigin(null)).toBeNull();
  });
});
