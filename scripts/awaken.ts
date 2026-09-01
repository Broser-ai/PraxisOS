/**
 * Local Autonom / S-H swarm awaken (non-Vercel).
 *
 * Starts the in-process daemon interval. Does NOT merge or deploy.
 * Clinical path stays suggestion-only; NO_AUTO_MERGE / NO_AUTO_DEPLOY stay locked.
 *
 *   npx tsx scripts/awaken.ts
 *   PRAXIS_DEFAULT_TENANT=bypilar SWARM_INTERVAL_MS=3600000 npx tsx scripts/awaken.ts
 */
import { startDaemon, stopDaemon, getAutonomousSnapshot } from "../lib/swarm/daemon";
import { isSwarmEnabled } from "../lib/swarm/meta-harness";
import { SWARM_INVARIANTS } from "../lib/swarm/types";
import { PRIME_INVARIANTS } from "../lib/prime/types";

const tenant = process.env.PRAXIS_DEFAULT_TENANT || "bypilar";

if (!isSwarmEnabled()) {
  console.error("[awaken] PRAXIS_SWARM_ENABLED=false — refusing to start");
  process.exit(1);
}

if (SWARM_INVARIANTS.NO_AUTO_MERGE !== true || SWARM_INVARIANTS.NO_AUTO_DEPLOY !== true) {
  console.error("[awaken] swarm invariants broken — refusing to start");
  process.exit(1);
}

if (PRIME_INVARIANTS.NO_MODEL_TRAINING !== true) {
  console.error("[awaken] PRIME NO_MODEL_TRAINING broken — refusing to start");
  process.exit(1);
}

const state = startDaemon({ tenantSlug: tenant });
const snap = getAutonomousSnapshot();

console.log(
  `[awaken] daemon · tenant=${tenant} · running=${state.running} · intervalMs=${state.intervalMs}`,
);
console.log(
  `[awaken] agenda=${snap.agenda.join(",")} · merge=${SWARM_INVARIANTS.NO_AUTO_MERGE} · deploy=${SWARM_INVARIANTS.NO_AUTO_DEPLOY} · lora/training=forbidden`,
);
console.log("[awaken] Ctrl+C to stop · human gate: npm run harness:human-gate");

function shutdown() {
  try {
    stopDaemon();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
