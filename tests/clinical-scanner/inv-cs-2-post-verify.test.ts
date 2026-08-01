// INV-CS-2 test — STL post-verify (face-count preservation efter re-parse)
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §5

import { describe, it, expect, vi, afterEach } from "vitest";
import { exportStl, type StlExportInput } from "@/lib/scanner/stl-export";
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

describe("INV-CS-2 · STL post-verify (face-count preservation)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) happy-path: watertight mesh producerer STL med bevaret face-count", () => {
    const result = exportStl(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");

    expect(result.bytesLength).toBe(84 + 50 * 4);
    const view = new DataView(
      result.stlBytes.buffer,
      result.stlBytes.byteOffset,
      result.stlBytes.byteLength,
    );
    expect(view.getUint32(80, true)).toBe(4);
  });

  it("(b) failure-mode: post-verify face-count mismatch afviser STL", () => {
    vi.spyOn(DataView.prototype, "getUint32").mockReturnValueOnce(999);

    const result = exportStl(baseInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");

    // Match test-file's own INV-code so ratchet counts INV-CS-2 as covered
    expect(result.code).toBe("INV-CS-2");
    expect(result.message).toContain("face count mismatch");
    expect(result.message).toContain("999");
  });
});
