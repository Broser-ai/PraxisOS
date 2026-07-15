// GET /fhir/R5/metadata · FHIR R5 CapabilityStatement
// Kontrakt: HL7 FHIR R5 §2.1 (every FHIR server MUST publish CapabilityStatement)
// Kilde: https://hl7.org/fhir/R5/capabilitystatement.html

import { NextResponse } from "next/server";

export async function GET() {
  const cs = {
    resourceType: "CapabilityStatement",
    id: "praxisos-r5",
    url: "https://praxis-os-mu.vercel.app/fhir/R5/metadata",
    version: "0.1.0",
    name: "PraxisOSFhirR5",
    title: "PraxisOS FHIR R5 Server",
    status: "draft",
    experimental: true,
    date: "2026-07-13",
    publisher: "ReNew-DK ApS",
    kind: "instance",
    software: {
      name: "PraxisOS",
      version: "0.1.0-sprint-3",
    },
    implementation: {
      description:
        "PraxisOS FHIR R5 façade over internal Postgres · read-only for Observation, DiagnosticReport, DeviceRequest.",
    },
    fhirVersion: "5.0.0",
    format: ["application/fhir+json", "application/json"],
    rest: [
      {
        mode: "server",
        documentation:
          "Multi-tenant server. Tenant-scope resolves fra request path prefix eller Authorization JWT claim (Sprint 4).",
        security: {
          cors: false,
          service: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
                  code: "OAuth",
                  display: "OAuth (SMART on FHIR planned Sprint 4)",
                },
              ],
            },
          ],
        },
        resource: [
          {
            type: "Observation",
            interaction: [{ code: "read" }],
            searchParam: [
              { name: "patient", type: "reference" },
              { name: "category", type: "token" },
              { name: "date", type: "date" },
            ],
          },
          {
            type: "DiagnosticReport",
            interaction: [{ code: "read" }],
            searchParam: [
              { name: "patient", type: "reference" },
              { name: "status", type: "token" },
            ],
          },
          {
            type: "DeviceRequest",
            interaction: [{ code: "read" }],
            searchParam: [
              { name: "patient", type: "reference" },
              { name: "status", type: "token" },
            ],
          },
        ],
      },
    ],
  };

  return new NextResponse(JSON.stringify(cs), {
    status: 200,
    headers: {
      "content-type": "application/fhir+json",
      "cache-control": "public, max-age=300",
    },
  });
}
