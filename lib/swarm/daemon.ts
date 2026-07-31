// PraxisOS · 24/7 Meta-Harness Daemon
//
// Recurring real-time S-H swarm cycles in worktree mode.
// SAFETY (locked):
//   - Does NOT auto-merge to main
//   - Does NOT auto-deploy
//   - FREJ_GATE + human approve token still required for merge
//
// Run locally / on a worker: `npm run awaken`
// On Vercel: hit POST /api/v1/{tenant}/swarm/tick via cron every N minutes

import { publishSwarmEvent } from "@/lib/swarm/events";
import { writeJournal } from "@/lib/swarm/journal";
import { getSwarmMemory } from "@/lib/swarm/memory";
import { savageRun, listSwarmTasks } from "@/lib/swarm/meta-harness";
import { SWARM_INVARIANTS, type SwarmTaskType } from "@/lib/swarm/types";

export type DaemonState = {
  running: boolean;
  startedAt: string | null;
  cycle: number;
  lastTickAt: string | null;
  lastError: string | null;
  tenantSlug: string;
  intervalMs: number;
  /** rotating agenda index */
  agendaIndex: number;
};

type DaemonRoot = {
  state: DaemonState;
  timer: ReturnType<typeof setInterval> | null;
};

const KEY = "__praxisos_swarm_daemon_v1__";

/** Default 6h between full cycles in long-running mode; override with SWARM_INTERVAL_MS */
export const DEFAULT_SWARM_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Fast tick for "real-time" feel in demos / continuous mode */
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
    title: "H-bridge · Aria/Niels pulse",
    brief: "Route a synthetic clinic pulse: booking confirmation + journal draft readiness check.",
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
    g[KEY] = {
      state: {
        running: false,
        startedAt: null,
        cycle: 0,
        lastTickAt: null,
        lastError: null,
        tenantSlug: "bypilar",
        intervalMs: Number(process.env.SWARM_INTERVAL_MS) || DEFAULT_REALTIME_INTERVAL_MS,
        agendaIndex: 0,
      },
      timer: null,
    };
  }
  return g[KEY];
}

export function getDaemonState(): DaemonState {
  return { ...getRoot().state };
}

export function isDaemonRunning(): boolean {
  return getRoot().state.running;
}

/**
 * One autonomous cycle: rotate S/H agents, journal everything, emit realtime events.
 * Never merges or deploys.
 */
export async function tickDaemon(opts?: { tenantSlug?: string }): Promise<{
  cycle: number;
  taskId: string;
  status: string;
  agent: string;
}> {
  const root = getRoot();
  const state = root.state;
  if (opts?.tenantSlug) state.tenantSlug = opts.tenantSlug;

  const item = AGENDA[state.agendaIndex % AGENDA.length]!;
  state.agendaIndex = (state.agendaIndex + 1) % AGENDA.length;
  state.cycle += 1;
  state.lastTickAt = new Date().toISOString();

  writeJournal({
    agent: "ARIA_META",
    kind: "thought",
    content: `24/7 cycle #${state.cycle} · launching ${item.type} · merge=${SWARM_INVARIANTS.NO_AUTO_MERGE} deploy=${SWARM_INVARIANTS.NO_AUTO_DEPLOY}`,
  });
  publishSwarmEvent({
    type: "daemon",
    status: "tick",
    detail: `cycle ${state.cycle} → ${item.type}`,
  });

  try {
    const task = await savageRun({
      type: item.type,
      title: `${item.title} · c${state.cycle}`,
      brief: item.brief,
      tenantSlug: state.tenantSlug,
      priority: 2,
    });

    publishSwarmEvent({ type: "task", task });
    for (const entry of getSwarmMemory().journals.slice(0, 3)) {
      publishSwarmEvent({ type: "journal", entry });
    }

    const summary = `cycle ${state.cycle}: ${task.assignedTo} → ${task.status}`;
    publishSwarmEvent({
      type: "cycle",
      cycle: state.cycle,
      at: state.lastTickAt,
      summary,
    });

    state.lastError = null;
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
    throw err;
  }
}

export function startDaemon(opts?: {
  tenantSlug?: string;
  intervalMs?: number;
}): DaemonState {
  const root = getRoot();
  if (root.state.running) return getDaemonState();

  root.state.running = true;
  root.state.startedAt = new Date().toISOString();
  root.state.tenantSlug = opts?.tenantSlug ?? root.state.tenantSlug;
  const envInterval = Number(process.env.SWARM_INTERVAL_MS);
  root.state.intervalMs =
    opts?.intervalMs ??
    (Number.isFinite(envInterval) && envInterval > 0
      ? envInterval
      : DEFAULT_REALTIME_INTERVAL_MS);
  root.state.lastError = null;

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

  // Immediate first tick, then recurring
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

  // Prevent Node from refusing to keep process alive issues with unref in tests
  if (process.env.NODE_ENV === "test" && root.timer && "unref" in root.timer) {
    root.timer.unref();
  }

  return getDaemonState();
}

export function stopDaemon(): DaemonState {
  const root = getRoot();
  if (root.timer) {
    clearInterval(root.timer);
    root.timer = null;
  }
  root.state.running = false;
  writeJournal({
    agent: "ARIA_META",
    kind: "action",
    content: `Daemon STOPPED after ${root.state.cycle} cycles`,
  });
  publishSwarmEvent({ type: "daemon", status: "stopped" });
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
    mode: "24/7 recurring · human-gated merge/deploy",
  };
}
