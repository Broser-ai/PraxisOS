// Mission domain repository — validated Mission / Workstream / AgentRun memory API.
// Extends mission-store; does not invent a parallel persistence layer.

import {
  createAgentRun as storeCreateAgentRun,
  createMission as storeCreateMission,
  createWorkstream as storeCreateWorkstream,
  getAgentRun as storeGetAgentRun,
  getMission,
  listAgentRuns as storeListAgentRuns,
  listMissions as storeListMissions,
  listWorkstreams as storeListWorkstreams,
  resetMissionStoreForTests,
  updateAgentRun as storeUpdateAgentRun,
  updateMissionStatus as storeUpdateMissionStatus,
  updateWorkstreamStatus as storeUpdateWorkstreamStatus,
} from "@/lib/prime/mission-store";
import type {
  AgentRole,
  AgentRun,
  AgentRunStatus,
  Mission,
  MissionBudgets,
  MissionStatus,
  PlatformScope,
  RiskLevel,
  Workstream,
  WorkstreamStatus,
} from "@/lib/prime/mission-types";
import {
  validateCreateAgentRunInput,
  validateCreateMissionInput,
  validateCreateWorkstreamInput,
  isAgentRole,
  isAgentRunStatus,
  isMissionStatus,
  isWorkstreamStatus,
} from "@/lib/prime/mission-validation";

export type DomainResult<T> = T | { error: string; field?: string };

export type CreateMissionInput = {
  tenantSlug: string;
  title: string;
  objective: string;
  createdBy: string;
  riskLevel: RiskLevel;
  budgets: Partial<MissionBudgets>;
  acceptanceCriteria: { text: string }[];
  platformScope?: PlatformScope[];
  fixtureId?: string;
};

export type CreateWorkstreamInput = {
  missionId: string;
  title: string;
  objective: string;
  assignedRole: AgentRole;
  allowedPaths?: string[];
  forbiddenPaths?: string[];
  acceptanceCriteria?: { text: string }[];
};

export type CreateAgentRunInput = {
  missionId: string;
  role: AgentRole;
  status: AgentRunStatus;
  workstreamId?: string;
  tokenUsage?: AgentRun["tokenUsage"];
  toolCallCount?: number;
  agentRunId?: string;
  startedAt?: string;
};

/**
 * Single repository interface for the mission execution domain foundation.
 * Memory implementation backs onto `mission-store` (same pattern as agent-store).
 */
export interface MissionDomainRepository {
  createMission(input: CreateMissionInput): DomainResult<Mission>;
  getMission(id: string): Mission | undefined;
  listMissions(opts?: {
    tenantSlug?: string;
    status?: MissionStatus;
    limit?: number;
  }): Mission[];
  updateMissionStatus(
    id: string,
    status: MissionStatus,
  ): DomainResult<Mission>;

  createWorkstream(input: CreateWorkstreamInput): DomainResult<Workstream>;
  listWorkstreams(opts?: {
    missionId?: string;
    tenantSlug?: string;
    status?: WorkstreamStatus;
    limit?: number;
  }): Workstream[];
  updateWorkstreamStatus(
    id: string,
    status: WorkstreamStatus,
  ): DomainResult<Workstream>;

  createAgentRun(input: CreateAgentRunInput): DomainResult<AgentRun>;
  getAgentRun(id: string): AgentRun | undefined;
  updateAgentRun(
    id: string,
    patch: Partial<AgentRun>,
  ): DomainResult<AgentRun>;
  listAgentRuns(opts?: {
    missionId?: string;
    workstreamId?: string;
    limit?: number;
  }): AgentRun[];

  /** Test helper — clears in-memory store. */
  resetForTests(): void;
}

export class MemoryMissionDomainRepository implements MissionDomainRepository {
  createMission(input: CreateMissionInput): DomainResult<Mission> {
    const check = validateCreateMissionInput({
      title: input.title,
      objective: input.objective,
      riskLevel: input.riskLevel,
      budgets: input.budgets,
      acceptanceCriteria: input.acceptanceCriteria,
    });
    if (!check.ok) return { error: check.error, field: check.field };

    return storeCreateMission({
      tenantSlug: input.tenantSlug,
      title: input.title,
      goal: input.objective,
      objective: input.objective,
      createdBy: input.createdBy,
      riskLevel: input.riskLevel,
      budgets: input.budgets,
      acceptanceCriteria: input.acceptanceCriteria,
      platformScope: input.platformScope,
      fixtureId: input.fixtureId,
    });
  }

