// Bonus-test til INV-3 (PII-redaktion)
import { describe, it, expect } from "vitest";
import { redactPII, redactString, containsRawCpr } from "@/lib/redact";

describe("PII redaction (INV-3 support)", () => {
  it("redagter CPR med bindestreg", () => {
    expect(redactString("Klient 010190-1234 kommer i morgen")).toBe(
      "Klient XXXXXX-1234 kommer i morgen",
    );
  });

  it("redagter CPR uden separator", () => {
    expect(redactString("cpr: 0101901234")).toBe("cpr: XXXXXX1234");
  });

  it("redagter CPR i nested object", () => {
    const input = {
      client: { name: "Test", cpr: "010190-1234" },
      messages: ["cpr er 010190-1234"],
    };
    const out = redactPII(input);
    expect(containsRawCpr(out)).toBe(false);
    expect(JSON.stringify(out)).toContain("XXXXXX-1234");
  });

  it("bevarer cpr_hashed felt uændret", () => {
    const hashed = "a".repeat(64);
    const input = { cpr_hashed: hashed };
    const out = redactPII(input);
    expect(out.cpr_hashed).toBe(hashed);
  });

  it("containsRawCpr fanger 10-cifret sekvens", () => {
    expect(containsRawCpr({ x: "1234567890" })).toBe(true);
    expect(containsRawCpr({ x: "010190-1234" })).toBe(true);
    expect(containsRawCpr({ x: "harmless" })).toBe(false);
  });
});
