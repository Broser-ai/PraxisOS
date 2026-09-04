// F35 · journal mutation audit request context
// F36 · bird/status strips keyHint
// F37 · login captcha-before-backoff parity with signup
// F38 · CODE-MAP refresh for F23–F37

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { recordAttempt, requiresCaptcha } from "@/lib/rate-limit";
import { listJournal } from "@/lib/journal";
import { POST as journalListPost } from "@/app/api/journal/route";
import { PATCH as journalPatch } from "@/app/api/journal/[id]/route";
import { GET as birdStatusGet } from "@/app/api/bird/status/route";
import { POST as loginPost } from "@/app/api/auth/login/route";

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
  headers.set("x-forwarded-for", "203.0.113.40");
  headers.set("user-agent", "vitest-f35/1");
  headers.set("x-request-id", "req_f35");
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, { ...init, headers });
}

const practitioner = {
  accountId: "acc_sofie",
  tenant: "bypilar",
  role: "practitioner" as Role,
};

describe("F35 · journal mutation audit context", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("POST journal.created carries ip/route/auth_mode", async () => {
    const res = await journalListPost(
      sessionReq("http://localhost/api/journal", practitioner, {
        method: "POST",
        body: JSON.stringify({
          clientId: "per",
          tenant: "bypilar",
          service: "F35 note",
          soap: { S: "test", O: "", A: "", P: "" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((e) => e.event === "journal.created");
    expect(rec).toBeTruthy();
    expect(rec?.ip).toBe("203.0.113.40");
    expect(rec?.route).toBe("/api/journal");
    expect(rec?.auth_mode).toBe("session");
  });

  it("PATCH journal.updated carries request context", async () => {
    const draft =
      listJournal({ tenant: "bypilar", status: "draft", limit: 1 })[0] ??
      listJournal({ tenant: "bypilar", limit: 1 })[0];
    expect(draft).toBeTruthy();
    const res = await journalPatch(
      sessionReq(`http://localhost/api/journal/${draft!.id}`, practitioner, {
        method: "PATCH",
        body: JSON.stringify({ soap: { S: "updated-f35" } }),
      }),
      { params: Promise.resolve({ id: draft!.id }) },
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((e) => e.event === "journal.updated");
    expect(rec).toBeTruthy();
    expect(decodeURIComponent(rec?.route ?? "")).toBe(`/api/journal/${draft!.id}`);
    expect(rec?.auth_mode).toBe("session");
    expect(rec?.ip).toBe("203.0.113.40");
  });
});

describe("F36 · bird/status strips keyHint", () => {
  it("GET has no keyHint field", async () => {
    const res = await birdStatusGet(
      new Request("http://localhost/api/bird/status"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keyHint).toBeUndefined();
    expect(body.provider).toBe("bird");
    expect(typeof body.configured).toBe("boolean");
  });
});

describe("F37 · login captcha-before-backoff", () => {
  it("after ≥3 failures without captcha → captcha_required (not rate_limited)", async () => {
    const ip = "203.0.113.41";
    const email = "f37-captcha@example.com";
    recordAttempt(ip, email, false);
    recordAttempt(ip, email, false);
    recordAttempt(ip, email, false);
    expect(requiresCaptcha(ip, email)).toBe(true);

    const res = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({ email, password: "wrong" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("captcha_required");
  });
});

describe("F38 · CODE-MAP refresh", () => {
  it("documents F23–F37 continue-dev markers", () => {
    const map = readFileSync(join(process.cwd(), "CODE-MAP.md"), "utf8");
    expect(map).toMatch(/F23/);
    expect(map).toMatch(/F24/);
    expect(map).toMatch(/F25/);
    expect(map).toMatch(/F26/);
    expect(map).toMatch(/F30/);
    expect(map).toMatch(/F33|hint|redact/i);
  });
});
