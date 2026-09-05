import { afterEach, describe, expect, it } from "vitest";
import {
  EXECUTION_PROVIDER_INVARIANTS,
  EXECUTION_PROVIDER_KINDS,
  assertNoDefaultLiveReady,
  assertOnlyMockSandboxWithoutEvidence,
  evaluateExecutionProviderGate,
  getExecutionProvider,
  listExecutionProviders,
  resolveExecutionProviderStatus,
} from "@/lib/prime";

const ENV_KEYS_TOUCHED = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CURSOR_API_KEY",
  "ROBOFLOW_API_KEY",
] as const;

const savedEnv: Record<string, string | undefined> = {};

function stashEnv(): void {
  for (const k of ENV_KEYS_TOUCHED) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
}

function restoreEnv(): void {
  for (const k of ENV_KEYS_TOUCHED) {
    const v = savedEnv[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("ExecutionProvider contract (fail-closed)", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("unknown provider ⇒ blocked", () => {
    const r = evaluateExecutionProviderGate({
      kind: "not-a-real-provider",
      scope: "sandbox",
    });
    expect(r.kind).toBe("unknown");
    expect(r.status).toBe("blocked");
    expect(r.blocked).toBe(true);
    expect(r.allowed).toBe(false);
    expect(r.autonomousReady).toBe(false);
  });

  it("Cursor is not sandbox_ready just because worktree/branch exist", () => {
    stashEnv();
    const r = evaluateExecutionProviderGate({
      kind: "cursor",
      scope: "sandbox",
      evidence: {
        worktreePresent: true,
        branchPresent: true,
      },
    });
    expect(r.status).not.toBe("sandbox_ready");
    expect(r.status).not.toBe("live_ready");
    expect(r.blocked).toBe(true);
    expect(r.allowed).toBe(false);

    const status = resolveExecutionProviderStatus(
      getExecutionProvider("cursor")!,
      { worktreePresent: true, branchPresent: true },
    );
    expect(status).toBe("unconfigured");
  });

  it("missing config ⇒ unconfigured (blocked)", () => {
    stashEnv();
    const r = evaluateExecutionProviderGate({
      kind: "openai",
      scope: "sandbox",
      evidence: { enabled: true, adapterPresent: true },
    });
    expect(r.configurationPresent).toBe(false);
    expect(r.status).toBe("unconfigured");
    expect(r.blocked).toBe(true);
    expect(r.allowed).toBe(false);
  });

  it("mock is sandbox_ready without adapter/config evidence", () => {
    const r = evaluateExecutionProviderGate({
      kind: "mock",
      scope: "sandbox",
    });
    expect(r.status).toBe("sandbox_ready");
    expect(r.blocked).toBe(false);
    expect(r.allowed).toBe(true);
    expect(r.requiresHumanApproval).toBe(false);
  });

  it("no provider defaults to live_ready", () => {
    expect(assertNoDefaultLiveReady()).toBe(true);
    expect(EXECUTION_PROVIDER_INVARIANTS.NEVER_DEFAULT_LIVE_READY).toBe(true);
    for (const p of listExecutionProviders()) {
      expect(p.status).not.toBe("live_ready");
    }
    expect(EXECUTION_PROVIDER_KINDS.length).toBe(11);
  });

  it("only mock may be sandbox_ready without evidence", () => {
    expect(assertOnlyMockSandboxWithoutEvidence()).toBe(true);
    for (const p of listExecutionProviders()) {
      if (p.kind === "mock") {
        expect(p.status).toBe("sandbox_ready");
      } else {
        expect(["unconfigured", "disabled"]).toContain(p.status);
      }
    }
  });

  it("patient / clinical scope ⇒ blocked", () => {
    for (const scope of ["patient", "clinical"] as const) {
      const r = evaluateExecutionProviderGate({
        kind: "mock",
        scope,
      });
      expect(r.status).toBe("blocked");
      expect(r.blocked).toBe(true);
      expect(r.allowed).toBe(false);
      expect(r.autonomousReady).toBe(false);
    }
  });

  it("live scope ⇒ requiresHumanApproval", () => {
    const r = evaluateExecutionProviderGate({
      kind: "mock",
      scope: "live",
      evidence: {
        claimedStatus: "live_ready",
        configurationPresent: true,
        adapterPresent: true,
        enabled: true,
      },
    });
    // mock resolve ignores claimed live unless we use a non-mock; still live scope
    const liveOpenAi = evaluateExecutionProviderGate({
      kind: "openai",
      scope: "live",
      evidence: {
        enabled: true,
        configurationPresent: true,
        adapterPresent: true,
        claimedStatus: "live_ready",
      },
    });
    expect(liveOpenAi.status).toBe("live_ready");
    expect(liveOpenAi.requiresHumanApproval).toBe(true);
    expect(liveOpenAi.autonomousReady).toBe(false);
    expect(r.requiresHumanApproval).toBe(true);
  });

  it("missing callback or cancel ⇒ not autonomous-ready", () => {
    stashEnv();
    process.env.OPENAI_API_KEY = "x"; // presence only; never asserted/printed as secret
    const openai = getExecutionProvider("openai")!;
    expect(openai.supportsCallback).toBe(false);
    expect(openai.supportsCancel).toBe(false);

    const r = evaluateExecutionProviderGate({
      kind: "openai",
      scope: "sandbox",
      evidence: {
        enabled: true,
        configurationPresent: true,
        adapterPresent: true,
        claimedStatus: "sandbox_ready",
      },
    });
    expect(r.status).toBe("sandbox_ready");
    expect(r.allowed).toBe(true);
    expect(r.autonomousReady).toBe(false);

    const mock = evaluateExecutionProviderGate({
      kind: "mock",
      scope: "sandbox",
    });
    expect(mock.autonomousReady).toBe(true);

    delete process.env.OPENAI_API_KEY;
  });

  it("unconfigured / disabled ⇒ blocked", () => {
    const unconfigured = evaluateExecutionProviderGate({
      kind: "anthropic",
      scope: "sandbox",
    });
    expect(unconfigured.blocked).toBe(true);

    const disabled = evaluateExecutionProviderGate({
      kind: "roboflow",
      scope: "ops",
      evidence: { enabled: false },
    });
    expect(disabled.blocked).toBe(true);
    expect(["disabled", "unconfigured"]).toContain(disabled.status);
  });
});
