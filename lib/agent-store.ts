// PraxisOS agent run / job / approval store (in-memory + optional disk mirror)

import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentId } from "@/lib/agents";
import { resolveSecret } from "@/lib/secrets";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "awaiting_approval";

export type AgentProviderErrorCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_error";

export type AgentToolCall = {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  at: string;
};

export type AgentRun = {
  id: string;
  agentId: AgentId;
  tenant: string;
  trigger: "chat" | "event" | "workflow" | "cron" | "mcp" | "manual";
  workflowId?: string;
  eventId?: string;
  status: AgentRunStatus;
  input: string;
  output?: string;
  toolCalls: AgentToolCall[];
  model: string;
  mode: "llm" | "heuristic" | "simulated";
  error?: string;
  /** Machine-readable provider failure — never treat as FINISH/success */
  errorCode?: AgentProviderErrorCode;
  /**
   * Truthfulness markers for non-LLM paths.
   * Simulated fallback MUST set all three when used.
   */
  simulated?: boolean;
  nonExecuting?: boolean;
  notRealLlmResult?: boolean;
  startedAt: string;
  finishedAt?: string;
  requiresApproval?: boolean;
  approvalId?: string;
  /** Optional Prime Execution Control linkage */
  missionId?: string;
  workstreamId?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimated: boolean;
  };
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type AgentApproval = {
  id: string;
  runId: string;
  agentId: AgentId;
  tenant: string;
  action: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
};

export type WorkflowJob = {
  id: string;
  workflowId: string;
  tenant: string;
  status: "queued" | "running" | "completed" | "failed" | "skipped";
  scheduledAt: string;
  startedAt?: string;
  finishedAt?: string;
  runIds: string[];
  error?: string;
  meta?: Record<string, unknown>;
};

type Store = {
  runs: AgentRun[];
  approvals: AgentApproval[];
  jobs: WorkflowJob[];
  lastTickAt?: string;
  ticks: number;
};

const g = globalThis as typeof globalThis & { __praxisAgentStore?: Store };

function store(): Store {
  if (!g.__praxisAgentStore) {
    g.__praxisAgentStore = { runs: [], approvals: [], jobs: [], ticks: 0 };
    hydrateFromDisk(g.__praxisAgentStore);
  }
  return g.__praxisAgentStore;
}

function dataDir(): string | null {
  const dir = process.env.PRAXIS_DATA_DIR?.trim();
  return dir || null;
}

function hydrateFromDisk(s: Store) {
  const dir = dataDir();
  if (!dir) return;
  try {
    const path = join(dir, "agent-store.json");
    if (!existsSync(path)) return;
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Store>;
    if (Array.isArray(raw.runs)) s.runs = raw.runs.slice(0, 500);
    if (Array.isArray(raw.approvals)) s.approvals = raw.approvals.slice(0, 200);
    if (Array.isArray(raw.jobs)) s.jobs = raw.jobs.slice(0, 500);
    if (typeof raw.ticks === "number") s.ticks = raw.ticks;
    if (raw.lastTickAt) s.lastTickAt = raw.lastTickAt;
  } catch {
    // ignore corrupt mirror
  }
}

function persist() {
  const dir = dataDir();
  if (!dir) return;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const s = store();
    writeFileSync(
      join(dir, "agent-store.json"),
      JSON.stringify(
        {
          runs: s.runs.slice(0, 200),
          approvals: s.approvals.slice(0, 100),
          jobs: s.jobs.slice(0, 200),
          ticks: s.ticks,
          lastTickAt: s.lastTickAt,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    // ignore
  }
}

function mirrorRunLine(run: AgentRun) {
  const dir = dataDir();
  if (!dir) return;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "agent-runs.jsonl"), JSON.stringify({ id: run.id, agentId: run.agentId, status: run.status, at: run.startedAt }) + "\n");
  } catch {
    // ignore
  }
}

function nid(prefix: string) {
  return `${prefix}_${randomBytes(5).toString("hex")}`;
}

export function createRun(input: Omit<AgentRun, "id" | "toolCalls" | "startedAt" | "status"> & { status?: AgentRunStatus }): AgentRun {
  const run: AgentRun = {
    ...input,
    id: nid("run"),
    status: input.status ?? "queued",
    toolCalls: [],
    startedAt: new Date().toISOString(),
  };
  store().runs.unshift(run);
  if (store().runs.length > 500) store().runs.length = 500;
  persist();
  mirrorRunLine(run);
  return run;
}

