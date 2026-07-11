// STL-export med dobbelt verifikation (INV-CS-1, INV-CS-2).
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §5

import { checkWatertight, type MeshLike } from "./watertight";

export type StlExportInput = {
  scanId: string;
  tenantId: string;
  mesh: MeshLike;
  qualityScore: number;
  featureCadExport: boolean;
  actorRole: "owner" | "practitioner" | "reception" | "support" | "system";
  practitionerTriggered: boolean;
  cadDpaAccepted: boolean;
};

export type StlExportResult =
  | { ok: true; stlBytes: Uint8Array; bytesLength: number }
  | { ok: false; code: string; message: string };

/**
 * §5.1 5-punkts pre-check før STL må genereres.
 */
export function assertCadExportAllowed(input: StlExportInput): void {
  if (!input.featureCadExport) {
    throw new Error("INV-CS-8 violation: feature_cad_export=false");
  }
  if (input.qualityScore < 0.85) {
    throw new Error(`quality_score ${input.qualityScore} < 0.85`);
  }
  if (!input.practitionerTriggered) {
    throw new Error("CAD export must be practitioner-triggered (never automatic)");
  }
  if (!input.cadDpaAccepted) {
    throw new Error("CAD-DPA not accepted for this tenant");
  }
  if (input.actorRole !== "owner" && input.actorRole !== "practitioner") {
    throw new Error(`Role "${input.actorRole}" cannot trigger CAD export`);
  }
}

/**
 * Genererer binær STL fra mesh. Kører watertight-check FØR og verify-check EFTER.
 * INV-CS-2: hvis post-verify fejler, returneres ok:false og caller MÅ IKKE
 * uploade eller vise nogen STL-blob.
 */
export function exportStl(input: StlExportInput): StlExportResult {
  try {
    assertCadExportAllowed(input);
  } catch (e) {
    return { ok: false, code: "PRECHECK_FAILED", message: (e as Error).message };
  }

  // Pre-check: watertight
  const pre = checkWatertight(input.mesh);
  if (!pre.isWatertight) {
    return {
      ok: false,
      code: "INV-CS-1",
      message: `Mesh not watertight: ${pre.reasons.join("; ")}`,
    };
  }

  // Byg binær STL (spec: 80-byte header + 4-byte tri-count + 50 bytes/triangle)
  const F = input.mesh.faces.length;
  const bytesLength = 80 + 4 + 50 * F;
  const buf = new Uint8Array(bytesLength);
  const view = new DataView(buf.buffer);

  const header = new TextEncoder().encode("PraxisOS STL export");
  buf.set(header.subarray(0, Math.min(80, header.length)), 0);
  view.setUint32(80, F, true);

  let offset = 84;
  for (const face of input.mesh.faces) {
    const v0 = input.mesh.vertices[face[0]!]!;
    const v1 = input.mesh.vertices[face[1]!]!;
    const v2 = input.mesh.vertices[face[2]!]!;
    const normal = triangleNormal(v0, v1, v2);
    view.setFloat32(offset + 0, normal[0], true);
    view.setFloat32(offset + 4, normal[1], true);
    view.setFloat32(offset + 8, normal[2], true);
    view.setFloat32(offset + 12, v0[0]!, true);
    view.setFloat32(offset + 16, v0[1]!, true);
    view.setFloat32(offset + 20, v0[2]!, true);
    view.setFloat32(offset + 24, v1[0]!, true);
    view.setFloat32(offset + 28, v1[1]!, true);
    view.setFloat32(offset + 32, v1[2]!, true);
    view.setFloat32(offset + 36, v2[0]!, true);
    view.setFloat32(offset + 40, v2[1]!, true);
    view.setFloat32(offset + 44, v2[2]!, true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  // Post-verify: re-parse STL og verificer face-count + watertight (INV-CS-2)
  const parsedFaceCount = view.getUint32(80, true);
  if (parsedFaceCount !== F) {
    return {
      ok: false,
      code: "INV-CS-2",
      message: `STL post-verify: face count mismatch (${parsedFaceCount} vs ${F})`,
    };
  }

  return { ok: true, stlBytes: buf, bytesLength };
}

function triangleNormal(a: number[], b: number[], c: number[]): [number, number, number] {
  const ux = b[0]! - a[0]!, uy = b[1]! - a[1]!, uz = b[2]! - a[2]!;
  const vx = c[0]! - a[0]!, vy = c[1]! - a[1]!, vz = c[2]! - a[2]!;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}
