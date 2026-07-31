// PraxisOS · 24/7 Meta-Harness Daemon
//
// Recurring S-H swarm cycles. Local awaken uses setInterval; Vercel uses cron ticks.
// SAFETY: NO_AUTO_MERGE / NO_AUTO_DEPLOY — human approve still required.

import { publishSwarmEvent } from "@/lib/swarm/events";
import { writeJournal } from "@/lib/swarm/journal";
import { flushSwarmMemory, getSwarmMemory } from "@/lib/swarm/memory";
import { listSwarmTasks, savageRun } from "@/lib/swarm/meta-harness";
import { SWARM_INVARIANTS, type SwarmTaskType } from "@/lib/swarm/types";

export type DaemonState = {
  running: boolean;
  cronEnabled: boolean;
  startedAt: string | null;
  cycle: number;
  lastTickAt: string | null;
  lastError: string | null;
  tenantSlug: string;
  intervalMs: number;
  agendaIndex: number;
  tickInFlight: boolean;
};

type DaemonRoot = {
  state: DaemonState;
  timer: ReturnType<typeof setInterval> | null;
};

const KEY = "__praxisos_swarm_daemon_v1__";

export const DEFAULT_SWARM_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_REALTIME_INTERVAL_MS = 60_000;

type AgendaItem = {
  type: SwarmTaskType;
  title: string;
  brief: string;
};

const AGENDA: AgendaItem[] = [
  {
    type: "research",
    title: "LUNA · overnight research sweep",
    brief: "Harvest actionable improvements for booking, e-learning verifiable rewards, and MDR-safe clinical UX.",
  },
  {
    type: "improve",
    title: "FELIX · self-improve proposals",
    brief: "Propose measurable upgrades to working-core, swarm journals, and test coverage.",
  },
  {
    type: "clinical_h",
    title: "H-bridge · Aria clinic pulse",
    brief: "Confirm clinic loop: list bookings and create a follow-up booking for swarm pulse client.",
  },
  {
    type: "audit",
    title: "FREJ · compliance heartbeat",
    brief: "Re-verify NO_AUTO_MERGE, tenant isolation posture, and Class IIa freeze.",
  },
  {
    type: "worktree_exec",
    title: "ATLAS · savage worktree plan",
    brief: "Open/refresh a worktree with an additive implementation plan for the highest-priority improve item.",
  },
];

function getRoot(): DaemonRoot {
  const g = globalThis as typeof globalThis & { [KEY]?: DaemonRoot };
  if (!g[KEY]) {
    const slice = getSwarmMemory().daemonSlice;
    g[KEY] = {
      state: {
        running: false,
        cronEnabled: slice.cronEnabled,
        startedAt: null,
        cycle: slice.cycle,
        lastTickAt: slice.lastTickAt,
        lastError: null,
        tenantSlug: slice.tenantSlug,
        intervalMs: slice.intervalMs || DEFAULT_REALTIME_INTERVAL_MS,
        agendaIndex: slice.agendaIndex,
        tickInFlight: false,
      },
      timer: null,
    };
  }
  return g[KEY];
}

function syncSlice(): void {
  const state = getRoot().state;
  const mem = getSwarmMemory();
  mem.daemonSlice = {
    cycle: state.cycle,
    agendaIndex: state.agendaIndex,
    tenantSlug: state.tenantSlug,
    intervalMs: state.intervalMs,
    lastTickAt: state.lastTickAt,
    running: state.running || state.cronEnabled,
    cronEnabled: state.cronEnabled,
  };
  flushSwarmMemory();
}

export function getDaemonState(): DaemonState {
  return { ...getRoot().state };
}

export function isDaemonRunning(): boolean {
  const s = getRoot().state;
  return s.running || s.cronEnabled;
}

/** Test-only: force/clear tick mutex. */
export function __setTickInFlightForTests(value: boolean): void {
  getRoot().state.tickInFlight = value;
}

