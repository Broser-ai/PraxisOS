// GET /fhir/R5/Observation/[id] · returns FHIR R5 Observation for a single finding
// Kontrakt: STATE-OF-THE-ART §7.5 · HUMANIZED-FRONTIER-BLUEPRINT §7

import { NextRequest, NextResponse } from "next/server";
import { createDefaultRepository } from "@/lib/fhir/repository";
import { mapFindingToObservation } from "@/lib/fhir/resource-mappers";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) {
    return fhirError(400, "invalid", "id is required");
  }

  // Sprint 4: tenant resolves fra Authorization JWT / SMART on FHIR context.
  // For now: X-Tenant-Id header (dev-only) or default 'bypilar'.
  const tenantId = req.headers.get("x-tenant-id") ?? "bypilar";

  const repo = createDefaultRepository();
  const found = await repo.getFinding(id, tenantId);
  if (!found) {
    return fhirError(404, "not-found", `Observation/${id} not found for tenant ${tenantId}`);
  }

  const observation = mapFindingToObservation({
    finding: found.finding,
    patientId: found.scan.client_id,
    encounterId: found.scan.encounter_id,
    practitionerId: found.scan.practitioner_id,
    effectiveDateTime: found.scan.performed_at,
    vlmModelVersion: found.scan.vlm_model_version,
  });

  return new NextResponse(JSON.stringify(observation), {
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
      issue: [
        {
          severity: "error",
          code,
          diagnostics,
        },
      ],
    }),
    {
      status,
      headers: { "content-type": "application/fhir+json" },
    },
  );
}
