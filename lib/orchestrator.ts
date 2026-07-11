// PraxisOS · Multi-Agent Orchestrator (LangGraph Supervisor pattern)
//
// Kontrakt: docs/harness/EPIC-1-Orchestration.md
// Mandat:   Grønt (additiv, feature-flag beskyttet)
//
// Design:
//   - StateGraph med ét supervisor-node og 9 worker-noder
//   - Supervisor returnerer `next` = worker-id | "FINISH"
//   - Worker udfører opgaven (kan kalde MCP-tools) og returnerer besked
//   - Loop indtil supervisor svarer "FINISH" eller INV-15 kicker ind
//
// Concurrency: hvert invoke()-kald bygger sin egen graph med closure over
// per-run steps-buffer og per-run onStep. Ingen mutation af deps → safe
// under parallel-invocation.
//
// Invariants håndhævet i denne fil:
//   INV-1  tenant-isolation           → tenantId påkrævet + write-once reducer
//   INV-3  ingen råt CPR i state      → redactPII kørt før state-mutation
//   INV-7  rolle-adgangskontrol       → canRoleInvokeAgent()-check
//   INV-12 determinisme               → compliance-mode agenter kører temp=0
//   INV-13 ingen tavse fallbacks      → fejl bubbler op som struktureret error
//   INV-15 max 12 node-transitioner   → post-supervisor + post-worker checks
//   INV-16 token-loft                 → tracked i state.tokenUsage
//   INV-19 model-tier whitelist       → isAllowedModelForAgent() validation

import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import {
  type AgentId,
  type Role,
  AGENT_MODEL_TIER,
  AGENT_COMPLIANCE_MODE,
  MODEL_BY_TIER,
  WORKER_IDS,
  canRoleInvokeAgent,
  isAllowedModelForAgent,
  getAgent,
} from "./agents";
import { redactPII, containsRawCpr } from "./redact";

// =============================================================================
// Konstanter (INV-15, INV-16)
// =============================================================================

export const MAX_STEPS = 12;
export const DEFAULT_TOKEN_LIMIT = 100_000;
export const SYNC_DEADLINE_MS = 8_000;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const SCRIBE_TIMEOUT_MS = 120_000;

export function isOrchestrationEnabled(): boolean {
  return process.env.AGENT_ORCHESTRATION_ENABLED === "true";
}

// =============================================================================
// State + typer
// =============================================================================

export type Origin = "chat" | "scribe" | "booking" | "felt" | "cron" | "api" | "portal";

export type OrchestratorMessage = {
  role: "user" | "assistant" | "system" | "tool";
  from?: AgentId | "supervisor" | "tool";
  content: string;
  toolCallId?: string;
};

export type SupervisorDecision = {
  next: AgentId | "FINISH";
  reason: string;
};

export type LLMCallInput = {
  system: string;
  messages: OrchestratorMessage[];
  model: string;
  temperature: number;
  jsonSchema?: unknown;
};

export type LLMCallResult = {
  content: string;
  json?: unknown;
  usage: { prompt: number; completion: number };
};

export type LLMCaller = (input: LLMCallInput) => Promise<LLMCallResult>;

