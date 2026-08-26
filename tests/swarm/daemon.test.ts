import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getDaemonState,
  startDaemon,
  stopDaemon,
  tickDaemon,
  SWARM_INVARIANTS,
  __setTickInFlightForTests,
} from "@/lib/swarm";
import { resetSwarmMemoryForTests } from "@/lib/swarm/memory";

describe("24/7 meta-harness daemon", () => {
  beforeEach(() => {
    resetSwarmMemoryForTests();
    stopDaemon();
  });

  afterEach(() => {
    stopDaemon();
  });

  it("tick rotates agenda and creates a task without merging", async () => {
    const r1 = await tickDaemon({ tenantSlug: "bypilar" });
    expect(r1.cycle).toBeGreaterThanOrEqual(1);
    expect(r1.taskId).toBeTruthy();
    expect(r1.agent).toBeTruthy();

    const r2 = await tickDaemon({ tenantSlug: "bypilar" });
    expect(r2.cycle).toBe(r1.cycle + 1);

    expect(SWARM_INVARIANTS.NO_AUTO_MERGE).toBe(true);
    expect(SWARM_INVARIANTS.NO_AUTO_DEPLOY).toBe(true);
  });

  it("refuses overlapping ticks", async () => {
    __setTickInFlightForTests(true);
    await expect(tickDaemon({ tenantSlug: "bypilar" })).rejects.toThrow(/tick_in_flight/);
    __setTickInFlightForTests(false);
  });

  it("startDaemon marks running and stopDaemon clears timer", () => {
    const started = startDaemon({
      tenantSlug: "bypilar",
      intervalMs: 60_000,
    });
    expect(started.running).toBe(true);
    expect(getDaemonState().running).toBe(true);

    const stopped = stopDaemon();
    expect(stopped.running).toBe(false);
  });
});
