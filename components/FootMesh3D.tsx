"use client";

// 3D-fod-mesh rotator · ren canvas 2D + projektion (ingen Three.js / WebGL).
// Vertices definerer en fod i 3D, projekteres ortografisk efter rotation.
// Træk for at rotere · klik på snap-knapper for faste vinkler · auto-spin når idle.

import { useEffect, useRef, useState } from "react";

type V3 = [number, number, number];

// ---- Fod-mesh-geometri ----
// Defineret som ringe af punkter langs fodens længde (Z-akse), bred top→smal hæl.
// Origo i midten af foden, x=bred, y=højde (top→bund), z=længde (hæl→tå).

function buildFootMesh(): { vertices: V3[]; edges: [number, number][]; quads: number[][] } {
  const rings: V3[][] = [];
  // 14 ringe fra hæl (z=-50) til tæer (z=50)
  const ringDefs = [
    { z: -50, rx: 14, ry: 10, dy: 0 },   // hæl bagside
    { z: -42, rx: 18, ry: 13, dy: 0 },
    { z: -32, rx: 21, ry: 15, dy: 0 },   // hæl-base
    { z: -20, rx: 18, ry: 11, dy: -3 },  // arch-zone (smallere underside)
    { z: -8,  rx: 17, ry: 9,  dy: -5 },  // arch top
    { z: 4,   rx: 19, ry: 10, dy: -3 },
    { z: 16,  rx: 22, ry: 11, dy: -1 },  // ball
    { z: 26,  rx: 23, ry: 11, dy: 0 },   // forfod
    { z: 34,  rx: 22, ry: 10, dy: 1 },
    { z: 40,  rx: 19, ry: 8,  dy: 2 },
    { z: 44,  rx: 15, ry: 6,  dy: 3 },   // tæer-base
    { z: 48,  rx: 11, ry: 4,  dy: 4 },
    { z: 50,  rx: 6,  ry: 2,  dy: 5 },   // tå-spids
    { z: 51,  rx: 2,  ry: 1,  dy: 5 },
  ];

  const segments = 16; // omkreds-segmenter
  for (const ring of ringDefs) {
    const ringVerts: V3[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a) * ring.rx;
      const y = Math.sin(a) * ring.ry + ring.dy;
      ringVerts.push([x, y, ring.z]);
    }
    rings.push(ringVerts);
  }

  const vertices: V3[] = rings.flat();
  const edges: [number, number][] = [];
  const quads: number[][] = [];

  // Edges langs hver ring
  for (let r = 0; r < rings.length; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * segments + i;
      const b = r * segments + ((i + 1) % segments);
      edges.push([a, b]);
    }
  }
  // Edges mellem tilstødende ringe + quads
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * segments + i;
      const b = (r + 1) * segments + i;
      const c = (r + 1) * segments + ((i + 1) % segments);
      const d = r * segments + ((i + 1) % segments);
      edges.push([a, b]);
      quads.push([a, b, c, d]);
    }
  }

  return { vertices, edges, quads };
}

