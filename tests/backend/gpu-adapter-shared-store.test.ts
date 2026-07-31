// Sprint 6 · B5b — GPU-budget via SharedStore
import { describe, it, expect, beforeEach } from "vitest";
import {
  assertGpuBudget,
  recordGpuUsage,
  resetGpuBudget,
  createStubLifter,
  GPU_HOURLY_LIMIT_SEC,
} from "@/lib/scanner/gpu-adapter";
import { createMemorySharedStore } from "@/lib/shared-store/memory-store";
import { setDefaultSharedStore, type SharedStore } from "@/lib/shared-store/adapter";

describe("gpu-adapter · SharedStore integration", () => {
  beforeEach(() => {
    setDefaultSharedStore(createMemorySharedStore());
  });

  it("recordGpuUsage persists in default SharedStore (cumulative)", async () => {
    await recordGpuUsage("tenant-a", 42);
    await recordGpuUsage("tenant-a", 8);
    await expect(
      assertGpuBudget("tenant-a", GPU_HOURLY_LIMIT_SEC - 49),
    ).rejects.toThrow(/INV-CS-14/);
    await assertGpuBudget("tenant-a", GPU_HOURLY_LIMIT_SEC - 50);
  });

  it("assertGpuBudget throws over cost-loft", async () => {
    await recordGpuUsage("tenant-x", 290);
    await expect(assertGpuBudget("tenant-x", 20)).rejects.toThrow(/INV-CS-14/);
  });

  it("resetGpuBudget(tenant) clears only that tenants bucket", async () => {
    await recordGpuUsage("tenant-1", 100);
    await recordGpuUsage("tenant-2", 100);
    await resetGpuBudget("tenant-1");
    await assertGpuBudget("tenant-1", 300);
    await expect(assertGpuBudget("tenant-2", 250)).rejects.toThrow(/INV-CS-14/);
  });

  it("interface is swappable — test-double records all calls", async () => {
    const calls: string[] = [];
    const spyStore: SharedStore = {
      async getCounter(k) { calls.push("get:" + k); return 0; },
      async incrementCounter(k, by) { calls.push("incr:" + k + ":" + by); return by; },
      async setCounterWithTtl(k, v, ttl) { calls.push("set:" + k + ":" + v + ":" + ttl); },
      async resetCounter(k) { calls.push("reset:" + k); },
    };
    await assertGpuBudget("tenant-swap", 10, spyStore);
    await recordGpuUsage("tenant-swap", 10, spyStore);
    expect(calls.some((c) => c.startsWith("get:gpu:budget:hourly:tenant-swap"))).toBe(true);
    expect(calls.some((c) => c.startsWith("set:gpu:budget:hourly:tenant-swap:10:"))).toBe(true);
  });

  it("5 stub-lift kald pa warm-instances (simuleret) tracker samlet forbrug", async () => {
    const store = createMemorySharedStore();
    setDefaultSharedStore(store);
    const tenantId = "tenant-warm";
    for (let i = 0; i < 5; i++) {
      const lifter = createStubLifter();
      await lifter({
        scanId: "scan-" + i,
        tenantId,
        framesUrl: "stub://",
        framesCount: 1,
        calibrationMode: "monocular",
      });
    }
    const currentUsage = await store.getCounter("gpu:budget:hourly:" + tenantId);
    expect(currentUsage).toBe(5);
  });
});
