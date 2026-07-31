// Sprint 6 · B5c — Rate-limit via SharedStore
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordAttempt,
  getBackoffMs,
  requiresCaptcha,
  getAttempts,
} from "@/lib/rate-limit";
import { createMemorySharedStore } from "@/lib/shared-store/memory-store";
import { setDefaultSharedStore } from "@/lib/shared-store/adapter";

describe("rate-limit · brute-force protection persists via SharedStore", () => {
  beforeEach(() => {
    setDefaultSharedStore(createMemorySharedStore());
  });

  it("brute-force fra samme IP eskalerer backoff efter 3 fejl", async () => {
    const ip = "203.0.113.7";
    const email = "victim@example.dk";
    for (let i = 0; i < 3; i++) {
      await recordAttempt(ip, email, false);
    }
    expect(await getBackoffMs(ip, email)).toBeGreaterThan(0);
    expect(await requiresCaptcha(ip, email)).toBe(true);
  });

  it("attacker der roterer email men beholder IP faenges pa IP-key", async () => {
    const ip = "203.0.113.7";
    await recordAttempt(ip, "user1@a.dk", false);
    await recordAttempt(ip, "user2@a.dk", false);
    await recordAttempt(ip, "user3@a.dk", false);
    await recordAttempt(ip, "user4@a.dk", false);
    const stats = await getAttempts(ip, "user5@a.dk");
    expect(stats.ip).toBe(4);
    expect(await getBackoffMs(ip, "user5@a.dk")).toBeGreaterThan(0);
  });

  it("attacker der roterer IP men targeter samme user faenges pa user-key", async () => {
    const email = "victim@a.dk";
    await recordAttempt("1.1.1.1", email, false);
    await recordAttempt("2.2.2.2", email, false);
    await recordAttempt("3.3.3.3", email, false);
    await recordAttempt("4.4.4.4", email, false);
    const stats = await getAttempts("5.5.5.5", email);
    expect(stats.user).toBe(4);
    expect(await getBackoffMs("5.5.5.5", email)).toBeGreaterThan(0);
  });

  it("success nulstiller counters", async () => {
    const ip = "10.0.0.1";
    const email = "ok@a.dk";
    await recordAttempt(ip, email, false);
    await recordAttempt(ip, email, false);
    await recordAttempt(ip, email, true);
    const stats = await getAttempts(ip, email);
    expect(stats.ip).toBe(0);
    expect(stats.user).toBe(0);
  });

  it("case-insensitive email-key", async () => {
    await recordAttempt("1.1.1.1", "Alice@Example.DK", false);
    await recordAttempt("2.2.2.2", "alice@example.dk", false);
    const stats = await getAttempts("3.3.3.3", "ALICE@EXAMPLE.DK");
    expect(stats.user).toBe(2);
  });

  it("state lever i SharedStore — swap til fresh store nulstiller counters", async () => {
    const store1 = createMemorySharedStore();
    setDefaultSharedStore(store1);
    const ip = "9.9.9.9";
    const email = "swap@a.dk";
    for (let i = 0; i < 4; i++) await recordAttempt(ip, email, false);
    expect(await getBackoffMs(ip, email)).toBeGreaterThan(0);
    // Fresh store = fresh counters
    setDefaultSharedStore(createMemorySharedStore());
    expect(await getBackoffMs(ip, email)).toBe(0);
  });
});
