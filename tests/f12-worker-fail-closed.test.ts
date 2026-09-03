// F12 · agent worker / cron fail-closed in production.
// /api/agents/tick and /api/agents/workflows must reject unauthenticated
// cron triggers when NODE_ENV=production and no secret is configured.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { authorizeWorker } from "@/lib/agent-worker-auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/agents/tick", {
    method: "POST",
    headers: new Headers(headers),
  });
}

const ORIG_NODE_ENV = process.env.NODE_ENV;
const ORIG_WORKER = process.env.AGENT_WORKER_SECRET;
const ORIG_EVENT = process.env.PRAXIS_EVENT_SECRET;

function setEnv(opts: { nodeEnv?: string; worker?: string; event?: string }) {
  (process.env as Record<string, string | undefined>).NODE_ENV = opts.nodeEnv ?? "test";
  if (opts.worker === undefined) delete process.env.AGENT_WORKER_SECRET;
  else process.env.AGENT_WORKER_SECRET = opts.worker;
  if (opts.event === undefined) delete process.env.PRAXIS_EVENT_SECRET;
  else process.env.PRAXIS_EVENT_SECRET = opts.event;
}

describe("F12 · authorizeWorker fail-closed", () => {
  beforeEach(() => {
    _clearMemorySink();
  });
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = ORIG_NODE_ENV ?? "test";
    if (ORIG_WORKER === undefined) delete process.env.AGENT_WORKER_SECRET;
    else process.env.AGENT_WORKER_SECRET = ORIG_WORKER;
    if (ORIG_EVENT === undefined) delete process.env.PRAXIS_EVENT_SECRET;
    else process.env.PRAXIS_EVENT_SECRET = ORIG_EVENT;
  });

  it("production + no secret → REJECT (fail-closed) + audit-warn", () => {
    setEnv({ nodeEnv: "production", worker: undefined, event: undefined });
    const r = authorizeWorker(req());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_secret_prod");
    const sink = _readMemorySink();
    expect(sink.some((e) => e.event === "agent_worker.unauthorized_no_secret")).toBe(true);
  });

  it("non-production + no secret → allow (open for demo / first boot)", () => {
    setEnv({ nodeEnv: "test", worker: undefined, event: undefined });
    const r = authorizeWorker(req());
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("dev_open");
  });

  it("secret set + matching x-agent-worker-secret header → allow", () => {
    setEnv({ nodeEnv: "production", worker: "whsec_match_1234567890" });
    const r = authorizeWorker(req({ "x-agent-worker-secret": "whsec_match_1234567890" }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("secret_match");
  });

  it("secret set + matching Authorization: Bearer header → allow", () => {
    setEnv({ nodeEnv: "production", worker: "whsec_bearer_1234567890" });
    const r = authorizeWorker(req({ authorization: "Bearer whsec_bearer_1234567890" }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("secret_match");
  });

  it("secret set + wrong header → REJECT", () => {
    setEnv({ nodeEnv: "production", worker: "whsec_real_1234567890" });
    const r = authorizeWorker(req({ "x-agent-worker-secret": "whsec_wrong_1234567890" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("secret_mismatch");
  });

  it("secret set + no header → REJECT", () => {
    setEnv({ nodeEnv: "production", worker: "whsec_real_1234567890" });
    const r = authorizeWorker(req());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("secret_mismatch");
  });

  it("PRAXIS_EVENT_SECRET fallback works when AGENT_WORKER_SECRET unset", () => {
    setEnv({ nodeEnv: "production", worker: undefined, event: "evt_secret_1234567890" });
    const r = authorizeWorker(req({ "x-agent-worker-secret": "evt_secret_1234567890" }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("secret_match");
  });

  it("timing-safe: secrets of different length do not throw and reject", () => {
    setEnv({ nodeEnv: "production", worker: "whsec_real_1234567890" });
    const r = authorizeWorker(req({ "x-agent-worker-secret": "short" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("secret_mismatch");
  });
});

describe("F12 · /api/agents/tick route uses shared fail-closed helper", () => {
  beforeEach(() => _clearMemorySink());
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = ORIG_NODE_ENV ?? "test";
    if (ORIG_WORKER === undefined) delete process.env.AGENT_WORKER_SECRET;
    else process.env.AGENT_WORKER_SECRET = ORIG_WORKER;
  });

  it("returns 401 in production with no secret (fail-closed)", async () => {
    setEnv({ nodeEnv: "production", worker: undefined });
    const { POST } = await import("@/app/api/agents/tick/route");
    const res = await POST(req({ "content-type": "application/json" }));
    expect(res.status).toBe(401);
  });

  it("allows in non-production with no secret (dev open)", async () => {
    setEnv({ nodeEnv: "test", worker: undefined });
    const { POST } = await import("@/app/api/agents/tick/route");
    const res = await POST(
      new Request("http://localhost/api/agents/tick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: false }),
      }),
    );
    // tickAutomation runs; we only assert it is NOT 401 (dev open path).
    expect(res.status).not.toBe(401);
  });
});
