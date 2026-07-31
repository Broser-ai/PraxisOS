// Sprint 6 · B5 — LiveKit isMock honesty + no API-key leak
import { describe, it, expect, afterEach } from "vitest";
import { issueLiveKitToken } from "@/lib/voice/livekit-adapter";

describe("livekit-adapter · honest isMock + no key leak", () => {
  const original = {
    key: process.env.LIVEKIT_API_KEY,
    secret: process.env.LIVEKIT_API_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };

  afterEach(() => {
    if (original.key !== undefined) process.env.LIVEKIT_API_KEY = original.key;
    else delete process.env.LIVEKIT_API_KEY;
    if (original.secret !== undefined) process.env.LIVEKIT_API_SECRET = original.secret;
    else delete process.env.LIVEKIT_API_SECRET;
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = original.nodeEnv;
  });

  it("uden nogler i dev/test → returnerer isMock:true", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "test";
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    const token = await issueLiveKitToken({
      roomName: "room-1",
      participantIdentity: "user-1",
    });
    expect(token.isMock).toBe(true);
    expect(token.jwt.startsWith("mock.")).toBe(true);
  });

  it("uden nogler i prod → throws (ma ikke silent-fake)", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "production";
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    await expect(
      issueLiveKitToken({ roomName: "r", participantIdentity: "u" }),
    ).rejects.toThrow(/missing in production/);
  });

  it("med nogler men uden SDK i dev → isMock:true (ikke fake-signed)", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "development";
    process.env.LIVEKIT_API_KEY = "APIabcd1234efgh5678";
    process.env.LIVEKIT_API_SECRET = "SECRET-VALUE";
    const token = await issueLiveKitToken({
      roomName: "room-x",
      participantIdentity: "user-y",
    });
    // SDK er ikke installeret i denne repo — skulle returnere isMock:true
    expect(token.isMock).toBe(true);
    // JWT lokale ma IKKE indeholde nogen del af API-keyen
    expect(token.jwt).not.toContain("APIa");
    expect(token.jwt).not.toContain("APIabcd");
    expect(token.jwt).not.toContain("SECRET");
  });

  it("med nogler men uden SDK i prod → throws (ma ikke silent-fake)", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "production";
    process.env.LIVEKIT_API_KEY = "APIabcd1234";
    process.env.LIVEKIT_API_SECRET = "SECRET";
    await expect(
      issueLiveKitToken({ roomName: "r", participantIdentity: "u" }),
    ).rejects.toThrow(/not installed but LIVEKIT_API_KEY is set/);
  });
});
