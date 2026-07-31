// Shared in-process registry for async orchestrator runs (poll via runs/[runId]).

import type { RunResult } from "@/lib/orchestrator";

const KEY_DONE = "__praxisos_orch_completed__";
const KEY_INFLIGHT = "__praxisos_orch_inflight__";

export function orchRunMaps() {
  const g = globalThis as typeof globalThis & {
    [KEY_DONE]?: Map<string, RunResult>;
    [KEY_INFLIGHT]?: Map<string, Promise<RunResult>>;
  };
  if (!g[KEY_DONE]) g[KEY_DONE] = new Map();
  if (!g[KEY_INFLIGHT]) g[KEY_INFLIGHT] = new Map();
  return { completed: g[KEY_DONE], inflight: g[KEY_INFLIGHT] };
}
