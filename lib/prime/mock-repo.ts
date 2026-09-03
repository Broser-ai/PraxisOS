// In-memory mock repo for Prime Execution Control tests (no Supabase required).

import type {
  Mission,
  MissionAgentRun,
  Workstream,
  WorkstreamEvidence,
} from "@/lib/prime/mission-types";

export type PrimeMockRepo = {
  missions: Mission[];
  workstreams: Workstream[];
  evidence: WorkstreamEvidence[];
  runs: MissionAgentRun[];
};

export function createPrimeMockRepo(seed?: Partial<PrimeMockRepo>): PrimeMockRepo {
  return {
    missions: [...(seed?.missions ?? [])],
    workstreams: [...(seed?.workstreams ?? [])],
    evidence: [...(seed?.evidence ?? [])],
    runs: [...(seed?.runs ?? [])],
  };
}

export function mockRepoSnapshot(repo: PrimeMockRepo) {
  return {
    missionCount: repo.missions.length,
    workstreamCount: repo.workstreams.length,
    byStatus: repo.workstreams.reduce<Record<string, number>>((acc, w) => {
      acc[w.status] = (acc[w.status] ?? 0) + 1;
      return acc;
    }, {}),
    leased: repo.workstreams.filter((w) => Boolean(w.leaseId)).length,
  };
}
