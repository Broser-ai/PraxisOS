// F41 · research / swarm / orchestrator → requireTenantAccess

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { GET as researchGet, POST as researchPost } from "@/app/api/v1/[tenant]/research/route";
import { GET as swarmGet, POST as swarmPost } from "@/app/api/v1/[tenant]/swarm/route";
import { POST as orchPost } from "@/app/api/v1/[tenant]/orchestrator/route";
import { GET as orchRunGet } from "@/app/api/v1/[tenant]/orchestrator/runs/[runId]/route";
import { GET as streamGet } from "@/app/api/v1/[tenant]/swarm/stream/route";

const ROOT = process.cwd();

const F41_ROUTES = [
  "app/api/v1/[tenant]/research/route.ts",
  "app/api/v1/[tenant]/research/ask/route.ts",
  "app/api/v1/[tenant]/research/papers/[arxivId]/route.ts",
  "app/api/v1/[tenant]/swarm/route.ts",
  "app/api/v1/[tenant]/swarm/tick/route.ts",
  "app/api/v1/[tenant]/swarm/stream/route.ts",
  "app/api/v1/[tenant]/orchestrator/route.ts",
  "app/api/v1/[tenant]/orchestrator/runs/[runId]/route.ts",
];

function cookie(session: {
  accountId: string;
  tenant: string;
  role: Role;
}): string {
  const token = encodeSession({
    ...session,
    loggedInAt: new Date().toISOString(),
  });
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("F41 · source uses requireTenantAccess (not raw decodeSession)", () => {
  it("all research/swarm/orchestrator routes import requireTenantAccess", () => {
    for (const rel of F41_ROUTES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/requireTenantAccess/);
      expect(src, rel).not.toMatch(/decodeSession/);
    }
  });
});

describe("F41 · research auth", () => {
  it("GET unauthenticated → 401", async () => {
    const res = await researchGet(
      new Request("http://localhost/api/v1/bypilar/research"),
      ctx("bypilar"),
    );
    expect(res.status).toBe(401);
  });

  it("GET spoofed x-praxis-* alone → 401", async () => {
    const res = await researchGet(
      new Request("http://localhost/api/v1/bypilar/research", {
        headers: {
          "x-praxis-tenant": "bypilar",
          "x-praxis-role": "owner",
        },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(401);
  });

  it("GET owner session → 200 tracks", async () => {
    const res = await researchGet(
      new Request("http://localhost/api/v1/bypilar/research", {
        headers: {
          cookie: cookie({
            accountId: "acc_pilar",
            tenant: "bypilar",
            role: "owner",
          }),
        },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenant).toBe("bypilar");
    expect(body.data).toBeDefined();
  });

  it("POST reception → 403 insufficient_role", async () => {
    const res = await researchPost(
      new Request("http://localhost/api/v1/bypilar/research", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookie({
            accountId: "acc_rec",
            tenant: "bypilar",
            role: "reception",
          }),
        },
        body: JSON.stringify({ query: "test" }),
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(403);
  });

  it("GET cross-tenant → 403", async () => {
    const res = await researchGet(
      new Request("http://localhost/api/v1/bypilar/research", {
        headers: {
          cookie: cookie({
            accountId: "acc_nadia",
            tenant: "nordlys",
            role: "owner",
          }),
        },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(403);
  });
});

describe("F41 · swarm auth", () => {
  it("GET unauthenticated → 401", async () => {
    const res = await swarmGet(
      new Request("http://localhost/api/v1/bypilar/swarm"),
      ctx("bypilar"),
    );
    expect(res.status).toBe(401);
  });

  it("GET with owner cookie → 200", async () => {
    const res = await swarmGet(
      new Request("http://localhost/api/v1/bypilar/swarm", {
        headers: {
          cookie: cookie({
            accountId: "acc_pilar",
            tenant: "bypilar",
            role: "owner",
          }),
        },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
  });

  it("POST practitioner → 403", async () => {
    const res = await swarmPost(
      new Request("http://localhost/api/v1/bypilar/swarm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookie({
            accountId: "acc_prac",
            tenant: "bypilar",
            role: "practitioner",
          }),
        },
        body: JSON.stringify({ action: "daemon_stop" }),
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(403);
  });

  it("stream unauthenticated → 401", async () => {
    const res = await streamGet(
      new Request("http://localhost/api/v1/bypilar/swarm/stream"),
      ctx("bypilar"),
    );
    expect(res.status).toBe(401);
  });
});

describe("F41 · orchestrator auth", () => {
  const prev = process.env.AGENT_ORCHESTRATION_ENABLED;
  beforeEach(() => {
    process.env.AGENT_ORCHESTRATION_ENABLED = "true";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.AGENT_ORCHESTRATION_ENABLED;
    else process.env.AGENT_ORCHESTRATION_ENABLED = prev;
  });

  it("POST unauthenticated → 401", async () => {
    const res = await orchPost(
      new Request("http://localhost/api/v1/bypilar/orchestrator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: "hello" }),
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(401);
  });

  it("GET run unauthenticated → 401", async () => {
    const res = await orchRunGet(
      new Request("http://localhost/api/v1/bypilar/orchestrator/runs/run_x"),
      { params: Promise.resolve({ tenant: "bypilar", runId: "run_x" }) },
    );
    expect(res.status).toBe(401);
  });
});
