// GET /fhir/R5/DiagnosticReport/[id] · returns FHIR R5 DiagnosticReport for one scan session

import { NextRequest, NextResponse } from "next/server";
import { createDefaultRepository } from "@/lib/fhir/repository";
import { mapScanSessionToDiagnosticReport } from "@/lib/fhir/resource-mappers";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return fhirError(400, "invalid", "id is required");

  const tenantId = req.headers.get("x-tenant-id") ?? "bypilar";
  const repo = createDefaultRepository();
  const scan = await repo.getScan(id, tenantId);
  if (!scan) {
    return fhirError(404, "not-found", `DiagnosticReport/${id} not found for tenant ${tenantId}`);
  }

  const report = mapScanSessionToDiagnosticReport({
    scanId: scan.id,
    patientId: scan.client_id,
    encounterId: scan.encounter_id,
    practitionerId: scan.practitioner_id,
    effectiveDateTime: scan.performed_at,
    overallSummary: scan.overall_summary_da,
    findingIds: scan.findings.map((f) => f.id),
    imagingStudyId: scan.imaging_study_url ? scan.id : undefined,
    vlmModelVersion: scan.vlm_model_version,
  });

  return new NextResponse(JSON.stringify(report), {
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
