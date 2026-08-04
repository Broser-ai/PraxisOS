// Real-time swarm event bus (process-local). SSE subscribers attach here.

import { EventEmitter } from "node:events";
import type { JournalEntry, SwarmTask } from "@/lib/swarm/types";

export type SwarmRealtimeEvent =
  | { type: "journal"; entry: JournalEntry }
  | { type: "task"; task: SwarmTask }
  | { type: "cycle"; cycle: number; at: string; summary: string }
  | { type: "daemon"; status: "started" | "stopped" | "tick" | "error"; detail?: string }
  | { type: "heartbeat"; at: string; uptimeMs: number };

type SwarmBus = EventEmitter & {
  publish(event: SwarmRealtimeEvent): void;
};

const KEY = "__praxisos_swarm_bus_v1__";

export function getSwarmBus(): SwarmBus {
  const g = globalThis as typeof globalThis & { [KEY]?: SwarmBus };
  if (!g[KEY]) {
    const bus = new EventEmitter() as SwarmBus;
    bus.setMaxListeners(100);
    bus.publish = (event: SwarmRealtimeEvent) => {
      bus.emit("swarm", event);
    };
    g[KEY] = bus;
  }
  return g[KEY];
}

export function publishSwarmEvent(event: SwarmRealtimeEvent): void {
  getSwarmBus().publish(event);
}