export async function tickDaemon(opts?: { tenantSlug?: string }): Promise<{
  cycle: number;
  taskId: string;
  status: string;
  agent: string;
}> {
  const root = getRoot();
  const state = root.state;

  if (state.tickInFlight) {
    throw new Error("tick_in_flight");
  }
  state.tickInFlight = true;

  try {
    if (opts?.tenantSlug) state.tenantSlug = opts.tenantSlug;

    const item = AGENDA[state.agendaIndex % AGENDA.length]!;
    state.agendaIndex = (state.agendaIndex + 1) % AGENDA.length;
    state.cycle += 1;
    state.lastTickAt = new Date().toISOString();

    writeJournal({
      agent: "ARIA_META",
      kind: "thought",
      content: `24/7 cycle #${state.cycle} · ${item.type} · merge=${SWARM_INVARIANTS.NO_AUTO_MERGE} deploy=${SWARM_INVARIANTS.NO_AUTO_DEPLOY}`,
    });
    publishSwarmEvent({
      type: "daemon",
      status: "tick",
      detail: `cycle ${state.cycle} → ${item.type}`,
    });

    const task = await savageRun({
      type: item.type,
      title: `${item.title} · c${state.cycle}`,
      brief: item.brief,
      tenantSlug: state.tenantSlug,
      priority: 2,
    });

    publishSwarmEvent({ type: "task", task });
    const summary = `cycle ${state.cycle}: ${task.assignedTo} → ${task.status}`;
    publishSwarmEvent({
      type: "cycle",
      cycle: state.cycle,
      at: state.lastTickAt,
      summary,
    });

    state.lastError = null;
    syncSlice();
    return {
      cycle: state.cycle,
      taskId: task.id,
      status: task.status,
      agent: task.assignedTo,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.lastError = message;
    publishSwarmEvent({ type: "daemon", status: "error", detail: message });
    writeJournal({
      agent: "SYSTEM",
      kind: "result",
      content: `Daemon tick failed: ${message}`,
    });
    syncSlice();
    throw err;
  } finally {
    state.tickInFlight = false;
  }
}

export function startDaemon(opts?: {
  tenantSlug?: string;
  intervalMs?: number;
}): DaemonState {
  const root = getRoot();
  const envInterval = Number(process.env.SWARM_INTERVAL_MS);
  root.state.tenantSlug = opts?.tenantSlug ?? root.state.tenantSlug;
  root.state.intervalMs =
    opts?.intervalMs ??
    (Number.isFinite(envInterval) && envInterval > 0
      ? envInterval
      : DEFAULT_REALTIME_INTERVAL_MS);
  root.state.cronEnabled = true;
  root.state.lastError = null;

  // On Vercel: only enable cron flag (no setInterval in lambda)
  const isServerless = process.env.VERCEL === "1";

  if (!isServerless) {
    if (root.state.running && root.timer) return getDaemonState();
    root.state.running = true;
    root.state.startedAt = new Date().toISOString();

    writeJournal({
      agent: "ARIA_META",
      kind: "action",
      content: `Daemon AWAKENED · interval ${root.state.intervalMs}ms · tenant=${root.state.tenantSlug}`,
    });
    publishSwarmEvent({
      type: "daemon",
      status: "started",
      detail: `interval=${root.state.intervalMs}ms`,
    });

    void tickDaemon().catch(() => undefined);

    root.timer = setInterval(() => {
      void tickDaemon().catch(() => undefined);
      const uptime = root.state.startedAt
        ? Date.now() - new Date(root.state.startedAt).getTime()
        : 0;
      publishSwarmEvent({
        type: "heartbeat",
        at: new Date().toISOString(),
        uptimeMs: uptime,
      });
    }, root.state.intervalMs);

    if (process.env.NODE_ENV === "test" && root.timer && "unref" in root.timer) {
      root.timer.unref();
    }
  } else {
    root.state.running = false;
    root.state.startedAt = new Date().toISOString();
    writeJournal({
      agent: "ARIA_META",
      kind: "action",
      content: `Cron-enabled AWAKEN · Vercel ticks via /api/cron/swarm-tick · tenant=${root.state.tenantSlug}`,
    });
    publishSwarmEvent({
      type: "daemon",
      status: "started",
      detail: "vercel-cron-mode",
    });
  }

  syncSlice();
  return getDaemonState();
}

export function stopDaemon(): DaemonState {
  const root = getRoot();
  if (root.timer) {
    clearInterval(root.timer);
    root.timer = null;
  }
  root.state.running = false;
  root.state.cronEnabled = false;
  writeJournal({
    agent: "ARIA_META",
    kind: "action",
    content: `Daemon STOPPED after ${root.state.cycle} cycles`,
  });
  publishSwarmEvent({ type: "daemon", status: "stopped" });
  syncSlice();
  return getDaemonState();
}

export function getAutonomousSnapshot() {
  const state = getDaemonState();
  const tasks = listSwarmTasks(state.tenantSlug);
  return {
    daemon: state,
    invariants: SWARM_INVARIANTS,
    recentTasks: tasks.slice(0, 10),
    agenda: AGENDA.map((a) => a.type),
    mode: state.running
      ? "24/7 in-process interval"
      : state.cronEnabled
        ? "24/7 cron ticks"
        : "idle",
  };
}