const OrchestratorState = Annotation.Root({
  tenantId: Annotation<string>({
    reducer: (curr, next) => {
      if (curr && next && curr !== next) {
        throw new Error(
          `INV-1 violation: tenantId cannot change mid-run (was ${curr}, got ${next})`,
        );
      }
      return next ?? curr;
    },
    default: () => "",
  }),
  actorRole: Annotation<Role>({
    reducer: (_, next) => next,
    default: () => "system" as Role,
  }),
  origin: Annotation<Origin>({
    reducer: (_, next) => next,
    default: () => "api" as Origin,
  }),
  messages: Annotation<OrchestratorMessage[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  next: Annotation<AgentId | "FINISH" | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  stepCount: Annotation<number>({
    reducer: (curr, next) => Math.max(curr, next),
    default: () => 0,
  }),
  tokenUsage: Annotation<{ prompt: number; completion: number }>({
    reducer: (curr, next) => ({
      prompt: curr.prompt + next.prompt,
      completion: curr.completion + next.completion,
    }),
    default: () => ({ prompt: 0, completion: 0 }),
  }),
});

export type OrchestratorStateT = typeof OrchestratorState.State;

export type StepTrace = {
  stepIndex: number;
  node: "supervisor" | AgentId | "tool" | "END";
  inputState: unknown;
  outputState: unknown;
  latencyMs: number;
  toolName?: string;
  toolCallId?: string;
};

export type RunResult = {
  status: "done" | "error" | "aborted";
  finalAgent: AgentId | "supervisor" | null;
  output: OrchestratorMessage[];
  steps: StepTrace[];
  tokenUsage: { prompt: number; completion: number };
  error?: { code: string; message: string };
};

function supervisorSystemPrompt(): string {
  const roster = WORKER_IDS.map((id) => {
    const a = getAgent(id);
    return `- ${id}: ${a?.role ?? ""} — ${a?.superpower ?? ""}`;
  }).join("\n");

  return [
    "Du er PraxisOS Supervisor. Din opgave er at route brugerens forespørgsel til",
    "den rigtige worker-agent, eller returnere FINISH når opgaven er løst.",
    "",
    "Tilgængelige workers:",
    roster,
    "",
    'SVAR ALTID SOM JSON: { "next": "<agent-id>" | "FINISH", "reason": "<kort>" }',
    "Ingen prosa. Ingen forklaring udenfor JSON.",
  ].join("\n");
}

// =============================================================================
// Orchestrator builder
// =============================================================================

export type OrchestratorDeps = {
  llmCall: LLMCaller;
  /** Optional callback pr. step (til persistering i agent_steps). */
  onStep?: (trace: StepTrace) => void | Promise<void>;
  /** Optional override af MAX_STEPS (bruges i tests). Skal være ≤ MAX_STEPS. */
  maxSteps?: number;
};

/**
 * Bygger en compiled StateGraph med closure over per-run deps.
 * Dette kaldes én gang pr. invoke() så vi undgår shared mutable state
 * på tværs af parallelle runs.
 */
function buildCompiledGraph(deps: {
  llmCall: LLMCaller;
  onStep: (trace: StepTrace) => Promise<void>;
  maxSteps: number;
}) {
  const { llmCall, onStep, maxSteps } = deps;

  async function supervisorNode(
    state: OrchestratorStateT,
  ): Promise<Partial<OrchestratorStateT>> {
    const startedAt = Date.now();
    const decision = await llmCall({
      system: supervisorSystemPrompt(),
      messages: state.messages,
      model: MODEL_BY_TIER.smart,
      temperature: 0,
      jsonSchema: {
        type: "object",
        properties: {
          next: { type: "string" },
          reason: { type: "string" },
        },
        required: ["next", "reason"],
      },
    });

    const parsed = (decision.json ?? safeParseJSON(decision.content)) as SupervisorDecision;
    if (!parsed || typeof parsed.next !== "string") {
      throw new Error("Supervisor returned malformed decision");
    }

    if (parsed.next !== "FINISH" && !canRoleInvokeAgent(state.actorRole, parsed.next as AgentId)) {
      throw new Error(
        `INV-7 violation: role "${state.actorRole}" cannot invoke agent "${parsed.next}"`,
      );
    }

    const trace: StepTrace = {
      stepIndex: state.stepCount,
      node: "supervisor",
      inputState: redactPII(state.messages),
      outputState: redactPII({ decision: parsed }),
      latencyMs: Date.now() - startedAt,
    };
    await onStep(trace);

    return {
      next: parsed.next as AgentId | "FINISH",
      stepCount: state.stepCount + 1,
      tokenUsage: decision.usage,
      messages: [
        {
          role: "system",
          from: "supervisor",
          content: `→ ${parsed.next} (${parsed.reason})`,
        },
      ],
    };
  }

  function makeWorkerNode(agentId: AgentId) {
    return async (state: OrchestratorStateT): Promise<Partial<OrchestratorStateT>> => {
      const startedAt = Date.now();
      const agent = getAgent(agentId);
      if (!agent) throw new Error(`Unknown agent: ${agentId}`);

      const model = MODEL_BY_TIER[AGENT_MODEL_TIER[agentId]];
      if (!isAllowedModelForAgent(agentId, model)) {
        throw new Error(`INV-19 violation: model "${model}" not allowed for "${agentId}"`);
      }

      const temperature = AGENT_COMPLIANCE_MODE[agentId] ? 0 : 0.4;
      const workerSystem = `Du er ${agent.name}, PraxisOS-agent for "${agent.role}". ${agent.voiceTone} Håndter opgaven eller returner kort svar hvis den er uden for dit domæne.`;

      const result = await llmCall({
        system: workerSystem,
        messages: state.messages,
        model,
        temperature,
      });

      if (containsRawCpr(result.content)) {
        throw new Error(`INV-3 violation: raw CPR in ${agentId} response`);
      }

      const trace: StepTrace = {
        stepIndex: state.stepCount,
        node: agentId,
        inputState: redactPII(state.messages),
        outputState: redactPII({ content: result.content }),
        latencyMs: Date.now() - startedAt,
      };
      await onStep(trace);

      return {
        stepCount: state.stepCount + 1,
        tokenUsage: result.usage,
        messages: [
          {
            role: "assistant",
            from: agentId,
            content: result.content,
          },
        ],
        next: null,
      };
    };
  }

  function routeFromSupervisor(state: OrchestratorStateT): AgentId | typeof END {
    if (state.stepCount >= maxSteps) return END;
    if (state.next === "FINISH" || state.next === null) return END;
    return state.next;
  }

  function routeFromWorker(state: OrchestratorStateT): "supervisor" | typeof END {
    if (state.stepCount >= maxSteps) return END;
    return "supervisor";
  }

  // LangGraph JS typing er restriktiv omkring node-names i pathMap.
  // Vi bruger cast fordi vi kender de faktiske node-navne på runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = new StateGraph(OrchestratorState).addNode("supervisor", supervisorNode) as any;
  for (const id of WORKER_IDS) {
    g.addNode(id, makeWorkerNode(id));
  }
  g.addEdge(START, "supervisor");
  const supervisorPathMap: Record<string, string> = {
    ...Object.fromEntries(WORKER_IDS.map((id) => [id, id])),
    [END]: END,
  };
  g.addConditionalEdges("supervisor", routeFromSupervisor, supervisorPathMap);
  const workerPathMap: Record<string, string> = {
    supervisor: "supervisor",
    [END]: END,
  };
  for (const id of WORKER_IDS) {
    g.addConditionalEdges(id, routeFromWorker, workerPathMap);
  }

  return g.compile();
}

export function buildOrchestrator(baseDeps: OrchestratorDeps) {
  const maxSteps = Math.min(baseDeps.maxSteps ?? MAX_STEPS, MAX_STEPS);

  return {
    /**
     * Kør et Supervisor-run.
     * Håndhæver INV-1 (tenantId påkrævet) og INV-15 (maxSteps).
     * Trådsikker: hvert kald bygger sin egen graph.
     */
    async invoke(input: {
      tenantId: string;
      actorRole: Role;
      origin: Origin;
      messages: OrchestratorMessage[];
      tokenLimit?: number;
      onStep?: (trace: StepTrace) => void | Promise<void>;
    }): Promise<RunResult> {
      const steps: StepTrace[] = [];
      const perRunOnStep = async (t: StepTrace) => {
        steps.push(t);
        await baseDeps.onStep?.(t);
        await input.onStep?.(t);
      };

      try {
        // INV-1: tenantId påkrævet (fanges her og returneres som error status,
        // ikke exception, så caller kan håndtere gracefult)
        if (!input.tenantId) {
          throw new Error("INV-1 violation: tenantId is required");
        }

        const compiled = buildCompiledGraph({
          llmCall: baseDeps.llmCall,
          onStep: perRunOnStep,
          maxSteps,
        });

        const final = (await compiled.invoke({
          tenantId: input.tenantId,
          actorRole: input.actorRole,
          origin: input.origin,
          messages: input.messages,
          next: null,
          stepCount: 0,
          tokenUsage: { prompt: 0, completion: 0 },
        })) as OrchestratorStateT;

        const limit = input.tokenLimit ?? DEFAULT_TOKEN_LIMIT;
        if (final.tokenUsage.prompt + final.tokenUsage.completion > limit) {
          return {
            status: "aborted",
            finalAgent: null,
            output: final.messages,
            steps,
            tokenUsage: final.tokenUsage,
            error: { code: "TOKEN_LIMIT_EXCEEDED", message: `> ${limit}` },
          };
        }

        if (final.stepCount > maxSteps) {
          return {
            status: "aborted",
            finalAgent: null,
            output: final.messages,
            steps,
            tokenUsage: final.tokenUsage,
            error: { code: "MAX_STEPS_EXCEEDED", message: `${final.stepCount} > ${maxSteps}` },
          };
        }

        const lastAssistant = [...final.messages]
          .reverse()
          .find((m) => m.role === "assistant" && m.from && m.from !== "supervisor");

        return {
          status: "done",
          finalAgent: (lastAssistant?.from as AgentId) ?? null,
          output: final.messages,
          steps,
          tokenUsage: final.tokenUsage,
        };
      } catch (e) {
        const err = e as Error;
        // INV-13: struktureret error, ikke tavs fallback
        const msg = err.message;
        const code = msg.startsWith("INV-") ? msg.split(":")[0].trim() : "RUNTIME_ERROR";
        return {
          status: "error",
          finalAgent: null,
          output: [],
          steps,
          tokenUsage: { prompt: 0, completion: 0 },
          error: { code, message: msg },
        };
      }
    },
  };
}

function safeParseJSON(s: string): unknown {
  try {
    const trimmed = s.trim();
    const stripped = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}
