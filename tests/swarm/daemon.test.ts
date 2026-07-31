import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getDaemonState,
  startDaemon,
  stopDaemon,
  tickDaemon,
  SWARM_INVARIANTS,
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
    expect(r1.cycle).toBe(1);
    expect(r1.taskId).toBeTruthy();
    expect(r1.agent).toBeTruthy();

    const r2 = await tickDaemon({ tenantSlug: "bypilar" });
    expect(r2.cycle).toBe(2);
    expect(r2.agent).not.toBe(r1.agent); // agenda rotated (usually)

    expect(SWARM_INVARIANTS.NO_AUTO_MERGE).toBe(true);
    expect(SWARM_INVARIANTS.NO_AUTO_DEPLOY).toBe(true);
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
