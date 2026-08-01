// INV-CS-8 test — CAD-export feature-flag gate (assertCadExportAllowed pre-check)
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §5
//
// NB (filnavn-mismatch): denne fils navn ("side-length") stammer fra
// opgavebeskrivelsen, men stl-export.ts:26 implementerer INTET
// side-length/dimension-guard for mesh-størrelse. Grep over lib/, app/ og
// tests/ finder ingen side-length/oversize-invariant nogen steder i
// kodebasen. Den faktiske INV-CS-8 er feature_cad_export-flaget: eksport
// afvises hvis featureCadExport=false, uanset mesh-dimensioner. Testen
// nedenfor dækker den invariant der faktisk findes i koden.
//
// Bemærk også: exportStl() mapper ALLE precheck-fejl (inkl. INV-CS-8) til
// code:"PRECHECK_FAILED" — INV-CS-8 kan derfor kun identificeres via
// message-feltet, ikke via result.code.

import { describe, it, expect } from "vitest";
import { exportStl, assertCadExportAllowed, type StlExportInput } from "@/lib/scanner/stl-export";
import { makeTetrahedron } from "@/lib/scanner/watertight";

function baseInput(): StlExportInput {
  return {
    scanId: "scan-1",
    tenantId: "tenant-1",
    mesh: makeTetrahedron(),
    qualityScore: 0.95,
    featureCadExport: true,
    actorRole: "practitioner",
    practitionerTriggered: true,
    cadDpaAccepted: true,
  };
}

describe("INV-CS-8 · CAD-export feature-flag guard", () => {
  it("(a) happy-path: featureCadExport=true passerer precheck og producerer STL", () => {
    const input = baseInput();
    expect(() => assertCadExportAllowed(input)).not.toThrow();

    const result = exportStl(input);
    expect(result.ok).toBe(true);
  });

  it("(b) failure-mode: featureCadExport=false afviser eksport (INV-CS-8)", () => {
    const input = { ...baseInput(), featureCadExport: false };

    expect(() => assertCadExportAllowed(input)).toThrow(/INV-CS-8/);

    const result = exportStl(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");

    expect(result.code).toBe("PRECHECK_FAILED");
    expect(result.message).toContain("INV-CS-8");
    expect(result.message).toContain("feature_cad_export=false");
  });
});
