// Sprint 6 Batch 2 · B3-b
// Verificerer at password er scrypt-hashed og at verify accepterer/afviser
// korrekt. Vi checker også at demo-accounts ikke længere har plaintext feltet.

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  findAccount,
  accounts,
} from "@/lib/auth";

describe("password hashing (B3-b)", () => {
  it("hash format er 'scrypt$<salthex>$<hashhex>' med korrekte længder", () => {
    const h = hashPassword("s3cret!");
    const parts = h.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toHaveLength(64); // 32 bytes hex
    expect(parts[2]).toHaveLength(128); // 64 bytes hex
  });

  it("to hashes af samme password har forskellig salt (og hash)", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toEqual(b);
    expect(verifyPassword("same", a)).toBe(true);
    expect(verifyPassword("same", b)).toBe(true);
  });

  it("verifyPassword returnerer true på match og false på mismatch", () => {
    const h = hashPassword("Grønært42");
    expect(verifyPassword("Grønært42", h)).toBe(true);
    expect(verifyPassword("Grønært43", h)).toBe(false);
    expect(verifyPassword("", h)).toBe(false);
  });

  it("verifyPassword afviser ugyldigt format uden at kaste", () => {
    expect(verifyPassword("x", "not-scrypt")).toBe(false);
    expect(verifyPassword("x", "scrypt$deadbeef$deadbeef")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    // @ts-expect-error force non-string
    expect(verifyPassword("x", undefined)).toBe(false);
  });

  it("demo-accounts har passwordHash, ikke plaintext password", () => {
    for (const acc of accounts) {
      expect(acc.passwordHash.startsWith("scrypt$")).toBe(true);
      // Sikrer at det gamle 'password'-felt er fjernet
      expect((acc as unknown as Record<string, unknown>).password).toBeUndefined();
    }
  });

  it("findAccount virker med korrekt password og afviser forkert", () => {
    const ok = findAccount("pilar@bypilar.dk", "demo");
    expect(ok?.id).toBe("acc_pilar");
    expect(findAccount("pilar@bypilar.dk", "wrong")).toBeUndefined();
    expect(findAccount("nobody@nowhere.dk", "demo")).toBeUndefined();
  });
});
