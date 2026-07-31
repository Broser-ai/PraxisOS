// Sprint 6 Batch 2 · B3-a
// Verificerer at HMAC-signering på session-tokens detekterer tampering:
// enhver ændring i payload eller signatur skal give null fra decodeSession.

import { describe, it, expect } from "vitest";
import { encodeSession, decodeSession, type Session } from "@/lib/auth";
import { encodeSignedSession, decodeSignedSession } from "@/lib/session-token";

const S: Session = {
  accountId: "acc_pilar",
  tenant: "bypilar",
  role: "owner",
  loggedInAt: "2026-07-16T10:00:00.000Z",
};

describe("session HMAC signing (B3-a)", () => {
  it("round-trip encode/decode returns identical payload", () => {
    const token = encodeSession(S);
    const decoded = decodeSession(token);
    expect(decoded).toEqual(S);
  });

  it("token har præcis to segmenter (payload.signature)", () => {
    const token = encodeSession(S);
    expect(token.split(".")).toHaveLength(2);
  });

  it("modificeret payload afvises (tampered role)", () => {
    const token = encodeSession(S);
    const [payloadB64, sig] = token.split(".");
    // Byt payload'en ud med en anden legitim payload, behold gammel sig
    const evil = encodeSignedSession({ ...S, role: "owner", tenant: "nordlys" });
    const evilPayload = evil.split(".")[0];
    const tamperedToken = `${evilPayload}.${sig}`;
    expect(decodeSession(tamperedToken)).toBeNull();
  });

  it("modificeret signatur afvises", () => {
    const token = encodeSession(S);
    const [payload] = token.split(".");
    // Erstat sig med garbage af samme længde
    const fakeSig = "A".repeat(43); // ~32 bytes base64url
    expect(decodeSession(`${payload}.${fakeSig}`)).toBeNull();
  });

  it("token uden signatur afvises", () => {
    const token = encodeSession(S);
    const [payload] = token.split(".");
    expect(decodeSession(payload)).toBeNull();
    expect(decodeSession("")).toBeNull();
  });

  it("uafhængig encoder/decoder wrapper virker for generisk payload", () => {
    const p = { a: 1, b: "x", c: [true, false] };
    const t = encodeSignedSession(p);
    expect(decodeSignedSession<typeof p>(t)).toEqual(p);
  });

  it("null / undefined / non-string token returnerer null", () => {
    expect(decodeSignedSession<Session>(null)).toBeNull();
    expect(decodeSignedSession<Session>(undefined)).toBeNull();
    // @ts-expect-error force non-string
    expect(decodeSignedSession<Session>(123)).toBeNull();
  });
});
