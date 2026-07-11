// INV-CS-1 watertight test
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §6.1

import { describe, it, expect } from "vitest";
import {
  checkWatertight,
  makeTetrahedron,
  makeOpenPyramid,
} from "@/lib/scanner/watertight";

describe("INV-CS-1 · watertight garanti", () => {
  it("(a) closed tetraeder er watertight (χ = 2)", () => {
    const report = checkWatertight(makeTetrahedron());
    expect(report.isWatertight).toBe(true);
    expect(report.eulerCharacteristic).toBe(2);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
  });

  it("(b) åben pyramide er IKKE watertight (boundary-edges)", () => {
    const report = checkWatertight(makeOpenPyramid());
    expect(report.isWatertight).toBe(false);
    expect(report.boundaryEdges).toBeGreaterThan(0);
    expect(report.reasons.some((r) => r.includes("boundary edges"))).toBe(true);
  });

  it("(c) non-triangular face rejekteres", () => {
    const bad = {
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
      faces: [[0, 1, 2, 3]], // 4-vertex face
    };
    const report = checkWatertight(bad);
    expect(report.isWatertight).toBe(false);
    expect(report.reasons.some((r) => r.includes("non-triangular"))).toBe(true);
  });

  it("(d) non-manifold edge (3+ faces per edge) rejekteres", () => {
    const bad = {
      vertices: [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,1]],
      faces: [
        [0, 1, 2],
        [0, 1, 3],
        [0, 1, 4], // edge 0-1 delt af 3 faces
      ],
    };
    const report = checkWatertight(bad);
    expect(report.isWatertight).toBe(false);
    expect(report.nonManifoldEdges).toBeGreaterThan(0);
  });
});
