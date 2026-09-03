// Seed helpers — draft only; never auto-approve or run builders against production.

import { draftMission } from "@/lib/prime/orchestrator";
import { listMissions } from "@/lib/prime/mission-store";
import {
  getYellowJournalAuthFixture,
  loadMissionFixture,
  type MissionFixture,
} from "@/lib/prime/fixtures";
import type { Mission } from "@/lib/prime/mission-types";

export type { MissionFixture };
export { getYellowJournalAuthFixture, loadMissionFixture };

/**
 * Seed mission as **draft** only. Does not approve/start — Michael must approve via API/UI.
 * Idempotent by fixtureId for the tenant.
 */
export function seedMissionFixture(input: {
  fixtureId: string;
  tenantSlug?: string;
  createdBy?: string;
}): Mission | { error: string; mission?: Mission } {
  const tenant = input.tenantSlug ?? "bypilar";
  const existing = listMissions({ tenantSlug: tenant, limit: 100 }).find(
    (m) => m.fixtureId === input.fixtureId,
  );
  if (existing) {
    return { error: "already_seeded", mission: existing };
  }

  const fx = loadMissionFixture(input.fixtureId);
  return draftMission({
    tenantSlug: tenant,
    title: fx.title,
    goal: fx.goal,
    createdBy: input.createdBy ?? "system_seed",
    riskLevel: fx.riskLevel,
    platformScope: fx.platformScope,
    fixtureId: fx.id,
  });
}
