// Sprint 6 · B5 — SharedStore contract-test
import { describe, it, expect } from "vitest";
import { createMemorySharedStore } from "@/lib/shared-store/memory-store";
import { createRedisSharedStore } from "@/lib/shared-store/redis-stub";
import { NotImplementedError } from "@/lib/shared-store/adapter";

describe("shared-store · memory-impl contract", () => {
  it("getCounter defaults to 0", async () => {
    const s = createMemorySharedStore();
    expect(await s.getCounter("unknown")).toBe(0);
  });
  it("increment returns new value and persists", async () => {
    const s = createMemorySharedStore();
    expect(await s.incrementCounter("a", 3)).toBe(3);
    expect(await s.incrementCounter("a", 2)).toBe(5);
    expect(await s.getCounter("a")).toBe(5);
  });
  it("setCounterWithTtl sets absolute value with expiry", async () => {
    const s = createMemorySharedStore();
    await s.setCounterWithTtl("b", 42, 60000);
    expect(await s.getCounter("b")).toBe(42);
  });
  it("resetCounter clears counter", async () => {
    const s = createMemorySharedStore();
    await s.incrementCounter("c", 10);
    await s.resetCounter("c");
    expect(await s.getCounter("c")).toBe(0);
  });
  it("expired counter returns 0", async () => {
    const s = createMemorySharedStore();
    await s.setCounterWithTtl("d", 5, 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(await s.getCounter("d")).toBe(0);
  });
  it("incrementCounter preserves TTL of existing bucket", async () => {
    const s = createMemorySharedStore();
    await s.setCounterWithTtl("e", 1, 60000);
    expect(await s.incrementCounter("e", 4)).toBe(5);
    expect(await s.getCounter("e")).toBe(5);
  });
});

describe("shared-store · redis-stub throws with guidance", () => {
  it("getCounter throws NotImplementedError", async () => {
    await expect(createRedisSharedStore().getCounter("x")).rejects.toBeInstanceOf(NotImplementedError);
  });
  it("incrementCounter throws NotImplementedError", async () => {
    await expect(createRedisSharedStore().incrementCounter("x", 1)).rejects.toBeInstanceOf(NotImplementedError);
  });
  it("setCounterWithTtl throws NotImplementedError", async () => {
    await expect(createRedisSharedStore().setCounterWithTtl("x", 1, 100)).rejects.toBeInstanceOf(NotImplementedError);
  });
  it("resetCounter throws NotImplementedError", async () => {
    await expect(createRedisSharedStore().resetCounter("x")).rejects.toBeInstanceOf(NotImplementedError);
  });
  it("error message includes Upstash guidance", async () => {
    try {
      await createRedisSharedStore().getCounter("x");
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(/Upstash Redis/);
    }
  });
});
