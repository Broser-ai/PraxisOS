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
import { decodeSession, SESSION_COOKIE, type Role as AuthRole, type Session } from "@/lib/auth";
import { orchRunMaps } from "@/lib/orchestrator-runs";

// Shared with GET …/orchestrator/runs/[runId]
const { inflight: inflightRuns, completed: completedRuns } = orchRunMaps();

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
    // Sprint 6 Batch 2: actor_role læses IKKE længere fra body - kun fra
    // server-verificeret session. Feltet er markeret deprecated for at
    // undgå, at callers stoler på det.
    /** @deprecated ignoreret; actor_role udledes af sessionen. */
    actor_role?: never;
    messages?: OrchestratorMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  // Verificér session-cookie og udled actor_role. Hvis der ikke findes en
  // gyldig session, afvises kaldet (INV-7 - rolle-baseret dispatch).
  const cookieHeader = req.cookies.get(SESSION_COOKIE)?.value;
  const session = decodeSession(cookieHeader ?? "") as Session | null;
  if (!session || session.tenant !== tenant) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  // Kun de fire kendte auth-roller matches mod agent-domænets Role. Bemærk
  // at typen `Role` fra agents.ts er identisk med `AuthRole` fra lib/auth.ts.
  const actorRole: Role = session.role as AuthRole as Role;

  const origin: Origin = body.origin ?? "api";
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

  // Synk-sti: race mod SYNC_DEADLINE_MS med clean timer-cancel
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ type: "timeout" }>((resolve) => {
    syncTimer = setTimeout(() => resolve({ type: "timeout" }), SYNC_DEADLINE_MS);
  });
  const raceResult = await Promise.race([
    runPromise.then((r) => ({ type: "done" as const, r })),
    timeoutPromise,
  ]);
  if (syncTimer) clearTimeout(syncTimer);

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
