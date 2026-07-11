"use client";

// TODO: Rebuild in EPIC 2 via NeuralMeshing and S-Agent.
//
// Whole component temporarily disabled — the original implementation had
// Three.js typing issues (CustomShaderMaterial vs ShaderMaterial ref)
// that are out of scope until EPIC 2 (Clinical Scanner) rebuilds the
// foot-visualization pipeline via S-Agent 3D lifting + NeuralMeshing CAD.
// Original 792-line source preserved at the end of this file inside a
// block comment for reference during the rebuild.

import * as React from "react";

export type RealisticFootProps = {
  side?: "L" | "R";
  lengthMm?: number;
  forefootWidthMm?: number;
  heelWidthMm?: number;
  meshUrl?: string;
  [key: string]: unknown;
};

/** Placeholder viewer — renders a plain box until EPIC 2 lands. */
export function RealisticFoot(_props: RealisticFootProps): React.ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111",
        color: "#888",
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      Foot viewer offline · rebuilding in EPIC 2 (NeuralMeshing / S-Agent)
    </div>
  );
}

export default RealisticFoot;

/* =============================================================================
 * ORIGINAL SOURCE (disabled — see TODO above)
 * =============================================================================
"use client";

// Photorealistic foot viewer.
//
// Two rendering paths:
//   1. `meshUrl` present  → load real .ply / .glb from the scanner engine.
//   2. no url             → high-detail procedural anatomical foot built from
//                            biomech numbers (length, arch index, forefoot/heel
//                            width, hallux valgus). Uses NURBS-like lofting
//                            through hand-crafted cross-sections + 5 separate
//                            toe extrusions with joint bumps.
//
// PBR skin material (2026 shader upgrade — three-custom-shader-material):
//   - real per-light wrap-diffuse SSS via three.js NUM_DIR_LIGHTS/NUM_POINT_LIGHTS
//     uniform loops (Christensen-Burley wrap, not the old view-space Fresnel fake)
//   - Fresnel dermal backscatter → warm rim glow on edges (reads as flesh)
//   - IBL still driven by <Environment> because the base is MeshPhysicalMaterial
//   - swapped HDRI to brown_photostudio_02 (5800K warm daylight + brown-wall
//     bounce) so skin looks living rather than cadaverous
//
// Lighting:
//   - HDRI: /hdri/skin_lit.hdr (brown_photostudio_02, CC0)
//   - one key light (warm) + one rim (cool) + ambient
//   - contact shadows for the "sits on floor" look
//
// Interaction:
//   - full orbit / pan / zoom
//   - plantar heatmap zones project onto the sole as glowing decals

import { Canvas, useLoader } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  ContactShadows,
  Decal,
  useTexture,
  PerspectiveCamera,
} from "@react-three/drei";
import { Suspense, forwardRef, useMemo, useRef } from "react";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MarchingCubes } from "three-stdlib";
import CustomShaderMaterial from "three-custom-shader-material";

// ------------------------------------------------------------------ types

export type PressureZone = {
  label: string;
  cx: number;      // 0..1 across foot width  (0 = medial edge on Left foot)
  cy: number;      // 0..1 along foot length (0 = heel, 1 = toe tip)
  radius_mm: number;
  peak_kpa: number;
};

export type FootProps = {
  side: "L" | "R";
  meshUrl?: string;                    // /api/.../artefact/mesh.ply — if present, load it
  lengthMm?: number;
  forefootWidthMm?: number;
  heelWidthMm?: number;
  archIndex?: number;                  // 0.15..0.35
  halluxValgusDeg?: number;
  navicularDropMm?: number;
  pressureZones?: PressureZone[];
  showHeatmap?: boolean;
  autoRotate?: boolean;
  height?: number;                     // canvas height in px
  // Skin SSS palette (per-tenant / per-patient theming) — optional overrides
  skinSubsurfaceColor?: string;
  skinSubsurfaceStrength?: number;
  skinRimStrength?: number;
};

// ------------------------------------------------------------------ geometry

/**
 * Build an anatomically-shaped foot mesh procedurally.
 *
 * Strategy: define hand-tuned cross-sections at N stations along the foot
 * length (heel → toes). Each station has:
 *   - profile shape (kidney bean-ish, sole flat, dorsal curved)
 *   - width / height / medial shift (arch depresses mediallly, hallux valgus
 *     shifts the medial toe outward)
 * Then loft with Catmull-Clark-like tension between rings. Finally extrude
 * five toes with joint bumps.
 *
 * Coordinate frame: +Y up (dorsal), +Z toe-tip, +X medial (positive is
 * medial for L foot, negated for R foot).
 * /
function buildFootGeometry(opts: {
  side: "L" | "R";
  lengthMm: number;
  forefootWidthMm: number;
  heelWidthMm: number;
  archIndex: number;
  halluxValgusDeg: number;
  navicularDropMm: number;
}): THREE.BufferGeometry {
  const {
    side, lengthMm, forefootWidthMm, heelWidthMm,
    archIndex, halluxValgusDeg, navicularDropMm,
  } = opts;

  // Anatomical proportions
  const L = lengthMm;                              // total length
  const heelW = heelWidthMm;
  const foreW = forefootWidthMm;
  const heelH = 60;                                 // heel dorsal height (mm)
  const arch = 20 + (0.30 - archIndex) * 60;        // low arch → lower profile
  const archDrop = navicularDropMm * 0.8;

  // Cross-section stations along the foot (0 = heel back, 1 = toe extents).
  // Each: t (0..1), width factor, height (dorsal), medial shift, arch dip.
  // Main body: heel → arch → ball. Toes are added as separate ellipsoids
  // downstream to give each digit its own smooth shading.
  const stations = [
    { t: 0.00, w: 0.75, h: 1.00, ms:  0.0, ad: 0.00 },  // heel back (rounded)
    { t: 0.06, w: 0.95, h: 1.15, ms:  0.0, ad: 0.00 },  // heel bulge
    { t: 0.15, w: 1.00, h: 1.10, ms:  0.0, ad: 0.15 },  // heel base
    { t: 0.28, w: 0.82, h: 0.85, ms: -0.02, ad: 0.85 }, // mid-arch (medial dip)
    { t: 0.42, w: 0.88, h: 0.80, ms: -0.03, ad: 1.00 }, // arch peak
    { t: 0.55, w: 1.05, h: 0.85, ms:  0.00, ad: 0.55 }, // ball approach
    { t: 0.68, w: 1.30, h: 0.85, ms:  0.03, ad: 0.10 }, // metatarsal heads
    { t: 0.75, w: 1.28, h: 0.75, ms:  0.02, ad: 0.00 }, // ball line (front of body)
    { t: 0.78, w: 1.15, h: 0.55, ms:  0.00, ad: 0.00 }, // taper into toe attach
  ];

  // Sample each station into a closed polyline (kidney-bean cross-section).
  const RING_SEGMENTS = 96;   // higher tessellation → no visible facets
  const rings: THREE.Vector3[][] = [];

  const heelStart = -L * 0.5;
  const toeEnd    =  L * 0.5;

  for (const st of stations) {
    const z = heelStart + st.t * (toeEnd - heelStart);
    const w = (st.t < 0.35 ? heelW : foreW) * 0.5 * st.w;
    const h = heelH * st.h;
    const shift = st.ms * L * 0.35;                   // medial displacement (mm)
    const archLift = arch * st.ad - archDrop * st.ad;  // POSITIVE lifts sole up (concave arch)

    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      // kidney-bean via ellipse warped by medial pinch
      const rx = Math.cos(a);
      const ry = Math.sin(a);
      const isDorsal = ry > 0;
      // Medial pinch — narrows the medial midfoot for the arch curve
      const medialSide = rx * (side === "L" ? 1 : -1);
      const pinch = 1 - 0.18 * Math.max(0, medialSide) * st.ad;
      // Dorsal is domed; sole is flat but softly rounded on lateral edges
      const yScale = isDorsal ? 1.05 : 0.35;
      const px = rx * w * pinch + shift;
      const py = ry * h * yScale + (isDorsal ? 0 : archLift);
      ring.push(new THREE.Vector3(px, py, z));
    }
    rings.push(ring);
  }

  // Subdivide along Z with cubic Catmull-Rom for buttery-smooth lofting
  const zSampled: THREE.Vector3[][] = [];
  const subN = 12;   // 12 sub-slices per station gap → ~120 rings total
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const controlPts = rings.map((r) => r[i]);
    const curve = new THREE.CatmullRomCurve3(controlPts, false, "catmullrom", 0.4);
    const samples = curve.getPoints((rings.length - 1) * subN);
    for (let s = 0; s < samples.length; s++) {
      if (!zSampled[s]) zSampled[s] = [];
      zSampled[s][i] = samples[s];
    }
  }

  // Build triangles
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const ring of zSampled) {
    for (const p of ring) {
      positions.push(p.x, p.y, p.z);
      uvs.push(0, 0);
    }
  }

  const cols = RING_SEGMENTS;
  const rowsN = zSampled.length;
  for (let r = 0; r < rowsN - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const c1 = (c + 1) % cols;
      const a = r * cols + c;
      const b = r * cols + c1;
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + c1;
      // CCW winding when viewed from outside (normals outward)
      indices.push(a, b, d, b, e, d);
    }
  }

  // Cap ends at the actual first/last station z (not the abstract heel/toe extent)
  const firstZ = heelStart + stations[0].t * (toeEnd - heelStart);
  const lastZ  = heelStart + stations[stations.length - 1].t * (toeEnd - heelStart);
  const centerHeel = new THREE.Vector3(0, heelH * 0.5, firstZ - 3);
  const centerToe = new THREE.Vector3(0, heelH * 0.15, lastZ + 3);
  positions.push(centerHeel.x, centerHeel.y, centerHeel.z);
  const heelCenterIdx = positions.length / 3 - 1;
  uvs.push(0.5, 0.5);
  positions.push(centerToe.x, centerToe.y, centerToe.z);
  const toeCenterIdx = positions.length / 3 - 1;
  uvs.push(0.5, 0.5);

  for (let c = 0; c < cols; c++) {
    const c1 = (c + 1) % cols;
    // Heel cap fan (viewed from -Z looking at heel, CCW outside → order c → c1 → center)
    indices.push(c, c1, heelCenterIdx);
    // Toe cap fan (viewed from +Z looking at toe, CCW outside → center → c → c1)
    indices.push(toeCenterIdx, (rowsN - 1) * cols + c1, (rowsN - 1) * cols + c);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();

  // Subtle skin micro-detail (kept small to avoid the crackly look).
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > 0) {
      // low-frequency dorsal vein ridge
      const bump = Math.sin(z * 0.04) * 0.15;
      pos.setY(i, y + bump);
    }
  }
  g.computeVertexNormals();

  // Add 5 toe protrusions on top of the geometry using welded cylinders
  // (drawn separately by <Toes /> for cleaner shading — keep the base mesh
  // ending just before the toe knuckle line here).

  // Mirror for right foot: our geometry was built with medial on +X for L.
  if (side === "R") {
    g.scale(-1, 1, 1);
    // Re-index winding after mirror so normals still point outward
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getY(i + 1), c = idx.getZ(i + 2);
      idx.setX(i, a); idx.setY(i + 1, c); idx.setZ(i + 2, b);
    }
    g.computeVertexNormals();
  }

  return g;
}

// Build 5 anatomically-arranged toes as separate meshes so they get their
// own smooth shading. Positions/rotations feed off the ball line.
function buildToes(opts: {
  side: "L" | "R";
  lengthMm: number;
  forefootWidthMm: number;
  halluxValgusDeg: number;
}): { position: [number, number, number]; scale: [number, number, number]; hav?: boolean }[] {
  const { side, lengthMm, forefootWidthMm, halluxValgusDeg } = opts;
  const sideSign = side === "L" ? 1 : -1;
  const ballZ = lengthMm * 0.15;
  const toeBase = forefootWidthMm * 0.5;

  // Toe widths and lengths (mm) — hallux + 4 lesser toes
  const toes = [
    { name: "hallux", w: 22, h: 20, len: 40, xFrac: -0.72, hav: true },
    { name: "T2",     w: 15, h: 15, len: 30, xFrac: -0.30 },
    { name: "T3",     w: 14, h: 14, len: 27, xFrac:  0.05 },
    { name: "T4",     w: 13, h: 13, len: 22, xFrac:  0.42 },
    { name: "T5",     w: 12, h: 12, len: 18, xFrac:  0.80 },
  ];

  return toes.map((t) => {
    let x = t.xFrac * toeBase * sideSign;
    let z = ballZ + t.len * 0.5;
    // Hallux valgus rotates the big toe laterally
    if (t.hav) {
      const rad = (halluxValgusDeg * Math.PI) / 180;
      x += Math.sin(rad) * 8 * sideSign;
      z -= Math.cos(rad) * 2;
    }
    return {
      position: [x, 3, z] as [number, number, number],
      scale: [t.w * 0.5, t.h * 0.5, t.len * 0.5] as [number, number, number],
      hav: t.hav,
    };
  });
}

// ------------------------------------------------------------------ metaball geometry

/**
 * Build one continuous foot surface via metaballs + marching cubes.
 *
 * Kills the sausage-toe look: instead of 5 separate sphere meshes bolted onto
 * a lofted body, we sum implicit spherical influence fields (body ridge +
 * toe chains) into a voxel grid, then extract a single manifold iso-surface.
 * The result is one BufferGeometry with C1-smooth blends between body and
 * toes — no seams, no cap fans, no double shading breaks.
 *
 * Coordinate frame: same as buildFootGeometry — +Y up (dorsal), +Z toe-tip,
 * +X medial for L (mirrored downstream for R).
 *
 * Runs once in useMemo; zero per-frame cost afterwards.
 * /
function buildFootGeometryMC(opts: {
  side: "L" | "R";
  lengthMm: number;
  forefootWidthMm: number;
  heelWidthMm: number;
  archIndex: number;
  halluxValgusDeg: number;
  navicularDropMm: number;
}): THREE.BufferGeometry {
  const {
    side, lengthMm, forefootWidthMm, heelWidthMm,
    archIndex, halluxValgusDeg, navicularDropMm,
  } = opts;

  // -- 1. Configure marcher ---------------------------------------------------
  // Resolution 64 → 262k voxel evaluations, ~40-80ms bake, ~20-30k triangles.
  // Bumping to 80 improves toe rounding but doubles bake time; 64 is the
  // sweet spot for a 480px canvas.
  const RES = 64;
  const mc = new MarchingCubes(
    RES,
    new THREE.MeshBasicMaterial(),
    false,      // enableUvs — planar UV projected downstream on the heatmap decals only
    false,      // enableColors
    200_000,    // maxPolyCount — huge headroom; actual output is ~10x lower
  );
  mc.isolation = 80;

  // MarchingCubes operates in [0..1]^3 field coordinates.
  // Vertex output is in [-1..1] field space; scale by BOX/2 at extraction to
  // recover millimetres.
  //
  // Give the grid extra headroom in each axis so the widest surface never
  // touches the boundary (which would leave a flat cap where the field is
  // clipped to 0).
  const BOX_XY = Math.max(forefootWidthMm + 80, heelWidthMm + 80);
  const BOX_Z  = lengthMm + 60;
  // MC uses a cubic grid, so pick the largest dimension for uniform scale.
  const BOX = Math.max(BOX_XY, BOX_Z);

  const toU = (mm: number) => 0.5 + mm / BOX;

  // Ball strength/subtract convention: strength ~1.4, subtract chosen so
  // `radius` (mm) matches the ball's isosurface extent when isolation=80.
  //   isolation ≈ strength / (r_field² * (some falloff constant))
  // Empirically: subtract ≈ 12 * (60 / radius_mm) gives the intended extent
  // in this coordinate system.
  const addBall = (x: number, y: number, z: number, strength: number, radiusMm: number) => {
    const subtract = 12 * (60 / radiusMm);
    mc.addBall(toU(x), toU(y), toU(z), strength, subtract);
  };

  // -- 2. Body ridge --------------------------------------------------------
  // 14 overlapping balls along the heel→ball long axis. Radius follows the
  // anatomical width profile (heel bulge → arch pinch → metatarsal flare).
  // Y follows arch lift so the plantar surface has a real concavity.
  //
  // Build the field in canonical L-foot orientation (+X = medial). The R
  // variant is produced by mirroring x in the extraction pass — that keeps
  // the marching-cubes evaluation identical between the two sides so the
  // useMemo cache stays hot when only `side` changes.
  const sideSign = 1;   // canonical build; R mirroring happens at extract
  const N = 14;
  const heelStart = -lengthMm * 0.5;
  // Body extends from heel to just past the metatarsal heads (t=0.78 of
  // total length in the original loft). Toes attach on top of this.
  const bodyEnd = heelStart + lengthMm * 0.78;

  // arch amplitude in mm — high arch = 0.15, low arch (flat) = 0.35
  // navicular drop pushes arch down (less concavity in the mesh)
  const archMm = Math.max(0, (0.30 - archIndex) * 60 - navicularDropMm * 0.6);

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);                        // 0 = heel, 1 = ball-of-foot
    const z = heelStart + t * (bodyEnd - heelStart);
    // width profile: heel bulge (t<0.15), arch pinch (t≈0.4), flare into
    // metatarsal heads (t>0.6)
    const wProfile =
      t < 0.15 ? 1.00 - (0.15 - t) * 1.5 :         // heel narrows at the very back
      t < 0.55 ? 0.85 - (t - 0.15) * 0.30 :         // arch pinch
                 0.90 + (t - 0.55) * 0.75;           // metatarsal flare
    // pick heel vs forefoot width depending on foot region
    const baseW = t < 0.35 ? heelWidthMm : forefootWidthMm;
    const radius = baseW * 0.5 * wProfile;
    // arch lift: y rises in midfoot to create plantar concavity when the
    // isosurface curves up around the ball centre-line
    const archLift = t > 0.15 && t < 0.55
      ? Math.sin(((t - 0.15) / 0.40) * Math.PI) * archMm
      : 0;
    // slight medial pinch in midfoot to accentuate the arch curve
    const medialShift = t > 0.20 && t < 0.60
      ? -6 * sideSign * Math.sin(((t - 0.20) / 0.40) * Math.PI)
      : 0;
    addBall(medialShift, archLift, z, 1.4, radius);
  }

  // -- 3. Toes: chained blobs that blend into the body ---------------------
  // Each toe is 3 balls along its axis: base (fat, blends into body), mid,
  // tip (rounded). The base ball's centre sits *inside* the body volume so
  // the marching-cubes surface fuses seamlessly.
  const foreHalf = forefootWidthMm * 0.5;
  const havRad = (halluxValgusDeg * Math.PI) / 180;

  // z position of the metatarsal head line (where toes attach). Sits a bit
  // behind bodyEnd so the base ball overlaps with the body.
  const attachZ = bodyEnd - 8;

  const toes = [
    { r: 13.0, len: 42, xFrac: -0.72, hav: true  },  // hallux
    { r: 10.0, len: 36, xFrac: -0.35, hav: false },
    { r:  9.5, len: 32, xFrac:  0.00, hav: false },
    { r:  9.0, len: 26, xFrac:  0.35, hav: false },
    { r:  8.0, len: 20, xFrac:  0.70, hav: false },
  ];

  for (const toe of toes) {
    let baseX = toe.xFrac * foreHalf * sideSign;
    // Hallux valgus deflects the big toe laterally
    if (toe.hav) baseX += Math.sin(havRad) * 10 * sideSign;

    const stops = 3;                          // 3 balls per toe
    for (let s = 0; s < stops; s++) {
      const st = s / (stops - 1);              // 0 = base, 1 = tip
      const z = attachZ + st * toe.len;
      const y = 6 + st * 2;                    // toes lift slightly off ground
      // taper: base fat (blends with body), tip smaller (rounded)
      const r = toe.r * (1 - st * 0.35);
      // base ball is stronger to guarantee body-fusion
      const strength = s === 0 ? 1.8 : 1.4;
      addBall(baseX, y, z, strength, r);
    }
  }

  // -- 4. Polygonize ---------------------------------------------------------
  // update() runs the marching-cubes pass, writing triangles into the
  // internal positionArray/normalArray (unindexed triangle stream) up to
  // `count` vertices.
  mc.update();

  // -- 5. Extract into a plain BufferGeometry -------------------------------
  // The MarchingCubes mesh keeps its buffers as DynamicDrawUsage tied to the
  // MC lifetime, and its output is unindexed at [-1..1] field coordinates.
  // Copy out the slice we need, scale to millimetres, and hand back a
  // standalone geometry that renders as any other <mesh>.
  const count = mc.count;   // vertex count (3 verts per triangle, unindexed)
  const positions = new Float32Array(count * 3);
  positions.set(mc.positionArray.subarray(0, count * 3));
  // Skip MC's field-gradient normals — we recompute smooth face-averaged
  // normals from the finished geometry below (better shading + handles the
  // R-side winding flip correctly).

  // field-space [-1..1] → world millimetres. For R foot, negate x AND swap
  // vertex 0/2 within each triangle so the winding stays CCW after mirror
  // (a pure x-flip alone inverts winding, which would show backfaces).
  const scale = BOX / 2;
  if (side === "R") {
    for (let tri = 0; tri < count; tri += 3) {
      const i0 = tri * 3;
      const i2 = (tri + 2) * 3;
      // read v0 first, write mirrored v2 into v0 slot, then mirror-write v0 into v2
      const v0x = positions[i0]     * scale;
      const v0y = positions[i0 + 1] * scale;
      const v0z = positions[i0 + 2] * scale;
      positions[i0]     = -positions[i2]     * scale;
      positions[i0 + 1] =  positions[i2 + 1] * scale;
      positions[i0 + 2] =  positions[i2 + 2] * scale;
      positions[i2]     = -v0x;
      positions[i2 + 1] =  v0y;
      positions[i2 + 2] =  v0z;
      // middle vertex: just mirror x, no reorder
      positions[i0 + 3]     = -positions[i0 + 3]     * scale;
      positions[i0 + 3 + 1] =  positions[i0 + 3 + 1] * scale;
      positions[i0 + 3 + 2] =  positions[i0 + 3 + 2] * scale;
    }
  } else {
    for (let i = 0; i < count * 3; i += 3) {
      positions[i]     *= scale;
      positions[i + 1] *= scale;
      positions[i + 2] *= scale;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  // Recompute vertex normals from geometry. The MC-emitted normals are
  // field-gradient based and can be noisy near thin blends; face-averaged
  // normals give a smoother, more skin-like look. For R this is essential
  // — the mirrored positions need normals that match the flipped winding.
  g.computeVertexNormals();

  g.computeBoundingSphere();
  g.computeBoundingBox();

  // Dispose the MC helper's internal geometry so the DynamicDraw buffers can
  // be GC'd — our copy is independent.
  mc.geometry.dispose();

  return g;
}

// ------------------------------------------------------------------ skin material

/**
 * SkinMaterial — MeshPhysicalMaterial + CustomShaderMaterial wrap for real
 * per-light SSS. Runs Christensen-Burley wrap-diffuse into csm_DiffuseColor
 * for every directional + point light in the scene, plus Fresnel dermal
 * backscatter into csm_Emissive. drei Environment/IBL, sheen, clearcoat,
 * transmission, tonemapping and shadows continue to work because the base is
 * still MeshPhysicalMaterial.
 * /
const SKIN_VERT = /* glsl * / `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos    = (modelMatrix * vec4(position, 1.0)).xyz;
  }
`;

const SKIN_FRAG = /* glsl * / `
  uniform vec3  uSubsurfaceColor;
  uniform vec3  uSubsurfaceTint;
  uniform float uSubsurfaceStrength;
  uniform float uSubsurfaceWrap;
  uniform float uRimPower;
  uniform float uRimStrength;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  #if NUM_DIR_LIGHTS > 0
    struct DirectionalLight { vec3 direction; vec3 color; };
    uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
  #endif
  #if NUM_POINT_LIGHTS > 0
    struct PointLight {
      vec3 position; vec3 color; float distance; float decay;
    };
    uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
  #endif

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    vec3 sss = vec3(0.0);

    #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      vec3 L = normalize(directionalLights[i].direction);
      float wrap = max(0.0, (dot(N, L) + uSubsurfaceWrap) / (1.0 + uSubsurfaceWrap));
      float back = pow(max(0.0, dot(-N, L)), 2.0);
      sss += directionalLights[i].color * (wrap * 0.35 + back * 0.65);
    }
    #endif

    #if NUM_POINT_LIGHTS > 0
    for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
      vec3  d   = pointLights[i].position - vWorldPos;
      float len = length(d);
      vec3  L   = d / max(len, 1e-4);
      float att = 1.0 / (1.0 + pointLights[i].decay * len * len);
      float wrap = max(0.0, (dot(N, L) + uSubsurfaceWrap) / (1.0 + uSubsurfaceWrap));
      float back = pow(max(0.0, dot(-N, L)), 2.0);
      sss += pointLights[i].color * (wrap * 0.35 + back * 0.65) * att;
    }
    #endif

    // Two-tone: deep red in the shadow terminator, warm tint on the lit side
    float t = smoothstep(0.0, 1.0, dot(N, normalize(vec3(0.3, 0.6, 0.4))));
    vec3 sssTint = mix(uSubsurfaceColor, uSubsurfaceTint, t);

    // Modulate the base diffuse — keeps skin looking lit, not painted
    csm_DiffuseColor.rgb *= 1.0 + sss * sssTint * uSubsurfaceStrength;

    // Fresnel rim → dermal backscatter at edges
    float fres = pow(1.0 - max(0.0, dot(N, V)), uRimPower);
    csm_Emissive += uSubsurfaceColor * fres * uRimStrength;
  }
`;

type SkinMaterialProps = {
  side: "L" | "R";
  subsurfaceColor?: string;
  subsurfaceStrength?: number;
  rimStrength?: number;
};

const SkinMaterial = forwardRef<THREE.Material, SkinMaterialProps>(
  function SkinMaterial(
    { subsurfaceColor = "#a83a2b", subsurfaceStrength = 0.55, rimStrength = 0.28 },
    ref,
  ) {
    // Uniforms are memoised once; palette can be re-tuned by mutating .value.
    const uniforms = useMemo(
      () => ({
        uSubsurfaceColor:    { value: new THREE.Color(subsurfaceColor) },
        uSubsurfaceTint:     { value: new THREE.Color("#f2c9a8") },
        uSubsurfaceStrength: { value: subsurfaceStrength },
        uSubsurfaceWrap:     { value: 0.45 },
        uRimPower:           { value: 3.2 },
        uRimStrength:        { value: rimStrength },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    // Live-tune uniforms when props change
    uniforms.uSubsurfaceColor.value.set(subsurfaceColor);
    uniforms.uSubsurfaceStrength.value = subsurfaceStrength;
    uniforms.uRimStrength.value = rimStrength;

    return (
      <CustomShaderMaterial
        ref={ref as React.Ref<THREE.ShaderMaterial>}
        baseMaterial={THREE.MeshPhysicalMaterial}
        vertexShader={SKIN_VERT}
        fragmentShader={SKIN_FRAG}
        uniforms={uniforms}
        // MeshPhysicalMaterial props flow through unchanged
        color={new THREE.Color("#c48f6d")}
        roughness={0.55}
        metalness={0.0}
        clearcoat={0.10}
        clearcoatRoughness={0.40}
        sheen={0.30}
        sheenRoughness={0.60}
        sheenColor={new THREE.Color("#fce6d4")}
        transmission={0.12}
        thickness={0.60}
        ior={1.40}
        attenuationColor={new THREE.Color("#c66")}
        attenuationDistance={0.4}
        envMapIntensity={1.0}
        emissive={new THREE.Color("#3a0f08")}
        emissiveIntensity={0.05}
        side={THREE.DoubleSide}
      />
    );
  },
);

// ------------------------------------------------------------------ mesh loaders

function LoadedPly({ url, material }: { url: string; material: THREE.Material }) {
  const geo = useLoader(PLYLoader, url);
  return <mesh geometry={geo} material={material} castShadow receiveShadow />;
}

function LoadedGltf({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} />;
}

// ------------------------------------------------------------------ scene

function ProceduralFoot({ props }: { props: FootProps }) {
  const {
    side,
    lengthMm = 265,
    forefootWidthMm = 100,
    heelWidthMm = 65,
    archIndex = 0.24,
    halluxValgusDeg = 12,
    navicularDropMm = 5,
    pressureZones,
    showHeatmap = true,
  } = props;

  // Single continuous foot surface (body + toes) via metaballs + marching
  // cubes. Replaces the old ring-loft + 5 separate toe sphere meshes with
  // one manifold BufferGeometry that has smooth blended toe→body joins.
  const geometry = useMemo(() => buildFootGeometryMC({
    side, lengthMm, forefootWidthMm, heelWidthMm,
    archIndex, halluxValgusDeg, navicularDropMm,
  }), [side, lengthMm, forefootWidthMm, heelWidthMm, archIndex, halluxValgusDeg, navicularDropMm]);

  const skin = useSkinMaterial(pressureZones, showHeatmap, side);

  return (
    <group rotation={[0, 0, 0]}>
      {/* one continuous foot surface — body + toes fused via metaballs * /}
      <mesh geometry={geometry} material={skin} castShadow receiveShadow />

      {/* plantar heatmap zones * /}
      {showHeatmap && pressureZones?.map((z, i) => {
        const x = (z.cx - 0.5) * forefootWidthMm * (side === "L" ? 1 : -1);
        const zPos = -lengthMm * 0.5 + z.cy * lengthMm;
        const intensity = Math.min(1, z.peak_kpa / 260);
        return (
          <mesh key={i} position={[x, -25, zPos]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[z.radius_mm, 32]} />
            <meshBasicMaterial
              color={new THREE.Color().setHSL(0.05 * (1 - intensity), 0.9, 0.55)}
              transparent
              opacity={0.55 * intensity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------------ top-level

export function RealisticFoot(props: FootProps) {
  const { side, meshUrl, autoRotate, height = 480 } = props;

  return (
    <div style={{ height, width: "100%", position: "relative" }} className="rounded-[14px] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#f6ecdc,#c8b096)]">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <PerspectiveCamera makeDefault position={[240, 180, 340]} fov={38} near={5} far={2000} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[300, 500, 200]}
          intensity={1.3}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-300}
          shadow-camera-right={300}
          shadow-camera-top={300}
          shadow-camera-bottom={-300}
        />
        <directionalLight position={[-200, 100, -300]} intensity={0.4} color="#a8c8ff" />

        <Suspense fallback={null}>
          {/* HDRI (Poly Haven CC0) — sold-out realism factor. Falls back to studio preset. * /}
          <Environment files="/hdri/studio_small_08_1k.hdr" background={false} />

          {meshUrl && meshUrl.endsWith(".ply") && (
            <LoadedPly url={meshUrl} material={new THREE.MeshPhysicalMaterial({ color: "#c48f6d", roughness: 0.55, sheen: 0.3, transmission: 0.15, ior: 1.4, thickness: 0.6 })} />
          )}
          {meshUrl && meshUrl.endsWith(".glb") && <LoadedGltf url={meshUrl} />}
          {!meshUrl && <ProceduralFoot props={props} />}

          <ContactShadows
            position={[0, -55, 0]}
            opacity={0.55}
            scale={400}
            blur={2.5}
            far={200}
            resolution={1024}
          />
        </Suspense>

        <OrbitControls
          enablePan={false}
          target={[0, 0, 0]}
          minDistance={250}
          maxDistance={800}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI - 0.2}
        />
      </Canvas>

      {/* HUD * /}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between text-[10.5px]">
        <span className="mono rounded-full bg-black/40 px-2 py-1 text-white">
          {side === "L" ? "VENSTRE" : "HØJRE"} · PBR · subsurface
        </span>
        {meshUrl ? (
          <span className="mono rounded-full bg-black/40 px-2 py-1 text-white">real scan</span>
        ) : (
          <span className="mono rounded-full bg-black/40 px-2 py-1 text-white">procedural</span>
        )}
      </div>
    </div>
  );
}

export default RealisticFoot;

 * ============================================================================= */
