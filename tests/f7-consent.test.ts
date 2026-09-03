// F7 · consent lib + migration 0006(now 0007) + gates on scan/SMS/AI-draft.
// photo_capture + ai_processing gate scan/process BEFORE inference; ai_processing
// gates journal draft; sms_transactional/sms_marketing gate bird/send.

import { describe, expect, it, beforeEach } from "vitest";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import {
  assertConsent,
  hasActiveConsent,
  recordConsentEvent,
  _resetConsentEventsForTests,
  _readConsentEventsForTests,
} from "@/lib/consent";
import { POST as scanProcessPost } from "@/app/api/v1/scan/process/route";
import { POST as journalDraftPost } from "@/app/api/journal/[id]/draft/route";
import { POST as birdSend } from "@/app/api/bird/send/route";
import { listJournal } from "@/lib/journal";

function cookieHeader(session: {
  accountId: string;
  tenant: string;
  role: Role;
}): string {
  const token = encodeSession({
    ...session,
    loggedInAt: new Date().toISOString(),
  });
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

function sessionReq(
  url: string,
  session: { accountId: string; tenant: string; role: Role },
  init?: RequestInit,
): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", cookieHeader(session));
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, { ...init, headers });
}

const practitioner = { accountId: "acc_sofie", tenant: "bypilar", role: "practitioner" as Role };
const owner = { accountId: "acc_pilar", tenant: "bypilar", role: "owner" as Role };