  getMission(id: string): Mission | undefined {
    return getMission(id);
  }

  listMissions(opts?: {
    tenantSlug?: string;
    status?: MissionStatus;
    limit?: number;
  }): Mission[] {
    return storeListMissions(opts);
  }

  updateMissionStatus(
    id: string,
    status: MissionStatus,
  ): DomainResult<Mission> {
    if (!isMissionStatus(status)) {
      return { error: "status_invalid", field: "status" };
    }
    const updated = storeUpdateMissionStatus(id, status);
    if (!updated) return { error: "mission_not_found" };
    return updated;
  }

  createWorkstream(input: CreateWorkstreamInput): DomainResult<Workstream> {
    const check = validateCreateWorkstreamInput(input);
    if (!check.ok) return { error: check.error, field: check.field };

    const created = storeCreateWorkstream({
      missionId: input.missionId,
      title: input.title,
      objective: input.objective,
      role: input.assignedRole,
      assignedRole: input.assignedRole,
      allowedPaths: input.allowedPaths,
      forbiddenPaths: input.forbiddenPaths,
      acceptanceCriteria: input.acceptanceCriteria,
    });
    if ("error" in created) return { error: created.error };
    return created;
  }

  listWorkstreams(opts?: {
    missionId?: string;
    tenantSlug?: string;
    status?: WorkstreamStatus;
    limit?: number;
  }): Workstream[] {
    return storeListWorkstreams(opts);
  }

  updateWorkstreamStatus(
    id: string,
    status: WorkstreamStatus,
  ): DomainResult<Workstream> {
    if (!isWorkstreamStatus(status)) {
      return { error: "status_invalid", field: "status" };
    }
    const updated = storeUpdateWorkstreamStatus(id, status);
    if (!updated) return { error: "workstream_not_found" };
    return updated;
  }

  createAgentRun(input: CreateAgentRunInput): DomainResult<AgentRun> {
    const check = validateCreateAgentRunInput(input);
    if (!check.ok) return { error: check.error, field: check.field };

    if (!getMission(input.missionId)) {
      return { error: "mission_not_found", field: "missionId" };
    }

    return storeCreateAgentRun({
      missionId: input.missionId,
      workstreamId: input.workstreamId,
      role: input.role,
      status: input.status,
      tokenUsage: input.tokenUsage ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimated: true,
        reservedTokens: 0,
      },
      toolCallCount: input.toolCallCount ?? 0,
      agentRunId: input.agentRunId,
      startedAt: input.startedAt ?? new Date().toISOString(),
    });
  }

  getAgentRun(id: string): AgentRun | undefined {
    return storeGetAgentRun(id);
  }

  updateAgentRun(
    id: string,
    patch: Partial<AgentRun>,
  ): DomainResult<AgentRun> {
    if (patch.status !== undefined && !isAgentRunStatus(patch.status)) {
      return { error: "status_invalid", field: "status" };
    }
    if (patch.role !== undefined && !isAgentRole(patch.role)) {
      return { error: "role_invalid", field: "role" };
    }
    const updated = storeUpdateAgentRun(id, patch);
    if (!updated) return { error: "agent_run_not_found" };
    return updated;
  }

  listAgentRuns(opts?: {
    missionId?: string;
    workstreamId?: string;
    limit?: number;
  }): AgentRun[] {
    return storeListAgentRuns(opts);
  }

  resetForTests(): void {
    resetMissionStoreForTests();
  }
}

let singleton: MemoryMissionDomainRepository | null = null;

/** Shared memory repository instance (PEC domain foundation). */
export function getMissionDomainRepository(): MissionDomainRepository {
  if (!singleton) singleton = new MemoryMissionDomainRepository();
  return singleton;
}

export function createMemoryMissionDomainRepository(): MissionDomainRepository {
  return new MemoryMissionDomainRepository();
}
