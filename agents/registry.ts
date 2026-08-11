// PraxisOS swarm specialist registry · NINA, FELIX, LUNA (+ S-Agent)
import { NINA_ID } from "@/agents/specialists/DR-NINA";
import { FELIX_ID } from "@/agents/specialists/FELIX-self-coder";
import { LUNA_ID } from "@/agents/specialists/LUNA-harvester";

export type SpecialistId = typeof NINA_ID | typeof FELIX_ID | typeof LUNA_ID | "s-agent";

export type SpecialistRecord = {
  id: SpecialistId;
  name: string;
  role: string;
  module: string;
  status: "online" | "degraded" | "offline";
};

const REGISTRY: SpecialistRecord[] = [
  {
    id: NINA_ID,
    name: "Dr. Nina",
    role: "Neural rendering · WebGPU SSS",
    module: "agents/specialists/DR-NINA.ts",
    status: "online",
  },
  {
    id: FELIX_ID,
    name: "Felix",
    role: "Self-coder · Git worktrees",
    module: "agents/specialists/FELIX-self-coder.ts",
    status: "online",
  },
  {
    id: LUNA_ID,
    name: "Luna",
    role: "arXiv harvester 24/7",
    module: "agents/specialists/LUNA-harvester.ts",
    status: "online",
  },
  {
    id: "s-agent",
    name: "S-Agent",
    role: "Alpha spatiotemporal clinical scan",
    module: "lib/scanner/alpha-pipeline.ts",
    status: "online",
  },
];

export function listSpecialists(): SpecialistRecord[] {
  return REGISTRY.map((r) => ({ ...r }));
}

export function getSpecialist(id: SpecialistId): SpecialistRecord {
  const found = REGISTRY.find((r) => r.id === id);
  if (!found) throw new Error(`specialist_not_registered:${id}`);
  return { ...found };
}

export function registerSpecialist(record: SpecialistRecord): void {
  const idx = REGISTRY.findIndex((r) => r.id === record.id);
  if (idx >= 0) REGISTRY[idx] = record;
  else REGISTRY.push(record);
}
