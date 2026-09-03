// Mission fixture definitions (no orchestrator imports — safe for startMission).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PlatformScope, RiskLevel } from "@/lib/prime/mission-types";

export type MissionFixture = {
  id: string;
  title: string;
  goal: string;
  riskLevel: RiskLevel;
  platformScope: PlatformScope[];
  tenantSlug?: string;
  acceptanceCriteria: { text: string }[];
  allowedPaths: string[];
  forbiddenPaths?: string[];
  workstreams?: Array<{
    role: "scout" | "builder" | "verifier" | "reviewer";
    title?: string;
  }>;
};

const YELLOW_JOURNAL_AUTH: MissionFixture = {
  id: "secure-journal-route-authorization",
  title: "Secure journal route authorization",
  goal:
    "Harden journal API/route authorization so tenant isolation and practitioner auth are enforced before any read/write. Suggestion-only clinical posture; no auto journal sign; no patient SMS autonomy.",
  riskLevel: "yellow",
  platformScope: ["auth_journal", "clinic_ops", "prime"],
  acceptanceCriteria: [
    { text: "Unauthenticated journal route requests return 401" },
    { text: "Cross-tenant journal access returns 403/404 (no leakage)" },
    { text: "Signed notes remain immutable (NO_AUTO_JOURNAL_SIGN)" },
    { text: "Vitest covers auth negative cases; typecheck green" },
  ],
  allowedPaths: [
    "app/api/journal/",
    "app/api/auth/me/",
    "lib/request-auth.ts",
    "lib/auth.ts",
    "lib/session-token.ts",
    "lib/staff-session.ts",
    "tests/",
  ],
  forbiddenPaths: [
    ".env",
    ".env.production",
    "secrets/",
    "clinical-policy",
    "docker-compose.praxis.yml",
    "supabase/migrations/",
    "app/api/bird/",
  ],
  workstreams: [
    { role: "scout", title: "Scout · journal auth surface" },
    { role: "builder", title: "Builder · route guards" },
    { role: "verifier", title: "Verifier · auth tests" },
    { role: "reviewer", title: "Reviewer · clinical/auth policy" },
  ],
};

export function getYellowJournalAuthFixture(): MissionFixture {
  return structuredClone(YELLOW_JOURNAL_AUTH);
}

export function loadMissionFixture(fixtureId: string): MissionFixture {
  const base = join(process.cwd(), "fixtures", "missions");
  for (const name of [`${fixtureId}.json`, `${fixtureId}.yaml`, `${fixtureId}.yml`]) {
    const path = join(base, name);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    if (name.endsWith(".json") || raw.trim().startsWith("{")) {
      return JSON.parse(raw) as MissionFixture;
    }
    return parseSimpleMissionYaml(raw, fixtureId);
  }
  if (fixtureId === YELLOW_JOURNAL_AUTH.id) return getYellowJournalAuthFixture();
  throw new Error(`fixture_not_found:${fixtureId}`);
}

function parseSimpleMissionYaml(raw: string, fallbackId: string): MissionFixture {
  const fixture = getYellowJournalAuthFixture();
  fixture.id = fallbackId;
  const title = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (title) fixture.title = title[1]!.trim();
  return fixture;
}
