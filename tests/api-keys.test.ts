import { describe, expect, it } from "vitest";
import { listApiKeys, verifyApiKey } from "@/lib/api-keys";

describe("verifyApiKey", () => {
  it("accepts known active bypilar production secret with scope", () => {
    const r = verifyApiKey(
      "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47",
      "bypilar",
      "read:bookings",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key.id).toBe("key_001");
  });

  it("rejects prefix-only / fake UI tokens", () => {
    expect(verifyApiKey("sk_test_ui", "bypilar").ok).toBe(false);
    expect(verifyApiKey("sk_live_not_a_real_key_xxxxxx", "bypilar").ok).toBe(false);
  });

  it("rejects revoked sandbox key", () => {
    const r = verifyApiKey("sk_test_dead0000beef0000", "bypilar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("key_revoked");
  });

  it("rejects masked display secrets", () => {
    expect(verifyApiKey("sk_live_3e1b8a2c9f47****", "bypilar").ok).toBe(false);
  });

  it("rejects wrong tenant", () => {
    const r = verifyApiKey(
      "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47",
      "nordlys",
    );
    expect(r.ok).toBe(false);
  });

  it("rejects insufficient scope", () => {
    const r = verifyApiKey(
      "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47",
      "bypilar",
      "write:journal",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("insufficient_scope");
  });

  it("listApiKeys never returns full secrets", () => {
    for (const k of listApiKeys("bypilar")) {
      expect(k.hashedSecret.includes("*") || k.hashedSecret.endsWith("****")).toBe(
        true,
      );
      expect(k.hashedSecret.length).toBeLessThan(40);
    }
  });
});
