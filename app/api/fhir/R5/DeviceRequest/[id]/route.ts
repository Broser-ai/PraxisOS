// GET /fhir/R5/DeviceRequest/[id] · returns FHIR R5 DeviceRequest for orthotic config

import { NextRequest, NextResponse } from "next/server";
import { createDefaultRepository } from "@/lib/fhir/repository";
import { mapOrthoticConfigToDeviceRequest } from "@/lib/fhir/resource-mappers";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return fhirError(400, "invalid", "id is required");

  const tenantId = req.headers.get("x-tenant-id") ?? "bypilar";
  const repo = createDefaultRepository();
  const config = await repo.getOrthoticConfig(id, tenantId);
  if (!config) {
    return fhirError(404, "not-found", `DeviceRequest/${id} not found for tenant ${tenantId}`);
  }

  // FHIR status mapping: draft/reviewed → draft · locked → active · sent_to_lab/delivered → completed
  const statusMap: Record<
    typeof config.status,
    "draft" | "active" | "completed"
  > = {
    draft: "draft",
    reviewed: "draft",
    locked: "active",
    sent_to_lab: "active",
    delivered: "completed",
  };

  const request = mapOrthoticConfigToDeviceRequest({
    configurationId: config.id,
    patientId: config.client_id,
    encounterId: config.encounter_id,
    practitionerId: config.practitioner_id,
    orthoticParams: config.orthotic_params,
    linkedDiagnosticReportId: config.scan_id,
    status: statusMap[config.status],
  });

  return new NextResponse(JSON.stringify(request), {
    status: 200,
    headers: {
      "content-type": "application/fhir+json",
      "cache-control": "private, no-store",
    },
  });
}

function fhirError(status: number, code: string, diagnostics: string): NextResponse {
  return new NextResponse(
    JSON.stringify({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code, diagnostics }],
    }),
    { status, headers: { "content-type": "application/fhir+json" } },
  );
}