describe("F7 · consent lib (recordConsentEvent / hasActiveConsent)", () => {
  beforeEach(() => {
    _resetConsentEventsForTests();
    _clearMemorySink();
  });

  it("grants consent via event → hasActiveConsent ok (event source)", () => {
    recordConsentEvent({
      tenantId: "bypilar",
      clientId: "per",
      eventType: "granted",
      purpose: "sms_marketing",
      channel: "clinic_desk",
      actorUserId: "acc_pilar",
    });
    const r = hasActiveConsent({ tenantId: "bypilar", clientId: "per", purpose: "sms_marketing" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("event");
  });

  it("revoked consent → not active", () => {
    recordConsentEvent({
      tenantId: "bypilar",
      clientId: "per",
      eventType: "granted",
      purpose: "sms_marketing",
    });
    recordConsentEvent({
      tenantId: "bypilar",
      clientId: "per",
      eventType: "revoked",
      purpose: "sms_marketing",
    });
    const r = hasActiveConsent({ tenantId: "bypilar", clientId: "per", purpose: "sms_marketing" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.body.error).toBe("consent_required");
  });

  it("opt_out blocks even after a later grant? no — latest grant wins", () => {
    recordConsentEvent({ tenantId: "bypilar", clientId: "per", eventType: "opt_out", purpose: "research" });
    recordConsentEvent({ tenantId: "bypilar", clientId: "per", eventType: "granted", purpose: "research" });
    const r = hasActiveConsent({ tenantId: "bypilar", clientId: "per", purpose: "research" });
    expect(r.ok).toBe(true);
  });

  it("legacy fallback: Sundhedsdata client has photo_capture (legacy source)", () => {
    // per = Sundhedsdata; no events → legacy mapping
    const r = hasActiveConsent({ tenantId: "bypilar", clientId: "per", purpose: "photo_capture" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("legacy");
  });

  it("legacy fallback: Almindelig client lacks photo_capture → blocked", () => {
    // clara = Almindelig
    const r = hasActiveConsent({ tenantId: "bypilar", clientId: "clara", purpose: "photo_capture" });
    expect(r.ok).toBe(false);
  });

  it("unknown client → blocked (no legacy, no events)", () => {
    const r = hasActiveConsent({ tenantId: "bypilar", clientId: "ghost", purpose: "treatment" });
    expect(r.ok).toBe(false);
  });

  it("recordConsentEvent emits audit consent.recorded", () => {
    _clearMemorySink();
    recordConsentEvent({
      tenantId: "bypilar",
      clientId: "per",
      eventType: "granted",
      purpose: "ai_processing",
      actorUserId: "acc_pilar",
    });
    const sink = _readMemorySink();
    expect(sink.some((e) => e.event === "consent.recorded")).toBe(true);
  });

  it("assertConsent returns route-usable fail shape", () => {
    const r = assertConsent({ tenantId: "bypilar", clientId: "clara", purpose: "photo_capture" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.body.error).toBe("consent_required");
      expect(r.body.purpose).toBe("photo_capture");
    }
  });
});

describe("F7 · scan/process consent gate (photo_capture + ai_processing)", () => {
  beforeEach(() => {
    _resetConsentEventsForTests();
    _clearMemorySink();
  });

  it("blocks scan for client without photo_capture consent → 403 before inference", async () => {
    // clara = Almindelig → no photo_capture legacy
    const res = await scanProcessPost(
      sessionReq("http://localhost/api/v1/scan/process", practitioner, {
        method: "POST",
        body: JSON.stringify({
          imageUrl: "https://example.com/x.jpg",
          patientId: "clara",
        }),
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("consent_required");
    expect(json.purpose).toBe("photo_capture");
  });

  it("blocks scan for unknown patient (no consent) → 403", async () => {
    const res = await scanProcessPost(
      sessionReq("http://localhost/api/v1/scan/process", practitioner, {
        method: "POST",
        body: JSON.stringify({
          imageUrl: "https://example.com/x.jpg",
          patientId: "ghost_patient",
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("revoking ai_processing blocks a Sundhedsdata client scan → 403", async () => {
    // per = Sundhedsdata (legacy has ai_processing) — revoke it
    recordConsentEvent({
      tenantId: "bypilar",
      clientId: "per",
      eventType: "revoked",
      purpose: "ai_processing",
    });
    const res = await scanProcessPost(
      sessionReq("http://localhost/api/v1/scan/process", practitioner, {
        method: "POST",
        body: JSON.stringify({
          imageUrl: "https://example.com/x.jpg",
          patientId: "per",
        }),
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.purpose).toBe("ai_processing");
  });
});

describe("F7 · journal draft consent gate (ai_processing)", () => {
  beforeEach(() => {
    _resetConsentEventsForTests();
    _clearMemorySink();
  });

  it("blocks AI draft when ai_processing revoked → 403 before LLM", async () => {
    const entry = listJournal({ tenant: "bypilar", status: "draft", limit: 1 })[0]
      ?? listJournal({ tenant: "bypilar", limit: 1 })[0];
    expect(entry).toBeTruthy();
    recordConsentEvent({
      tenantId: "bypilar",
      clientId: entry!.clientId,
      eventType: "revoked",
      purpose: "ai_processing",
    });
    const res = await journalDraftPost(
      sessionReq(`http://localhost/api/journal/${entry!.id}/draft`, practitioner, {
        method: "POST",
        body: JSON.stringify({ transcript: "test" }),
      }),
      { params: Promise.resolve({ id: entry!.id }) },
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("consent_required");
    expect(json.purpose).toBe("ai_processing");
  });
});

describe("F7 · bird/send SMS consent gate", () => {
  beforeEach(() => {
    _resetConsentEventsForTests();
    _clearMemorySink();
    process.env.BIRD_API_KEY = "test-key-for-f7";
  });

  it("marketing without clientId → 400 client_id_required_for_marketing", async () => {
    const res = await birdSend(
      sessionReq("http://localhost/api/bird/send", owner, {
        method: "POST",
        body: JSON.stringify({ to: "+4512345678", text: "tilbud", category: "marketing" }),
      }) as any,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("client_id_required_for_marketing");
  });

  it("marketing for client without sms_marketing consent → 403", async () => {
    // per = Sundhedsdata legacy (no sms_marketing)
    const res = await birdSend(
      sessionReq("http://localhost/api/bird/send", owner, {
        method: "POST",
        body: JSON.stringify({
          to: "+4512345678",
          text: "tilbud",
          category: "marketing",
          clientId: "per",
        }),
      }) as any,
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.purpose).toBe("sms_marketing");
  });

  it("transactional for unknown client (no consent) → 403", async () => {
    const res = await birdSend(
      sessionReq("http://localhost/api/bird/send", owner, {
        method: "POST",
        body: JSON.stringify({
          to: "+4512345678",
          text: "påmindelse",
          category: "transactional",
          clientId: "ghost_client",
        }),
      }) as any,
    );
    expect(res.status).toBe(403);
  });

  it("marketing granted via event → proceeds past consent (then Bird send fails 4xx/5xx, not 403)", async () => {
    recordConsentEvent({
      tenantId: "bypilar",
      clientId: "per",
      eventType: "granted",
      purpose: "sms_marketing",
      actorUserId: "acc_pilar",
    });
    const res = await birdSend(
      sessionReq("http://localhost/api/bird/send", owner, {
        method: "POST",
        body: JSON.stringify({
          to: "+4512345678",
          text: "tilbud",
          category: "marketing",
          clientId: "per",
        }),
      }) as any,
    );
    // Consent passed → reaches sendBirdSms (fake key) → not 403 consent_required
    expect(res.status).not.toBe(403);
  });
});
