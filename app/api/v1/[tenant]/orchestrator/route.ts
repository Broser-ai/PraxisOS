// PraxisOS · Orchestrator API-route
// POST /api/v1/[tenant]/orchestrator
//
// Kontrakt: docs/harness/EPIC-1-Orchestration.md §4 + §8 beslutning 5
// Sync sti: hvis run afsluttes ≤ SYNC_DEADLINE_MS returneres fuldt svar (200).
// Async sti: ved deadline overskridelse returneres 202 med run_id;
//            resten af run kører under waitUntil() indtil timeout (INV-14).

import { NextRequest, NextResponse } from "next/server";
import {
  buildOrchestrator,
  isOrchestrationEnabled,
  SYNC_DEADLINE_MS,
  DEFAULT_TIMEOUT_MS,
  SCRIBE_TIMEOUT_MS,
  type Origin,
  type OrchestratorMessage,
  type RunResult,
} from "@/lib/orchestrator";
import type { Role } from "@/lib/agents";
import { createDefaultLLMCaller } from "@/lib/llm-adapter";
import { redactPII } from "@/lib/redact";

// Simpel in-memory run-registry for demo/async-sti. I prod erstattes med
// Supabase agent_runs + agent_steps writer.
const inflightRuns = new Map<string, Promise<RunResult>>();
const completedRuns = new Map<string, RunResult>();

function newRunId(): string {
  // Simpelt UUID v4 alternativ uden crypto-import for Edge-compat
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  if (!isOrchestrationEnabled()) {
    return NextResponse.json(
      { error: "AGENT_ORCHESTRATION_DISABLED" },
      { status: 503 },
    );
  }

  const { tenant } = await ctx.params;
  if (!tenant) {
    return NextResponse.json({ error: "TENANT_REQUIRED" }, { status: 400 });
  }

  let body: {
    origin?: Origin;
    origin_ref?: string;
    input?: string;
    actor_user_id?: string;
    actor_role?: Role;
    messages?: OrchestratorMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const origin: Origin = body.origin ?? "api";
  const actorRole: Role = body.actor_role ?? "practitioner";
  const messages: OrchestratorMessage[] =
    body.messages ?? [
      { role: "user", content: body.input ?? "" },
    ];

  // Redakter allerede input før det når orchestrator (defense-in-depth)
  const cleanMessages = redactPII(messages);

  const orchestrator = buildOrchestrator({
    llmCall: createDefaultLLMCaller(),
  });

  const runId = newRunId();
  const timeoutMs = origin === "scribe" ? SCRIBE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  const runPromise = withTimeout(
    orchestrator.invoke({
      tenantId: tenant,
      actorRole,
      origin,
      messages: cleanMessages,
    }),
    timeoutMs,
    "RUNTIME_TIMEOUT",
  );

  inflightRuns.set(runId, runPromise);
  runPromise
    .then((result) => {
      completedRuns.set(runId, result);
      inflightRuns.delete(runId);
    })
    .catch(() => {
      completedRuns.set(runId, {
        status: "error",
        finalAgent: null,
        output: [],
        steps: [],
        tokenUsage: { prompt: 0, completion: 0 },
        error: { code: "RUNTIME_TIMEOUT", message: `> ${timeoutMs}ms` },
      });
      inflightRuns.delete(runId);
    });

  // Synk-sti: race mod SYNC_DEADLINE_MS
  const raceResult = await Promise.race([
    runPromise.then((r) => ({ type: "done" as const, r })),
    sleep(SYNC_DEADLINE_MS).then(() => ({ type: "timeout" as const })),
  ]);

  if (raceResult.type === "done") {
    return NextResponse.json({ run_id: runId, ...raceResult.r }, { status: 200 });
  }

  // Async-sti: 202 Accepted
  return NextResponse.json(
    {
      run_id: runId,
      status: "processing",
      poll_url: `/api/v1/${tenant}/orchestrator/runs/${runId}`,
    },
    { status: 202 },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(code)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
