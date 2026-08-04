#!/usr/bin/env tsx
/**
 * PraxisOS · Awaken 24/7 S-H Meta-Harness Daemon
 *
 *   npm run awaken
 *   SWARM_INTERVAL_MS=30000 TENANT=bypilar npm run awaken
 */

import {
  getAutonomousSnapshot,
  startDaemon,
} from "../lib/swarm/daemon";
import { getSwarmBus } from "../lib/swarm/events";
import { SWARM_INVARIANTS } from "../lib/swarm/types";

const intervalMs = Number(process.env.SWARM_INTERVAL_MS || 60_000);
const tenant = process.env.TENANT || "bypilar";

console.log("🚀 PraxisOS Swarm · Awakening meta-harness…");
console.log(`   tenant=${tenant} intervalMs=${intervalMs}`);
console.log(
  `   NO_AUTO_MERGE=${SWARM_INVARIANTS.NO_AUTO_MERGE} NO_AUTO_DEPLOY=${SWARM_INVARIANTS.NO_AUTO_DEPLOY}`,
);

startDaemon({ tenantSlug: tenant, intervalMs });

getSwarmBus().on("swarm", (ev) => {
  console.log(`[swarm] ${JSON.stringify(ev).slice(0, 320)}`);
});

setInterval(() => {
  const snap = getAutonomousSnapshot();
  console.log(
    `[heartbeat] cycle=${snap.daemon.cycle} running=${snap.daemon.running} last=${snap.daemon.lastTickAt}`,
  );
}, Math.max(intervalMs, 15_000));

console.log("✅ Daemon online · 24/7 recurring · Ctrl+C to stop.");

process.on("SIGINT", () => {
  console.log("\nStopping…");
  process.exit(0);
});