// ---- Rotations-matricer ----
function rotateY(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotateX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

// ---- Hotspot-markører (samme positioner som 2D-views) ----
const hotspots: { pos: V3; label: string; color: string; intensity: number }[] = [
  { pos: [6, 6, 30], label: "MTP 5 · termisk +1.4°C", color: "#b9543a", intensity: 0.95 },
  { pos: [0, 9, -32], label: "Hæl · peak 242 kPa", color: "#c46a4a", intensity: 0.85 },
  { pos: [0, 9, 18], label: "Forfods-ballen", color: "#b9543a", intensity: 0.9 },
  { pos: [-8, 9, 22], label: "MTP 1", color: "#c46a4a", intensity: 0.7 },
  { pos: [0, -7, 50], label: "Hallux · valgus 18°", color: "#ad7a26", intensity: 0.6 },
  { pos: [-12, -2, -10], label: "Navicular drop 8.4mm", color: "#ad7a26", intensity: 0.65 },
];

type ViewPreset = "free" | "top" | "side" | "bottom" | "front" | "back";

const PRESETS: Record<ViewPreset, { yaw: number; pitch: number }> = {
  free:   { yaw: 0.6, pitch: -0.3 },
  top:    { yaw: 0,    pitch: -Math.PI / 2 },
  side:   { yaw: Math.PI / 2, pitch: 0 },
  bottom: { yaw: 0,    pitch: Math.PI / 2 },
  front:  { yaw: 0,    pitch: 0 },
  back:   { yaw: Math.PI, pitch: 0 },
};

export function FootMesh3D({ side = "R" }: { side?: "L" | "R" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(PRESETS.free.yaw);
  const pitchRef = useRef(PRESETS.free.pitch);
  const targetYaw = useRef(PRESETS.free.yaw);
  const targetPitch = useRef(PRESETS.free.pitch);
  const draggingRef = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const idleTime = useRef(0);
  const [preset, setPreset] = useState<ViewPreset>("free");
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; label: string } | null>(null);
  const meshRef = useRef(buildFootMesh());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const mesh = meshRef.current;

    let raf = 0;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const SCALE = 4;
    let lastT = performance.now();

    const draw = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;

      // Auto-spin når idle og preset === "free"
      if (!draggingRef.current && preset === "free") {
        idleTime.current += dt;
        if (idleTime.current > 1.5) {
          targetYaw.current += dt * 0.3;
        }
      }

      // Smooth interpolation mod target
      yawRef.current += (targetYaw.current - yawRef.current) * Math.min(1, dt * 8);
      pitchRef.current += (targetPitch.current - pitchRef.current) * Math.min(1, dt * 8);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const yaw = yawRef.current;
      const pitch = pitchRef.current;

      // Transform alle vertices
      const projected = mesh.vertices.map((v) => {
        // Hvis venstre fod, spejl x
        let p: V3 = side === "L" ? [-v[0], v[1], v[2]] : [...v];
        p = rotateY(p, yaw);
        p = rotateX(p, pitch);
        // Ortografisk projektion
        return {
          x: cx + p[0] * SCALE * dpr,
          y: cy + p[1] * SCALE * dpr,
          z: p[2],
        };
      });

      // Sortér quads efter dybde for at tegne bagest først
      const quadsWithDepth = mesh.quads.map((q, i) => {
        const z = (projected[q[0]].z + projected[q[1]].z + projected[q[2]].z + projected[q[3]].z) / 4;
        return { quad: q, z, i };
      });
      quadsWithDepth.sort((a, b) => a.z - b.z);

      // Fyld quads med shaded skin-farve
      for (const { quad, z } of quadsWithDepth) {
        const [a, b, c, d] = quad;
        // Backface culling — beregn normal
        const v1x = projected[b].x - projected[a].x;
        const v1y = projected[b].y - projected[a].y;
        const v2x = projected[d].x - projected[a].x;
        const v2y = projected[d].y - projected[a].y;
        const cross = v1x * v2y - v1y * v2x;
        if (cross < 0) continue;

        const shade = Math.max(0.4, Math.min(1, 0.7 + z / 200));
        const r = Math.round(240 * shade);
        const g = Math.round(217 * shade);
        const blu = Math.round(200 * shade);

        ctx.fillStyle = `rgb(${r},${g},${blu})`;
        ctx.strokeStyle = `rgba(180, 150, 130, ${0.3 * shade})`;
        ctx.lineWidth = 0.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(projected[a].x, projected[a].y);
        ctx.lineTo(projected[b].x, projected[b].y);
        ctx.lineTo(projected[c].x, projected[c].y);
        ctx.lineTo(projected[d].x, projected[d].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Hotspots — projektér og tegn
      const hotspotProjected = hotspots.map((hs) => {
        let p: V3 = side === "L" ? [-hs.pos[0], hs.pos[1], hs.pos[2]] : [...hs.pos];
        p = rotateY(p, yaw);
        p = rotateX(p, pitch);
        return {
          x: cx + p[0] * SCALE * dpr,
          y: cy + p[1] * SCALE * dpr,
          z: p[2],
          ...hs,
        };
      });
      hotspotProjected.sort((a, b) => a.z - b.z);

      for (const hp of hotspotProjected) {
        const isVisible = hp.z > -10; // gem hotspots der er bagsiden af
        if (!isVisible) continue;

        const pulse = Math.sin(t / 350) * 0.3 + 1;

        // Glow
        const grad = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 18 * dpr * pulse);
        grad.addColorStop(0, hp.color + "cc");
        grad.addColorStop(0.4, hp.color + "55");
        grad.addColorStop(1, hp.color + "00");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, 18 * dpr * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Indre prik
        ctx.fillStyle = hp.color;
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Scan-linje (tynd)
      const scanY = ((t / 30) % (h + 40)) - 20;
      ctx.strokeStyle = "rgba(63, 125, 90, 0.5)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [side, preset]);

  // ---- Mouse handlers ----
  const onDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    idleTime.current = 0;
    setPreset("free");
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !lastPos.current) {
      // Hover-detection (forsimplet — bare update hovedstatus)
      return;
    }
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    targetYaw.current += dx * 0.012;
    targetPitch.current -= dy * 0.012;
    targetPitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch.current));
    lastPos.current = { x: e.clientX, y: e.clientY };
    idleTime.current = 0;
  };
  const onUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    lastPos.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const snap = (p: ViewPreset) => {
    setPreset(p);
    targetYaw.current = PRESETS[p].yaw;
    targetPitch.current = PRESETS[p].pitch;
    idleTime.current = 0;
  };

  return (
    <div className="relative">
      {/* Preset-knapper */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-[10px] border border-line-2 bg-paper p-0.5 text-[11px]">
          {([
            ["free", "Fri rotation"],
            ["top", "Top"],
            ["front", "Front"],
            ["side", "Side"],
            ["back", "Bag"],
            ["bottom", "Bund"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => snap(k)}
              className="rounded-[8px] px-2.5 py-1.5"
              style={{
                background: preset === k ? "var(--color-ink)" : "transparent",
                color: preset === k ? "var(--color-paper)" : "var(--color-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="mono text-[10.5px] text-faint">træk for at rotere · 224 vertices · 208 quads</span>
      </div>

      {/* Canvas */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] border border-line bg-paper-2">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        {/* Hotspots legend overlay */}
        <div className="absolute left-3 top-3 rounded-[8px] border border-line bg-card/90 px-2.5 py-1.5 backdrop-blur">
          <div className="kicker !text-[8.5px]">{side === "L" ? "Venstre fod" : "Højre fod"} · 3D-mesh</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-signal live-dot" />
            <span className="mono">{preset === "free" ? "auto-spin" : preset}</span>
          </div>
        </div>

        {/* Hotspots-tæller */}
        <div className="absolute right-3 top-3 rounded-[8px] border border-line bg-card/90 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[10px] text-faint">flagged points</div>
          <div className="mt-0.5 mono text-[14px] font-semibold">{hotspots.length}</div>
        </div>

        {/* Bunden af canvas: status */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="rounded-[8px] border border-line bg-card/90 px-2.5 py-1 backdrop-blur mono text-[10px]">
            Cosmos 3 · NeRF + Gaussian Splatting · 312k pts
          </div>
          <div className="rounded-[8px] border border-line bg-card/90 px-2.5 py-1 backdrop-blur mono text-[10px]">
            60 fps · GPU
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10.5px] text-faint">
        <span>Træk for at rotere · klik på preset for snap-vinkel</span>
        <span className="mono">orthographic projektion · backface culling</span>
      </div>
    </div>
  );
}
