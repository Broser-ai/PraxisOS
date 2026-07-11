// Watertight/manifold checks for Level 2 mesh output (INV-CS-1).
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §2.3, §6.1
//
// Ingen ekstern dependency — vi implementerer basale mesh-check selv.
// I prod erstattes med Manifold3D-adapter, men interfacet forbliver.

export type MeshLike = {
  vertices: number[][];      // [[x,y,z], ...]
  faces: number[][];         // [[i0, i1, i2], ...] — triangler
};

export type WatertightReport = {
  isWatertight: boolean;
  eulerCharacteristic: number;
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  reasons: string[];
};

/**
 * Watertight check baseret på:
 *  - Euler-karakteristik (V - E + F)
 *  - Edge-manifold (hver edge delt af nøjagtigt 2 faces)
 *  - Boundary-edges (skal være 0 for closed mesh)
 */
export function checkWatertight(mesh: MeshLike): WatertightReport {
  const V = mesh.vertices.length;
  const F = mesh.faces.length;
  const edgeCounts = new Map<string, number>();
  const reasons: string[] = [];

  for (const face of mesh.faces) {
    if (face.length !== 3) {
      reasons.push(`non-triangular face detected (${face.length} vertices)`);
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % 3]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  const E = edgeCounts.size;

  const eulerCharacteristic = V - E + F;

  if (boundaryEdges > 0) reasons.push(`${boundaryEdges} boundary edges (open surface)`);
  if (nonManifoldEdges > 0) reasons.push(`${nonManifoldEdges} non-manifold edges`);
  if (eulerCharacteristic < 2 && boundaryEdges === 0 && nonManifoldEdges === 0) {
    // Positive genus tilladt, men kun hvis mesh er ellers closed.
    // Fortsat: for foot-scan forventes χ = 2 (sphere-topology)
    reasons.push(`Euler χ=${eulerCharacteristic} < 2 (non-sphere topology)`);
  }

  const isWatertight = boundaryEdges === 0 && nonManifoldEdges === 0 && reasons.length === 0;

  return {
    isWatertight,
    eulerCharacteristic,
    vertexCount: V,
    edgeCount: E,
    faceCount: F,
    nonManifoldEdges,
    boundaryEdges,
    reasons,
  };
}

/** Simpel test-fixture: perfekt tetraeder (χ=2, watertight). */
export function makeTetrahedron(): MeshLike {
  return {
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    faces: [
      [0, 1, 2],
      [0, 3, 1],
      [0, 2, 3],
      [1, 3, 2],
    ],
  };
}

/** Test-fixture: åben pyramide (mangler bund → boundary edges). */
export function makeOpenPyramid(): MeshLike {
  return {
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    faces: [
      [0, 1, 2],
      [0, 3, 1],
      [0, 2, 3],
      // Missing: [1, 3, 2] — pyramiden er åben i bunden
    ],
  };
}
