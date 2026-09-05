import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXECUTION_PROVIDER_INVARIANTS,
  EXECUTION_PROVIDER_KINDS,
  assertNoDefaultLiveReady,
  assertOnlyMockSandboxWithoutEvidence,
  dumpExecutionProviderRegistry,
  evaluateExecutionProviderGate,
  getExecutionProvider,
  listExecutionProviders,
  resolveExecutionProviderStatus,
} from "@/lib/prime";

const ENV_KEYS_TOUCHED = [
  "CURSOR_API_KEY",
  "GITHUB_COPILOT_TOKEN",
  "VSCODE_COPILOT_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "LANGGRAPH_API_KEY",
  "LANGCHAIN_API_KEY",
  "HF_TOKEN",
  "HUGGINGFACE_API_KEY",
  "ROBOFLOW_API_KEY",
  "HEYGEN_API_KEY",
  "TINKER_API_KEY",
  "INKLING_API_KEY",
] as const;

const NAMED_EXTERNAL_PROVIDERS = [
  "cursor",
  "vscode_copilot",
  "langgraph",
  "roboflow",
  "heygen",
  "huggingface",
  "tinker",
  "inkling",
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

function spoofLiveEvidence() {
  return {
    enabled: true,
    configurationPresent: true,
    adapterPresent: true,
    claimedStatus: "live_ready" as const,
    worktreePresent: true,
    branchPresent: true,
  };
}

describe("ExecutionProvider contract (fail-closed)", () => {
  beforeEach(() => {
    stashEnv();
  });

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

  it("tinkerl and other unknown kinds become blocked", () => {
    for (const kind of ["tinkerl", "vscode", "cursor-agent", ""]) {
      const r = evaluateExecutionProviderGate({ kind, scope: "sandbox" });
      expect(r.kind).toBe("unknown");
      expect(r.status).toBe("blocked");
      expect(r.blocked).toBe(true);
      expect(r.allowed).toBe(false);
      expect(r.autonomousReady).toBe(false);
    }
  });

  it("all non-mock providers are fail-closed by default", () => {
    for (const kind of EXECUTION_PROVIDER_KINDS) {
      if (kind === "mock") continue;
      const r = evaluateExecutionProviderGate({ kind, scope: "sandbox" });
      expect(r.blocked).toBe(true);
      expect(r.allowed).toBe(false);
      expect(r.autonomousReady).toBe(false);
      expect(r.status).not.toBe("live_ready");
      expect(r.status).not.toBe("sandbox_ready");
    }
  });

  it("Cursor is not sandbox_ready just because worktree/branch exist", () => {
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

  it("worktree/branch never promotes named external providers", () => {
    for (const kind of NAMED_EXTERNAL_PROVIDERS) {
      const r = evaluateExecutionProviderGate({
        kind,
        scope: "sandbox",
        evidence: { worktreePresent: true, branchPresent: true, enabled: true },
      });
      expect(r.status).not.toBe("sandbox_ready");
      expect(r.status).not.toBe("live_ready");
      expect(r.blocked).toBe(true);
      expect(r.allowed).toBe(false);
    }
  });

  it("missing config ⇒ unconfigured (blocked)", () => {
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
        expect(p.enabled).toBe(true);
        expect(p.adapterPresent).toBe(true);
      } else {
        expect(["unconfigured", "disabled"]).toContain(p.status);
        expect(p.enabled).toBe(false);
        expect(p.adapterPresent).toBe(false);
      }
    }
  });

  it("named providers are not live_ready without actual adapter AND configuration", () => {
    const allNonMock = EXECUTION_PROVIDER_KINDS.filter((k) => k !== "mock");
    for (const kind of allNonMock) {
      const descriptor = getExecutionProvider(kind)!;
      expect(descriptor.adapterPresent).toBe(false);

      const spoofed = evaluateExecutionProviderGate({
        kind,
        scope: "live",
        evidence: spoofLiveEvidence(),
      });
      expect(spoofed.status).not.toBe("live_ready");
      expect(spoofed.blocked).toBe(true);
      expect(spoofed.allowed).toBe(false);
      expect(spoofed.autonomousReady).toBe(false);
    }
  });

  it("adapter without configuration cannot become live_ready", () => {
    for (const kind of NAMED_EXTERNAL_PROVIDERS) {
      const r = evaluateExecutionProviderGate({
        kind,
        scope: "live",
        evidence: {
          enabled: true,
          adapterPresent: true,
          configurationPresent: false,
          claimedStatus: "live_ready",
        },
      });
      expect(r.status).not.toBe("live_ready");
      expect(r.blocked).toBe(true);
    }
  });

  it("configuration without actual adapter cannot become live_ready", () => {
    for (const kind of NAMED_EXTERNAL_PROVIDERS) {
      const r = evaluateExecutionProviderGate({
        kind,
        scope: "live",
        evidence: {
          enabled: true,
          adapterPresent: false,
          configurationPresent: true,
          claimedStatus: "live_ready",
        },
      });
      expect(r.status).not.toBe("live_ready");
      expect(r.blocked).toBe(true);
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

  it("patient and clinical scopes block every provider including case variants", () => {
    for (const kind of EXECUTION_PROVIDER_KINDS) {
      for (const scope of ["patient", "clinical", "PATIENT", "Clinical"]) {
        const r = evaluateExecutionProviderGate({ kind, scope });
        expect(r.status).toBe("blocked");
        expect(r.blocked).toBe(true);
        expect(r.allowed).toBe(false);
        expect(r.autonomousReady).toBe(false);
      }
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
    expect(r.status).toBe("live_ready");
    expect(r.requiresHumanApproval).toBe(true);
    expect(r.autonomousReady).toBe(false);
    expect(r.allowed).toBe(true);

    const liveOpenAi = evaluateExecutionProviderGate({
      kind: "openai",
      scope: "live",
      evidence: spoofLiveEvidence(),
    });
    expect(liveOpenAi.status).not.toBe("live_ready");
    expect(liveOpenAi.requiresHumanApproval).toBe(true);
    expect(liveOpenAi.autonomousReady).toBe(false);
    expect(liveOpenAi.blocked).toBe(true);
  });

  it("missing callback or cancel ⇒ not autonomous-ready", () => {
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

  it("registry dump never includes secret values", () => {
    const secret = "praxis-contract-secret-nonce-9f3a7c";
    process.env.OPENAI_API_KEY = secret;
    process.env.CURSOR_API_KEY = secret;
    process.env.HEYGEN_API_KEY = secret;

    const dump = JSON.stringify({
      list: listExecutionProviders(),
      registry: dumpExecutionProviderRegistry(),
      gates: EXECUTION_PROVIDER_KINDS.map((kind) =>
        evaluateExecutionProviderGate({ kind, scope: "sandbox" }),
      ),
    });

    expect(dump).not.toContain(secret);
    expect(dump).toContain("OPENAI_API_KEY");
    expect(dump).toContain("CURSOR_API_KEY");
    expect(typeof dumpExecutionProviderRegistry()[0]?.configurationPresent).toBe(
      "boolean",
    );
  });

  it("does not call external providers", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("fetch must not be called");
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      for (const kind of EXECUTION_PROVIDER_KINDS) {
        evaluateExecutionProviderGate({ kind, scope: "sandbox" });
        evaluateExecutionProviderGate({ kind, scope: "live" });
        listExecutionProviders();
        getExecutionProvider(kind);
        dumpExecutionProviderRegistry();
      }
      evaluateExecutionProviderGate({ kind: "tinkerl", scope: "sandbox" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("registry and types have no SDK or network imports", () => {
    const root = process.cwd();
    const registry = readFileSync(
      join(root, "lib/prime/execution-provider-registry.ts"),
      "utf8",
    );
    const types = readFileSync(
      join(root, "lib/prime/execution-provider-types.ts"),
      "utf8",
    );
    for (const src of [registry, types]) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/\baxios\b/);
      expect(src).not.toMatch(/from ["']@anthropic-ai\/sdk["']/);
      expect(src).not.toMatch(/from ["']openai["']/);
      expect(src).not.toMatch(/from ["']@langchain\//);
      expect(src).not.toMatch(/from ["']@heygen\//);
      expect(src).not.toMatch(/from ["']@huggingface\//);
    }
  });
});
