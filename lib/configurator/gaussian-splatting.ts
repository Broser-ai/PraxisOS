// Gaussian Splatting helpers.
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §2
//
// Vi kalder ikke selve rendereren her (det gøres i NeuralConfigurator.tsx).
// Dette modul håndterer parse/validering af .splat-filen og mapper til
// props for @mkkellogg/gaussian-splats-3d (installed via package.json).

export type SplatStats = {
  splatCount: number;
  bboxMinMm: [number, number, number];
  bboxMaxMm: [number, number, number];
  fileSizeBytes: number;
};

/**
 * Læs første 12 bytes af .splat header for at få splat-count.
 * Fuldt parse sker på client-side via gaussian-splats-3d.
 */
export function readSplatStats(bytes: Uint8Array): SplatStats {
  if (bytes.length < 12) {
    return {
      splatCount: 0,
      bboxMinMm: [0, 0, 0],
      bboxMaxMm: [0, 0, 0],
      fileSizeBytes: bytes.length,
    };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  // .splat-format · vi antager magic bytes + version + count
  const splatCount = view.getUint32(4, true);
  return {
    splatCount,
    bboxMinMm: [
      view.getFloat32(8, true),
      view.getFloat32(12, true),
      view.getFloat32(16, true),
    ],
    bboxMaxMm: [
      view.getFloat32(20, true),
      view.getFloat32(24, true),
      view.getFloat32(28, true),
    ],
    fileSizeBytes: bytes.length,
  };
}

/**
 * Fallback: hvis .splat ikke er tilgængeligt, bruger vi .glb-mesh URL
 * fra EPIC 2. Denne funktion mapper mellem de to.
 */
export function resolveViewerSource(input: {
  splatUrl?: string;
  glbUrl?: string;
}): { kind: "splat" | "mesh" | "none"; url?: string } {
  if (input.splatUrl) return { kind: "splat", url: input.splatUrl };
  if (input.glbUrl) return { kind: "mesh", url: input.glbUrl };
  return { kind: "none" };
}
