import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { GET as missionsGet, POST as missionsPost } from "@/app/api/agents/missions/route";
import { GET as missionByIdGet } from "@/app/api/agents/missions/[missionId]/route";
import { resetMissionStoreForTests, listMissions } from "@/lib/prime";

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

function ownerReq(url: string, init?: RequestInit): NextRequest {
  const headers = new Headers(init?.headers);
  headers.set(
    "cookie",
    cookieHeader({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
    }),
  );
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(url, { ...init, headers });
}

describe("/api/agents/missions* aliases → prime missions", () => {
  beforeEach(() => {
    resetMissionStoreForTests();
  });

  it("GET list returns invariants + empty data for owner session", async () => {
    const res = await missionsGet(
      ownerReq("http://localhost/api/agents/missions?tenant=bypilar"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.invariants.NO_AUTO_MERGE).toBe(true);
    expect(json.invariants.NO_AUTO_DEPLOY).toBe(true);
  });

  it("POST draft via alias creates mission (same store as prime path)", async () => {
    const res = await missionsPost(
      ownerReq("http://localhost/api/agents/missions", {
        method: "POST",
        body: JSON.stringify({
          action: "draft",
          title: "Alias draft",
          goal: "Prove /api/agents/missions delegates",
          tenant: "bypilar",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.mission?.id).toBeTruthy();
    expect(json.mission.status).toBe("draft");
    expect(listMissions({ tenantSlug: "bypilar" }).some((m) => m.id === json.mission.id)).toBe(
      true,
    );
  });

  it("GET /api/agents/missions/[missionId] returns mission view", async () => {
    const created = await missionsPost(
      ownerReq("http://localhost/api/agents/missions", {
        method: "POST",
        body: JSON.stringify({
          action: "draft",
          title: "By id",
          goal: "Alias by id",
        }),
      }),
    );
    const { mission } = await created.json();

    const res = await missionByIdGet(
      ownerReq(`http://localhost/api/agents/missions/${mission.id}?tenant=bypilar`),
      { params: Promise.resolve({ missionId: mission.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mission.id).toBe(mission.id);
    expect(json.budget).toBeTruthy();
  });

  it("POST without session → 401 (same auth as prime)", async () => {
    const res = await missionsPost(
      new NextRequest("http://localhost/api/agents/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          title: "no auth",
          goal: "should fail",
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("seed_fixture secure-journal-route-authorization stays draft-only", async () => {
    const res = await missionsPost(
      ownerReq("http://localhost/api/agents/missions", {
        method: "POST",
        body: JSON.stringify({
          action: "seed_fixture",
          fixtureId: "secure-journal-route-authorization",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.mission.status).toBe("draft");
    expect(json.mission.riskLevel).toBe("yellow");
    expect(json.mission.fixtureId).toBe("secure-journal-route-authorization");
    expect(String(json.note ?? "")).toMatch(/Draft only/i);
  });
});
