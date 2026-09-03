// F17 · consent onboarding wiring.
// POST /api/v1/{tenant}/consent records recordConsentEvent for checked
// purposes (channel web_onboarding). Onboarding page calls it on accept.
// Rate-limited; required treatment+journal; no staff session.

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST as consentPost } from "@/app/api/v1/[tenant]/consent/route";
import {
  _resetConsentEventsForTests,
  _readConsentEventsForTests,
  hasActiveConsent,
} from "@/lib/consent";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import {
  _resetBookingRateLimitForTests,
} from "@/lib/public-booking-kit";

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

function postConsent(tenant: string, body: unknown, init?: RequestInit) {
  return consentPost(
    new Request(`http://localhost/api/v1/${tenant}/consent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      body: JSON.stringify(body),
    }),
    ctx(tenant),
  );
}

describe("F17 · POST /api/v1/{tenant}/consent", () => {
  beforeEach(() => {
    _resetConsentEventsForTests();
    _resetBookingRateLimitForTests();
    _clearMemorySink();
  });

  it("records granted events for checked purposes (web_onboarding)", async () => {
    const res = await postConsent("bypilar", {
      clientId: "cli_onb_test",
      consents: { treatment: true, journal: true, marketing: true, research: false },
      consentVersion: "bypilar-onboarding-v1",
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.clientId).toBe("cli_onb_test");
    expect(json.recorded.map((r: { purpose: string }) => r.purpose).sort()).toEqual(
      ["journal", "sms_marketing", "treatment"].sort(),
    );

    const events = _readConsentEventsForTests().filter((e) => e.clientId === "cli_onb_test");
    expect(events.every((e) => e.channel === "web_onboarding")).toBe(true);
    expect(events.every((e) => e.consentVersion === "bypilar-onboarding-v1")).toBe(true);

    expect(hasActiveConsent({ tenantId: "bypilar", clientId: "cli_onb_test", purpose: "treatment" }).ok).toBe(true);
    expect(hasActiveConsent({ tenantId: "bypilar", clientId: "cli_onb_test", purpose: "journal" }).ok).toBe(true);
    expect(hasActiveConsent({ tenantId: "bypilar", clientId: "cli_onb_test", purpose: "sms_marketing" }).ok).toBe(true);
    expect(hasActiveConsent({ tenantId: "bypilar", clientId: "cli_onb_test", purpose: "research" }).ok).toBe(false);
  });

  it("rejects missing required treatment/journal → 400", async () => {
    const res = await postConsent("bypilar", {
      consents: { treatment: true, marketing: true },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("required_consents_missing");
  });

  it("rejects empty consents → 400", async () => {
    const res = await postConsent("bypilar", { consents: {} });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_consents");
  });

  it("unknown tenant → 404", async () => {
    const res = await postConsent("nope", {
      consents: { treatment: true, journal: true },
    });
    expect(res.status).toBe(404);
  });

  it("emits audit consent.onboarding_batch + consent.recorded", async () => {
    await postConsent("bypilar", {
      clientId: "cli_audit",
      consents: { treatment: true, journal: true },
    });
    const sink = _readMemorySink();
    expect(sink.some((e) => e.event === "consent.recorded")).toBe(true);
    expect(sink.some((e) => e.event === "consent.onboarding_batch")).toBe(true);
  });

  it("rate-limits abusive POSTs → 429", async () => {
    let last = 0;
    for (let i = 0; i < 32; i++) {
      const res = await postConsent("bypilar", {
        clientId: `cli_rl_${i}`,
        consents: { treatment: true, journal: true },
      });
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("generates clientId when omitted", async () => {
    const res = await postConsent("bypilar", {
      consents: { treatment: true, journal: true },
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.clientId).toMatch(/^cli_/);
  });
});

describe("F17 · onboarding page wires consent POST", () => {
  it("page.tsx calls /api/v1/{tenant}/consent on accept", () => {
    const src = readFileSync(
      join(process.cwd(), "app/t/[tenant]/onboarding/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/\/api\/v1\/\$\{tenant\}\/consent/);
    expect(src).toMatch(/acceptConsentsAndContinue/);
    expect(src).toMatch(/consentVersion:\s*`\$\{tenant\}-onboarding-v1`/);
    expect(src).toMatch(/onboardingClientId/);
  });
});
