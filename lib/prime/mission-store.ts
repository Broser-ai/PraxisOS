// Mission / Workstream / Evidence store — same pattern as agent-store (memory + optional disk).

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_MISSION_BUDGETS,
  type HumanDecision,
  type Mission,
  type MissionAgentRun,
  type MissionBudgets,
  type MissionBudgetUsage,
  type MissionStatus,
  type PlatformScope,
  type RiskLevel,
  type Workstream,
  type WorkstreamEvidence,
  type WorkstreamStatus,
} from "@/lib/prime/mission-types";

type MissionStoreRoot = {
  missions: Mission[];
  workstreams: Workstream[];
  evidence: WorkstreamEvidence[];
  runs: MissionAgentRun[];
};

const GKEY = "__praxisos_mission_store_v1__";

function emptyUsage(): MissionBudgetUsage {
  return {
    totalTokens: 0,
    estimatedTokens: 0,
    recordedTokens: 0,
    toolCalls: 0,
    runtimeMinutes: 0,
    agents: 0,
    changedFiles: 0,
    reworkLoops: 0,
  };
}

function nid(prefix: string): string {
  return `${prefix}_${randomBytes(5).toString("hex")}`;
}

function dataDir(): string | null {
  const dir = process.env.PRAXIS_DATA_DIR?.trim();
  return dir || null;
}

function store(): MissionStoreRoot {
  const g = globalThis as typeof globalThis & { [GKEY]?: MissionStoreRoot };
  if (!g[GKEY]) {
    g[GKEY] = { missions: [], workstreams: [], evidence: [], runs: [] };
    hydrate(g[GKEY]);
  }
  return g[GKEY];
}

function hydrate(s: MissionStoreRoot): void {
  const dir = dataDir();
  if (!dir) return;
  try {
    const path = join(dir, "mission-store.json");
    if (!existsSync(path)) return;
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<MissionStoreRoot>;
    if (Array.isArray(raw.missions)) {
      s.missions = raw.missions.slice(0, 200).map(normalizeMission);
    }
    if (Array.isArray(raw.workstreams)) {
      s.workstreams = raw.workstreams.slice(0, 400).map(normalizeWorkstream);
    }
    if (Array.isArray(raw.evidence)) s.evidence = raw.evidence.slice(0, 400);
    if (Array.isArray(raw.runs)) s.runs = raw.runs.slice(0, 500);
  } catch {
    // ignore corrupt mirror
  }
}

function normalizeMission(m: Mission): Mission {
  const goal = m.goal ?? "";
  return {
    ...m,
    goal,
    objective: m.objective ?? goal,
    acceptanceCriteria: Array.isArray(m.acceptanceCriteria)
      ? m.acceptanceCriteria
      : [],
  };
}

function normalizeWorkstream(w: Workstream): Workstream {
  const role = w.role ?? w.assignedRole ?? "builder";
  return {
    ...w,
    objective: w.objective ?? w.title ?? "",
    role,
    assignedRole: w.assignedRole ?? role,
  };
}