export function updateRun(id: string, patch: Partial<AgentRun>): AgentRun | undefined {
  const run = store().runs.find((r) => r.id === id);
  if (!run) return undefined;
  Object.assign(run, patch);
  persist();
  return run;
}

export function getRun(id: string): AgentRun | undefined {
  return store().runs.find((r) => r.id === id);
}

export function listRuns(opts?: { agentId?: string; tenant?: string; limit?: number }): AgentRun[] {
  const limit = Math.min(200, opts?.limit ?? 40);
  return store()
    .runs.filter((r) => {
      if (opts?.agentId && r.agentId !== opts.agentId) return false;
      if (opts?.tenant && r.tenant !== opts.tenant) return false;
      return true;
    })
    .slice(0, limit);
}

export function createApproval(input: Omit<AgentApproval, "id" | "status" | "createdAt">): AgentApproval {
  const a: AgentApproval = {
    ...input,
    id: nid("apr"),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store().approvals.unshift(a);
  if (store().approvals.length > 200) store().approvals.length = 200;
  persist();
  return a;
}

export function decideApproval(id: string, status: "approved" | "rejected", decidedBy = "clinic-owner"): AgentApproval | undefined {
  const a = store().approvals.find((x) => x.id === id);
  if (!a || a.status !== "pending") return undefined;
  a.status = status;
  a.decidedAt = new Date().toISOString();
  a.decidedBy = decidedBy;
  const run = getRun(a.runId);
  if (run) {
    updateRun(run.id, {
      status: status === "approved" ? "completed" : "failed",
      finishedAt: a.decidedAt,
      output:
        status === "approved"
          ? (run.output ?? "Godkendt af klinikejer.")
          : `Afvist af ${decidedBy}.`,
    });
  }
  persist();
  return a;
}

export function listApprovals(opts?: { status?: ApprovalStatus; limit?: number }): AgentApproval[] {
  const limit = Math.min(100, opts?.limit ?? 30);
  return store()
    .approvals.filter((a) => (opts?.status ? a.status === opts.status : true))
    .slice(0, limit);
}

export function createJob(input: Omit<WorkflowJob, "id" | "status" | "runIds" | "scheduledAt"> & { status?: WorkflowJob["status"] }): WorkflowJob {
  const job: WorkflowJob = {
    ...input,
    id: nid("job"),
    status: input.status ?? "queued",
    scheduledAt: new Date().toISOString(),
    runIds: [],
  };
  store().jobs.unshift(job);
  if (store().jobs.length > 500) store().jobs.length = 500;
  persist();
  return job;
}

export function updateJob(id: string, patch: Partial<WorkflowJob>): WorkflowJob | undefined {
  const job = store().jobs.find((j) => j.id === id);
  if (!job) return undefined;
  Object.assign(job, patch);
  persist();
  return job;
}

export function listJobs(opts?: { workflowId?: string; limit?: number }): WorkflowJob[] {
  const limit = Math.min(200, opts?.limit ?? 40);
  return store()
    .jobs.filter((j) => (opts?.workflowId ? j.workflowId === opts.workflowId : true))
    .slice(0, limit);
}

export function recordTick() {
  const s = store();
  s.ticks += 1;
  s.lastTickAt = new Date().toISOString();
  persist();
}

export function getAutomationStats() {
  const s = store();
  const pendingApprovals = s.approvals.filter((a) => a.status === "pending").length;
  const running = s.runs.filter((r) => r.status === "running" || r.status === "queued").length;
  const completed24h = s.runs.filter((r) => {
    if (r.status !== "completed") return false;
    const t = Date.parse(r.finishedAt ?? r.startedAt);
    return Date.now() - t < 24 * 3600_000;
  }).length;
  const failed24h = s.runs.filter((r) => {
    if (r.status !== "failed" && r.status !== "blocked") return false;
    const t = Date.parse(r.finishedAt ?? r.startedAt);
    return Date.now() - t < 24 * 3600_000;
  }).length;
  return {
    ticks: s.ticks,
    lastTickAt: s.lastTickAt ?? null,
    runsTotal: s.runs.length,
    jobsTotal: s.jobs.length,
    pendingApprovals,
    running,
    completed24h,
    failed24h,
    llmConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    birdConfigured: Boolean(resolveSecret("BIRD_API_KEY")),
    workerSecretConfigured: Boolean(process.env.AGENT_WORKER_SECRET?.trim() || process.env.PRAXIS_EVENT_SECRET?.trim()),
  };
}
