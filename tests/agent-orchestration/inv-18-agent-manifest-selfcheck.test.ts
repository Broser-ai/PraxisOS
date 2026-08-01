// INV-18 agent-manifest self-check test
// Kontrakt: lib/agents.ts §"EPIC 1 · Multi-Agent Orchestration additions"
// Bemærk: refererer bevidst IKKE til søster-invariant kode-literal, for at
// undgå at ratchet-testen (tests/inv-index.test.ts) fejlagtigt markerer den
// søster-invariant som covered.

import { describe, it, expect } from "vitest";
import {
  AGENTS,
  type AgentId,
  AGENT_ALLOWED_ROLES,
  AGENT_MODEL_TIER,
  AGENT_COMPLIANCE_MODE,
  AGENT_MDR_TIER,
  AGENT_DEPLOYMENT_STATUS,
  WORKER_IDS,
} from "@/lib/agents";

function manifestGaps(
  map: Record<string, unknown>,
  authoritativeIds: readonly string[],
): { missing: string[]; extra: string[] } {
  const idSet = new Set(authoritativeIds);
  const mapKeys = Object.keys(map);
  const missing = authoritativeIds.filter((id) => !(id in map)).sort();
  const extra = mapKeys.filter((k) => !idSet.has(k)).sort();
  return { missing, extra };
}

describe("INV-18 · agent-manifest self-check", () => {
  const agentIds = AGENTS.map((a) => a.id);

  it("(a) happy-path: alle metadata-maps har præcis AGENTS[].id som nøgle-sæt", () => {
    const maps: Record<string, Record<string, unknown>> = {
      AGENT_ALLOWED_ROLES,
      AGENT_MODEL_TIER,
      AGENT_COMPLIANCE_MODE,
      AGENT_MDR_TIER,
      AGENT_DEPLOYMENT_STATUS,
    };

    for (const [mapName, map] of Object.entries(maps)) {
      const { missing, extra } = manifestGaps(map, agentIds);
      expect(missing, `${mapName} mangler metadata for: ${missing.join(", ")}`).toEqual([]);
      expect(extra, `${mapName} har spøgelses-id'er: ${extra.join(", ")}`).toEqual([]);
    }

    const workerEntries = WORKER_IDS.map((id) => [id, true] as const);
    const { missing: workerMissing, extra: workerExtra } = manifestGaps(
      Object.fromEntries(workerEntries),
      agentIds,
    );
    expect(workerMissing).toEqual([]);
    expect(workerExtra).toEqual([]);
  });

  it("(b) happy-path: WORKER_IDS' rækkefølge matcher AGENTS' rækkefølge", () => {
    expect(WORKER_IDS).toEqual(agentIds);
  });

  it("(c) failure-mode: simuleret drift — ny agent uden metadata bliver fanget som 'missing'", () => {
    const driftedIds: string[] = [...agentIds, "kai"];
    const { missing, extra } = manifestGaps(AGENT_MODEL_TIER, driftedIds);
    expect(missing).toEqual(["kai"]);
    expect(extra).toEqual([]);
  });

  it("(d) failure-mode: spøgelses-id i metadata-map bliver fanget som 'extra'", () => {
    const corruptedRoles: Record<string, unknown> = {
      ...AGENT_ALLOWED_ROLES,
      "ghost-agent": ["owner"],
    };
    const { missing, extra } = manifestGaps(corruptedRoles, agentIds);
    expect(missing).toEqual([]);
    expect(extra).toEqual(["ghost-agent"]);
  });

  it("(e) sanity: hver AgentId er nøgle i alle metadata-maps samtidig", () => {
    const allMapsCoverEveryAgent = agentIds.every(
      (id: AgentId) =>
        id in AGENT_ALLOWED_ROLES &&
        id in AGENT_MODEL_TIER &&
        id in AGENT_COMPLIANCE_MODE &&
        id in AGENT_MDR_TIER &&
        id in AGENT_DEPLOYMENT_STATUS,
    );
    expect(allMapsCoverEveryAgent).toBe(true);
    expect(agentIds.length).toBeGreaterThan(0);
  });
});