function persist(): void {
  const dir = dataDir();
  if (!dir) return;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const s = store();
    writeFileSync(
      join(dir, "mission-store.json"),
      JSON.stringify(
        {
          durability: "memory_json",
          note: "NOT Postgres-durable — leases/workstreams hydrate from this JSON only",
          missions: s.missions.slice(0, 100),
          workstreams: s.workstreams.slice(0, 200),
          evidence: s.evidence.slice(0, 200),
          runs: s.runs.slice(0, 200),
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

export function resetMissionStoreForTests(): void {
  const g = globalThis as typeof globalThis & { [GKEY]?: MissionStoreRoot };
  g[GKEY] = { missions: [], workstreams: [], evidence: [], runs: [] };
}

/**
 * Simulate process restart for the mission store: drop in-memory root and
 * rehydrate from PRAXIS_DATA_DIR JSON (memory/JSON — not Postgres).
 */
export function resumeMissionStoreAfterRestart(): {
  missions: number;
  workstreams: number;
  durability: "memory_json";
} {
  const g = globalThis as typeof globalThis & { [GKEY]?: MissionStoreRoot };
  delete g[GKEY];
  const s = store();
  return {
    missions: s.missions.length,
    workstreams: s.workstreams.length,
    durability: "memory_json",
  };
}

export function createMission(input: {
  tenantSlug: string;
  title: string;
  goal: string;
  createdBy: string;
  riskLevel?: RiskLevel;
  budgets?: Partial<MissionBudgets>;
  platformScope?: PlatformScope[];
  fixtureId?: string;
  /** Optional mission-level acceptance criteria (domain repo requires ≥1). */
  acceptanceCriteria?: { text: string }[];
  objective?: string;
}): Mission {
  const now = new Date().toISOString();
  const objective = (input.objective ?? input.goal).trim();
  const mission: Mission = {
    id: nid("msn"),
    tenantSlug: input.tenantSlug,
    title: input.title.trim(),
    goal: input.goal.trim() || objective,
    objective,
    status: "draft",
    riskLevel: input.riskLevel ?? "green",
    platformScope: input.platformScope ?? ["prime", "docs"],
    budgets: { ...DEFAULT_MISSION_BUDGETS, ...input.budgets },
    usage: emptyUsage(),
    acceptanceCriteria: (input.acceptanceCriteria ?? []).map((c, i) => ({
      id: `mac_${i + 1}`,
      text: c.text.trim(),
      status: "pending" as const,
    })),
    workstreamIds: [],
    createdBy: input.createdBy,
    fixtureId: input.fixtureId,
    createdAt: now,
    updatedAt: now,
    humanDecisions: [],
  };
  store().missions.unshift(mission);
  if (store().missions.length > 200) store().missions.length = 200;
  persist();
  return mission;
}

export function getMission(id: string): Mission | undefined {
  return store().missions.find((m) => m.id === id);
}

export function listMissions(opts?: {
  tenantSlug?: string;
  status?: MissionStatus;
  limit?: number;
}): Mission[] {
  const limit = Math.min(100, opts?.limit ?? 40);
  return store()
    .missions.filter((m) => {
      if (opts?.tenantSlug && m.tenantSlug !== opts.tenantSlug) return false;
      if (opts?.status && m.status !== opts.status) return false;
      return true;
    })
    .slice(0, limit);
}

export function updateMission(
  id: string,
  patch: Partial<Mission>,
): Mission | undefined {
  const m = getMission(id);
  if (!m) return undefined;
  Object.assign(m, patch, { updatedAt: new Date().toISOString() });
  if (patch.goal !== undefined && patch.objective === undefined) {
    m.objective = patch.goal;
  }
  if (patch.objective !== undefined && patch.goal === undefined) {
    m.goal = patch.objective;
  }
  persist();
  return m;
}

export function updateMissionStatus(
  id: string,
  status: MissionStatus,
): Mission | undefined {
  return updateMission(id, { status });
}

export function appendHumanDecision(
  missionId: string,
  decision: Omit<HumanDecision, "id" | "at"> & { at?: string },
): HumanDecision | undefined {
  const m = getMission(missionId);
  if (!m) return undefined;
  const d: HumanDecision = {
    id: nid("hd"),
    at: decision.at ?? new Date().toISOString(),
    kind: decision.kind,
    actor: decision.actor,
    detail: decision.detail,
    meta: decision.meta,
  };
  m.humanDecisions.unshift(d);
  if (m.humanDecisions.length > 100) m.humanDecisions.length = 100;
  m.updatedAt = d.at;
  persist();
  return d;
}

export function createWorkstream(input: {
  missionId: string;
  title: string;
  role: Workstream["role"];
  objective?: string;
  assignedRole?: Workstream["role"];
  allowedPaths?: string[];
  forbiddenPaths?: string[];
  acceptanceCriteria?: { text: string }[];
}): Workstream | { error: string } {
  const mission = getMission(input.missionId);
  if (!mission) return { error: "mission_not_found" };

  const now = new Date().toISOString();
  const role = input.assignedRole ?? input.role;
  const objective = (input.objective ?? input.title).trim();
  const ws: Workstream = {
    id: nid("ws"),
    missionId: mission.id,
    tenantSlug: mission.tenantSlug,
    title: input.title.trim(),
    objective,
    status: "queued",
    role,
    assignedRole: role,
    allowedPaths: input.allowedPaths ?? ["lib/", "app/", "components/", "tests/", "docs/"],
    forbiddenPaths: input.forbiddenPaths ?? [
      ".env",
      ".env.local",
      ".env.production",
      "secrets/",
    ],
    acceptanceCriteria: (input.acceptanceCriteria ?? []).map((c, i) => ({
      id: `ac_${i + 1}`,
      text: c.text,
      status: "pending" as const,
    })),
    changedFiles: [],
    agentRunIds: [],
    reworkLoops: 0,
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  store().workstreams.unshift(ws);
  mission.workstreamIds.unshift(ws.id);
  mission.updatedAt = now;
  persist();
  return ws;
}

export function getWorkstream(id: string): Workstream | undefined {
  return store().workstreams.find((w) => w.id === id);
}

export function listWorkstreams(opts?: {
  missionId?: string;
  tenantSlug?: string;
  status?: WorkstreamStatus;
  limit?: number;
}): Workstream[] {
  const limit = Math.min(200, opts?.limit ?? 80);
  return store()
    .workstreams.filter((w) => {
      if (opts?.missionId && w.missionId !== opts.missionId) return false;
      if (opts?.tenantSlug && w.tenantSlug !== opts.tenantSlug) return false;
      if (opts?.status && w.status !== opts.status) return false;
      return true;
    })
    .slice(0, limit);
}

export function updateWorkstream(
  id: string,
  patch: Partial<Workstream>,
): Workstream | undefined {
  const w = getWorkstream(id);
  if (!w) return undefined;
  Object.assign(w, patch, { updatedAt: new Date().toISOString() });
  if (patch.role !== undefined && patch.assignedRole === undefined) {
    w.assignedRole = patch.role;
  }
  if (patch.assignedRole !== undefined && patch.role === undefined) {
    w.role = patch.assignedRole;
  }
  persist();
  return w;
}

export function updateWorkstreamStatus(
  id: string,
  status: WorkstreamStatus,
): Workstream | undefined {
  return updateWorkstream(id, { status });
}

export function saveEvidence(ev: WorkstreamEvidence): WorkstreamEvidence {
  const existing = store().evidence.findIndex((e) => e.id === ev.id);
  if (existing >= 0) store().evidence[existing] = ev;
  else store().evidence.unshift(ev);
  if (store().evidence.length > 400) store().evidence.length = 400;
  persist();
  return ev;
}

export function getEvidence(id: string): WorkstreamEvidence | undefined {
  return store().evidence.find((e) => e.id === id);
}

export function getEvidenceForWorkstream(
  workstreamId: string,
): WorkstreamEvidence | undefined {
  return store().evidence.find((e) => e.workstreamId === workstreamId);
}

export function createMissionRun(input: Omit<MissionAgentRun, "id">): MissionAgentRun {
  const run: MissionAgentRun = { ...input, id: nid("mrun") };
  store().runs.unshift(run);
  if (store().runs.length > 500) store().runs.length = 500;
  persist();
  return run;
}

export function getMissionRun(id: string): MissionAgentRun | undefined {
  return store().runs.find((r) => r.id === id);
}

export function updateMissionRun(
  id: string,
  patch: Partial<MissionAgentRun>,
): MissionAgentRun | undefined {
  const run = store().runs.find((r) => r.id === id);
  if (!run) return undefined;
  Object.assign(run, patch);
  persist();
  return run;
}

/** Domain foundation aliases for AgentRun CRUD. */
export function createAgentRun(input: Omit<MissionAgentRun, "id">): MissionAgentRun {
  return createMissionRun(input);
}

export function getAgentRun(id: string): MissionAgentRun | undefined {
  return getMissionRun(id);
}

export function updateAgentRun(
  id: string,
  patch: Partial<MissionAgentRun>,
): MissionAgentRun | undefined {
  return updateMissionRun(id, patch);
}

export function listAgentRuns(opts?: {
  missionId?: string;
  workstreamId?: string;
  limit?: number;
}): MissionAgentRun[] {
  return listMissionRuns(opts);
}

export function listMissionRuns(opts?: {
  missionId?: string;
  workstreamId?: string;
  limit?: number;
}): MissionAgentRun[] {
  const limit = Math.min(200, opts?.limit ?? 40);
  return store()
    .runs.filter((r) => {
      if (opts?.missionId && r.missionId !== opts.missionId) return false;
      if (opts?.workstreamId && r.workstreamId !== opts.workstreamId) return false;
      return true;
    })
    .slice(0, limit);
}

export function missionBudgetSnapshot(missionId: string): {
  budgets: MissionBudgets;
  usage: MissionBudgetUsage;
  remaining: Partial<MissionBudgets>;
} | null {
  const m = getMission(missionId);
  if (!m) return null;
  return {
    budgets: m.budgets,
    usage: m.usage,
    remaining: {
      maxTotalTokens: Math.max(0, m.budgets.maxTotalTokens - m.usage.totalTokens),
      maxToolCallsPerRun: m.budgets.maxToolCallsPerRun,
      maxTokensPerRun: m.budgets.maxTokensPerRun,
      maxRuntimeMinutes: Math.max(
        0,
        m.budgets.maxRuntimeMinutes - m.usage.runtimeMinutes,
      ),
      maxAgents: Math.max(0, m.budgets.maxAgents - m.usage.agents),
      maxChangedFiles: Math.max(
        0,
        m.budgets.maxChangedFiles - m.usage.changedFiles,
      ),
      maxReworkLoops: m.budgets.maxReworkLoops,
    },
  };
}
