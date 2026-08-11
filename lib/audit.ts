// PraxisOS audit trail · clinical / biomechanical findings
import { publishEvent } from "@/lib/event-bus";

export async function auditLog(
  type: string,
  tenantId: string,
  patientId: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  publishEvent({
    type: `audit.${type}`,
    tenant: tenantId,
    data: { patientId, ...data },
    source: "audit",
  });
}
