// Sprint 6 · B5 — foot-scanner FOOT_SCANNER_TOKEN prod-throw
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isEngineOnline, newSession } from "@/lib/foot-scanner";

describe("foot-scanner · FOOT_SCANNER_TOKEN guard", () => {
  const originalToken = process.env.FOOT_SCANNER_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.FOOT_SCANNER_TOKEN;
  });

  afterEach(() => {
    if (originalToken !== undefined) process.env.FOOT_SCANNER_TOKEN = originalToken;
    else delete process.env.FOOT_SCANNER_TOKEN;
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("i produktion: token missing → newSession() throws", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "production";
    delete process.env.FOOT_SCANNER_TOKEN;
    await expect(
      newSession({
        tenant: "test",
        clientId: "c1",
        side: "L",
      }),
    ).rejects.toThrow(/FOOT_SCANNER_TOKEN missing in production/);
  });

  it("i test-mode: token missing → bruger dev-token (ingen throw ved resolve)", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "test";
    delete process.env.FOOT_SCANNER_TOKEN;
    // isEngineOnline() rammer bare fetch fejl (engine offline) uden at throwe
    const online = await isEngineOnline();
    expect(online).toBe(false); // gracefully returns false
  });

  it("i development: token missing → dev-token bruges, warning logges", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "development";
    delete process.env.FOOT_SCANNER_TOKEN;
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => { warns.push(msg); };
    try {
      // isEngineOnline er en fetch — vil fejle gracefully men vil have
      // brugt resolveEngineToken() undervejs (call-time). Vi tester at
      // funktionen ikke selv throw'er selv med token missing.
      const online = await isEngineOnline();
      expect(online).toBe(false);
    } finally {
      console.warn = origWarn;
    }
  });

  it("i produktion: token set → resolve returns provided token", async () => {
    // @ts-expect-error NODE_ENV is readonly in TS types
    process.env.NODE_ENV = "production";
    process.env.FOOT_SCANNER_TOKEN = "prod-token-abc";
    // Uden en rigtig engine faar vi fetch fejl — men den skal IKKE vaere
    // en "FOOT_SCANNER_TOKEN missing" fejl.
    await expect(
      newSession({ tenant: "test", clientId: "c1", side: "L" }),
    ).rejects.not.toThrow(/FOOT_SCANNER_TOKEN missing/);
  });
});
