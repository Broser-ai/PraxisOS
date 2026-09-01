// PraxisOS Nexus runtime · lives inside the app + agent-worker tick (no separate process)
import { ariaOrchestrator } from "@/agents/ARIA-orchestrator";
import { listSpecialists } from "@/agents/registry";
import { lunaHarvest } from "@/agents/specialists/LUNA-harvester";
import { memoryDigest, memoryFingerprint } from "@/agents/memory/swarm-memory";
import { publishEvent } from "@/lib/event-bus";

const g = globalThis as typeof globalThis & {
  __praxisNexusBooted?: boolean;
  __praxisNexusLastHarvestAt?: number;
};

export type NexusStatus = {
  booted: boolean;
  specialists: string[];
  memoryFingerprint: string;
  memoryPreview: string;
  lastHarvestAt: string | null;
};

export async function ensureNexusBooted(tenant = "bypilar"): Promise<NexusStatus> {
  if (!g.__praxisNexusBooted) {
    await ariaOrchestrator.boot();
    g.__praxisNexusBooted = true;
    publishEvent({
      type: "nexus.booted",
      tenant,
      data: { specialists: listSpecialists().map((s) => s.id) },
      source: "nexus-runtime",
    });
  }
  return getNexusStatus(tenant);
}

export function getNexusStatus(tenant = "bypilar"): NexusStatus {
  return {
    booted: Boolean(g.__praxisNexusBooted),
    specialists: listSpecialists().map((s) => s.id),
    memoryFingerprint: memoryFingerprint(),
    memoryPreview: memoryDigest(tenant),
    lastHarvestAt: g.__praxisNexusLastHarvestAt
      ? new Date(g.__praxisNexusLastHarvestAt).toISOString()
      : null,
  };
}

/** Called from /api/agents/tick — keeps Nexus alive inside PraxisOS */
export async function nexusOnAgentTick(opts?: {
  tenant?: string;
  forceHarvest?: boolean;
}): Promise<{ boot: NexusStatus; harvest?: { stored: number } | null }> {
  const tenant = opts?.tenant ?? "bypilar";
  const boot = await ensureNexusBooted(tenant);

  const harvestEveryMs = Number(process.env.LUNA_HARVEST_MS || String(6 * 3600_000));
  const due =
    opts?.forceHarvest ||
    !g.__praxisNexusLastHarvestAt ||
    Date.now() - g.__praxisNexusLastHarvestAt >= harvestEveryMs;

  if (!due) return { boot, harvest: null };

  try {
    const harvested = await lunaHarvest({ tenant, maxResults: 5 });
    g.__praxisNexusLastHarvestAt = Date.now();
    publishEvent({
      type: "nexus.luna.harvested",
      tenant,
      data: { stored: harvested.stored },
      source: "nexus-runtime",
    });
    return { boot: getNexusStatus(tenant), harvest: { stored: harvested.stored } };
  } catch (err) {
    publishEvent({
      type: "nexus.luna.failed",
      tenant,
      data: { error: err instanceof Error ? err.message : "harvest_failed" },
      source: "nexus-runtime",
    });
    return { boot, harvest: null };
  }
}
