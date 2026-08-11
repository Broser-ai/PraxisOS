// ARIA · Master Intelligence / meta-orchestrator for DelPilar Nexus swarm
// Extends PraxisOS agent runtime — does not replace clinic Aria persona.
import { publishEvent } from "@/lib/event-bus";
import { remember, recall, memoryDigest } from "@/agents/memory/swarm-memory";
import { reflect, listReflections } from "@/agents/journal/journal-engine";
import { ninaRenderBrief } from "@/agents/specialists/DR-NINA";
import { felixImplement, type FelixTask } from "@/agents/specialists/FELIX-self-coder";
import { lunaHarvest } from "@/agents/specialists/LUNA-harvester";
import { AlphaSpatiotemporalPipeline, type AlphaScanResult } from "@/lib/scanner/alpha-pipeline";
import { getSpecialist, listSpecialists } from "@/agents/registry";

export type AriaDirective =
  | { type: "scan"; imageUrl: string; imageBase64?: string; tenantId?: string; patientId?: string }
  | { type: "harvest"; query?: string; maxResults?: number }
  | { type: "code"; task: FelixTask }
  | { type: "render"; summary: string }
  | { type: "status" }
  | { type: "recall"; query: string };

export type AriaOrchestrationResult = {
  ok: boolean;
  directive: AriaDirective["type"];
  specialist?: string;
  summary: string;
  data?: unknown;
  error?: string;
};

const pipeline = new AlphaSpatiotemporalPipeline();

export class AriaOrchestrator {
  constructor(private tenant = "bypilar") {}

  async boot(): Promise<{ specialists: string[]; memory: string }> {
    const specialists = listSpecialists().map((s) => s.id);
    await remember({
      kind: "observation",
      tenant: this.tenant,
      text: `ARIA boot · specialists=${specialists.join(",")}`,
      meta: { agent: "aria-orchestrator" },
    });
    publishEvent({
      type: "swarm.aria.boot",
      tenant: this.tenant,
      data: { specialists },
      source: "aria-orchestrator",
    });
    return { specialists, memory: memoryDigest(this.tenant) };
  }

  async dispatch(directive: AriaDirective): Promise<AriaOrchestrationResult> {
    try {
      switch (directive.type) {
        case "status": {
          const reflections = listReflections({ tenant: this.tenant, limit: 5 });
          const known = listSpecialists();
          return {
            ok: true,
            directive: "status",
            summary: `ARIA online · ${known.length} specialists · ${reflections.length} recent reflections`,
            data: {
              specialists: known,
              memory: memoryDigest(this.tenant),
              reflections,
              recall: recall("clinical scan biomechanics", { tenant: this.tenant, limit: 5 }),
            },
          };
        }
        case "recall": {
          const hits = recall(directive.query, { tenant: this.tenant, limit: 8 });
          return {
            ok: true,
            directive: "recall",
            summary: `${hits.length} memory hits`,
            data: hits,
          };
        }
        case "harvest": {
          getSpecialist("luna");
          const harvested = await lunaHarvest({
            query: directive.query,
            maxResults: directive.maxResults,
            tenant: this.tenant,
          });
          publishEvent({
            type: "swarm.luna.harvested",
            tenant: this.tenant,
            data: { count: harvested.stored },
            source: "aria-orchestrator",
          });
          return {
            ok: true,
            directive: "harvest",
            specialist: "luna",
            summary: `LUNA indexed ${harvested.stored} papers`,
            data: harvested,
          };
        }
        case "code": {
          getSpecialist("felix");
          const coded = await felixImplement(directive.task, this.tenant);
          publishEvent({
            type: "swarm.felix.coded",
            tenant: this.tenant,
            data: { ok: coded.ok, branch: coded.worktree?.branch, error: coded.error },
            source: "aria-orchestrator",
          });
          return {
            ok: coded.ok,
            directive: "code",
            specialist: "felix",
            summary: coded.ok
              ? `FELIX committed on ${coded.worktree?.branch}`
              : `FELIX failed: ${coded.error}`,
            data: coded,
            error: coded.error,
          };
        }
        case "render": {
          getSpecialist("nina");
          const brief = await ninaRenderBrief(directive.summary, this.tenant);
          return {
            ok: true,
            directive: "render",
            specialist: "nina",
            summary: "NINA shader profile klar",
            data: brief,
          };
        }
        case "scan": {
          const result = await this.runClinicalScan(directive);
          return {
            ok: true,
            directive: "scan",
            specialist: "s-agent",
            summary: result.biomechanics.isCritical
              ? "Scan kritisk — høj biomekanisk belastning"
              : "Scan gennemført",
            data: result,
          };
        }
        default: {
          const _exhaustive: never = directive;
          return {
            ok: false,
            directive: "status",
            summary: "Ukendt direktiv",
            error: String(_exhaustive),
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "aria_dispatch_failed";
      await reflect({
        agentId: "aria-orchestrator",
        tenant: this.tenant,
        prompt: JSON.stringify(directive).slice(0, 200),
        outcome: message,
        score: 0.15,
      });
      return {
        ok: false,
        directive: directive.type,
        summary: message,
        error: message,
      };
    }
  }

  async runClinicalScan(input: {
    imageUrl: string;
    imageBase64?: string;
    tenantId?: string;
    patientId?: string;
  }): Promise<AlphaScanResult> {
    const tenantId = input.tenantId ?? this.tenant;
    const patientId = input.patientId ?? "unknown";
    publishEvent({
      type: "swarm.scan.started",
      tenant: tenantId,
      data: { patientId, imageUrl: input.imageUrl },
      source: "aria-orchestrator",
    });

    const result = await pipeline.executeAlphaScan(
      input.imageUrl,
      input.imageBase64 ?? "",
      tenantId,
      patientId,
    );

    await ninaRenderBrief(
      `scan ${patientId} strain=${result.biomechanics.archStrainMPa} findings=${result.medicalFindings.length}`,
      tenantId,
    );

    await remember({
      kind: "scan",
      tenant: tenantId,
      text: `Alpha scan ${patientId}: strain ${result.biomechanics.archStrainMPa} MPa, torsion ${result.biomechanics.jointTorsionNm} Nm, findings ${result.medicalFindings.length}`,
      meta: {
        patientId,
        critical: result.biomechanics.isCritical,
        meshUrl: result.meshUrl,
      },
    });

    publishEvent({
      type: "swarm.scan.completed",
      tenant: tenantId,
      data: {
        patientId,
        critical: result.biomechanics.isCritical,
        archStrainMPa: result.biomechanics.archStrainMPa,
        findings: result.medicalFindings.length,
      },
      source: "aria-orchestrator",
    });

    await reflect({
      agentId: "aria-orchestrator",
      tenant: tenantId,
      prompt: `clinical scan ${patientId}`,
      outcome: result.biomechanics.isCritical ? "critical biomechanics" : "scan ok",
      score: result.biomechanics.isCritical ? 0.9 : 0.75,
    });

    return result;
  }
}

export const ariaOrchestrator = new AriaOrchestrator();

/** CLI / swarm.sh entry */
export async function main() {
  const boot = await ariaOrchestrator.boot();
  console.log("ARIA orchestrator online", boot);
  const status = await ariaOrchestrator.dispatch({ type: "status" });
  console.log(JSON.stringify(status, null, 2));
}

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /ARIA-orchestrator\.(ts|js|mjs)$/.test(process.argv[1]);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
