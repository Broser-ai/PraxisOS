"use client";

// PraxisOS · NeuralConfigurator (EPIC 3)
//
// Split-screen 3D-viewer + parameter-panel med Gaussian Splatting-inspirerede
// materiale-presets (Porcelain / Liquid Metal / Skin-native / Orthotic-EVA).
// Bruger react-three-fiber + drei — undgår CustomShaderMaterial.
//
// Kaldes typisk fra /admin/scan/[id]/configurator med scanId + initial params.

import * as React from "react";
import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  ContactShadows,
  Bounds,
  Html,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import type { OrthoticParams } from "@/lib/configurator/schema";
import { defaultParams } from "@/lib/configurator/orthotic-generator";

// ---------------------------------------------------------------------------
// Material presets (Gaussian Splatting inspiration)
// ---------------------------------------------------------------------------

type MaterialPreset = {
  id: string;
  label: string;
  description: string;
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  emissive?: string;
  emissiveIntensity?: number;
  transmission?: number;
  ior?: number;
};

const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: "porcelain",
    label: "Porcelæn",
    description: "Blød hvid keramik · høj clearcoat, lav metalness — klinisk look",
    color: "#f2ede4",
    roughness: 0.15,
    metalness: 0.02,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    ior: 1.55,
  },
  {
    id: "liquid-metal",
    label: "Liquid Metal",
    description: "Reflekterende quicksølv · fuld metalness — bruges til CAD-preview",
    color: "#c8ccd6",
    roughness: 0.12,
    metalness: 1.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  },
  {
    id: "skin-native",
    label: "Hud (native)",
    description: "Biofysisk skin-inversion approx · subsurface-inspireret warm hue",
    color: "#e8b898",
    roughness: 0.65,
    metalness: 0.02,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
    transmission: 0.08,
    ior: 1.4,
  },
  {
    id: "orthotic-eva",
    label: "Orthotic EVA",
    description: "Sålsindlægs-materiale · mid Shore-A hårdhed, mat overflade",
    color: "#3a3f4a",
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.9,
    emissive: "#3a5a7a",
    emissiveIntensity: 0.05,
  },
];

// ---------------------------------------------------------------------------
// Konfigurator-panel
// ---------------------------------------------------------------------------

export type NeuralConfiguratorProps = {
  scanId?: string;
  meshUrl?: string;
  initialParams?: OrthoticParams;
  onSave?: (params: OrthoticParams) => void | Promise<void>;
};

export function NeuralConfigurator(
  props: NeuralConfiguratorProps,
): React.ReactElement {
  const [footMaterial, setFootMaterial] = useState<MaterialPreset>(MATERIAL_PRESETS[2]!);
  const [orthoticMaterial, setOrthoticMaterial] = useState<MaterialPreset>(MATERIAL_PRESETS[3]!);
  const [inversionMix, setInversionMix] = useState(0.35);
  const [params, setParams] = useState<OrthoticParams>(
    props.initialParams ?? defaultParams(),
  );
  const [saving, setSaving] = useState(false);

  return (
    <div className="w-full h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-0 bg-neutral-950 text-neutral-100 rounded-xl overflow-hidden border border-neutral-800">
      {/* 3D split-screen viewer */}
      <div className="relative h-[560px] lg:h-auto">
        <Canvas
          camera={{ position: [0, 0.3, 1.9], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={<CanvasLoader />}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[3, 4, 2]} intensity={1.2} color={"#fff2e0"} />
            <directionalLight position={[-3, 2, -1]} intensity={0.5} color={"#8bb0ff"} />
            <Environment preset="sunset" />
            <Bounds fit clip observe margin={1.15}>
              <SplitScreenModel
                meshUrl={props.meshUrl}
                skin={footMaterial}
                orthotic={orthoticMaterial}
                mix={inversionMix}
                params={params}
              />
            </Bounds>
            <ContactShadows
              position={[0, -0.35, 0]}
              opacity={0.55}
              scale={4}
              blur={2.5}
              far={2}
            />
            <OrbitControls
              enablePan={false}
              enableDamping
              dampingFactor={0.08}
              minDistance={0.7}
              maxDistance={3.6}
            />
          </Suspense>
        </Canvas>

        {/* Overlay: split-line label */}
        <div className="absolute top-4 left-4 flex gap-2 text-[10px] uppercase tracking-widest">
          <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur border border-white/10">
            Biofysisk hud
          </span>
          <span className="px-2 py-1 rounded-full bg-neutral-800/70 backdrop-blur border border-neutral-700">
            Orthotic overlay
          </span>
        </div>

        {/* Overlay: Inversion-slider */}
        <div className="absolute bottom-4 left-4 right-4 max-w-md bg-black/45 backdrop-blur border border-white/10 rounded-lg p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-neutral-300 mb-1">
            <span>Skin ↔ Orthotic overgang</span>
            <span className="tabular-nums">{Math.round(inversionMix * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={inversionMix}
            onChange={(e) => setInversionMix(parseFloat(e.target.value))}
            className="w-full accent-emerald-400"
          />
        </div>
      </div>

      {/* Parameter-panel */}
      <div className="p-4 lg:p-5 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-950 overflow-y-auto max-h-[560px] lg:max-h-none">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-1">
          Neural Configurator
        </h2>
        <p className="text-xs text-neutral-500 mb-4">
          {props.scanId ? `Scan #${props.scanId}` : "Ingen scan valgt"}
        </p>

        <MaterialSelector
          label="Hud-materiale"
          value={footMaterial}
          onChange={setFootMaterial}
        />
        <MaterialSelector
          label="Orthotic-materiale"
          value={orthoticMaterial}
          onChange={setOrthoticMaterial}
        />

        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Parametre (16)
          </h3>
          {PARAM_SLIDERS.map(({ key, min, max, step, label, unit }) => (
            <ParamSlider
              key={key as string}
              label={label}
              unit={unit}
              value={params[key] as number}
              min={min}
              max={max}
              step={step}
              onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
            />
          ))}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await props.onSave?.(params);
            } finally {
              setSaving(false);
            }
          }}
          className="mt-6 w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-semibold py-2 text-sm transition"
        >
          {saving ? "Gemmer…" : "Gem konfiguration"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delekomponenter
// ---------------------------------------------------------------------------

function MaterialSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MaterialPreset;
  onChange: (m: MaterialPreset) => void;
}): React.ReactElement {
  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {MATERIAL_PRESETS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m)}
            className={
              "text-left rounded-md border px-2.5 py-2 transition text-[11px] " +
              (value.id === m.id
                ? "border-emerald-400 bg-emerald-400/10 text-emerald-100"
                : "border-neutral-800 hover:border-neutral-600 text-neutral-300")
            }
            title={m.description}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: m.color }}
              />
              <span className="font-medium">{m.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

type ParamKey = keyof OrthoticParams;

const PARAM_SLIDERS: Array<{
  key: ParamKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "heel_cup_depth_mm", label: "Hælkop-dybde", unit: "mm", min: 10, max: 35, step: 0.5 },
  { key: "arch_support_height_mm", label: "Buestøtte", unit: "mm", min: 5, max: 30, step: 0.5 },
  { key: "metatarsal_pad_offset_mm", label: "Metatarsal-offset", unit: "mm", min: -10, max: 15, step: 0.5 },
  { key: "medial_flare_deg", label: "Medial flare", unit: "°", min: 0, max: 12, step: 0.5 },
  { key: "lateral_flare_deg", label: "Lateral flare", unit: "°", min: 0, max: 12, step: 0.5 },
  { key: "forefoot_thickness_mm", label: "Forfod-tykkelse", unit: "mm", min: 2, max: 8, step: 0.25 },
  { key: "heel_thickness_mm", label: "Hæltykkelse", unit: "mm", min: 4, max: 15, step: 0.5 },
  { key: "shore_a_forefoot", label: "Shore-A forfod", unit: "", min: 20, max: 55, step: 1 },
  { key: "shore_a_heel", label: "Shore-A hæl", unit: "", min: 40, max: 75, step: 1 },
  { key: "posting_medial_deg", label: "Posting medialt", unit: "°", min: 0, max: 8, step: 0.5 },
  { key: "posting_lateral_deg", label: "Posting lateralt", unit: "°", min: 0, max: 8, step: 0.5 },
  { key: "hallux_relief_mm", label: "Hallux relief", unit: "mm", min: 0, max: 5, step: 0.25 },
  { key: "plantar_recess_zones", label: "Plantar recess", unit: "zoner", min: 0, max: 4, step: 1 },
  { key: "toe_break_position_pct", label: "Toe-break", unit: "%", min: 60, max: 75, step: 0.5 },
  { key: "first_ray_cutout_mm", label: "1. stråle cutout", unit: "mm", min: 0, max: 8, step: 0.5 },
  { key: "pronation_correction_deg", label: "Pronation-korrektion", unit: "°", min: -6, max: 6, step: 0.5 },
];

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-neutral-400">{label}</span>
        <span className="tabular-nums text-neutral-200">
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-400"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3D scene · Split-screen biofysical inversion
// ---------------------------------------------------------------------------

function SplitScreenModel({
  meshUrl,
  skin,
  orthotic,
  mix,
  params,
}: {
  meshUrl?: string;
  skin: MaterialPreset;
  orthotic: MaterialPreset;
  mix: number;
  params: OrthoticParams;
}): React.ReactElement {
  if (meshUrl && meshUrl.toLowerCase().endsWith(".glb")) {
    return <GlbSplit url={meshUrl} skin={skin} orthotic={orthotic} mix={mix} />;
  }
  return <ProceduralSplit skin={skin} orthotic={orthotic} mix={mix} params={params} />;
}

function GlbSplit({
  url,
  skin,
  orthotic,
  mix,
}: {
  url: string;
  skin: MaterialPreset;
  orthotic: MaterialPreset;
  mix: number;
}): React.ReactElement {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);
  // Apply materials med interpolation
  useMemo(() => {
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: lerpColor(skin.color, orthotic.color, mix),
          roughness: skin.roughness * (1 - mix) + orthotic.roughness * mix,
          metalness: skin.metalness * (1 - mix) + orthotic.metalness * mix,
          clearcoat: skin.clearcoat * (1 - mix) + orthotic.clearcoat * mix,
          clearcoatRoughness:
            skin.clearcoatRoughness * (1 - mix) + orthotic.clearcoatRoughness * mix,
        });
        m.material = mat;
      }
    });
  }, [cloned, skin, orthotic, mix]);
  return <primitive object={cloned} />;
}

function ProceduralSplit({
  skin,
  orthotic,
  mix,
  params,
}: {
  skin: MaterialPreset;
  orthotic: MaterialPreset;
  mix: number;
  params: OrthoticParams;
}): React.ReactElement {
  const heelDepth = params.heel_cup_depth_mm / 35;
  const archHeight = params.arch_support_height_mm / 30;
  const orthoticHeight = 0.05 + archHeight * 0.15;

  return (
    <group>
      {/* Foot form (skin material) */}
      <group position={[0, orthoticHeight * 0.5, 0]}>
        <mesh position={[0, 0, 0.05]}>
          <sphereGeometry args={[0.5, 48, 32]} />
          <PhysicalMat mat={skin} />
        </mesh>
        <mesh position={[0, -0.1, -0.35]}>
          <sphereGeometry args={[0.28, 32, 24]} />
          <PhysicalMat mat={skin} />
        </mesh>
        <mesh position={[0, -0.05, 0.4]}>
          <boxGeometry args={[0.55, 0.22, 0.35]} />
          <PhysicalMat mat={skin} />
        </mesh>
      </group>

      {/* Orthotic insole (interpolated material) */}
      <group position={[0, -0.35, 0]}>
        <mesh>
          <boxGeometry args={[0.8, orthoticHeight, 1.4]} />
          <meshPhysicalMaterial
            color={lerpColor(skin.color, orthotic.color, Math.min(1, mix + 0.5))}
            roughness={orthotic.roughness}
            metalness={orthotic.metalness}
            clearcoat={orthotic.clearcoat}
            clearcoatRoughness={orthotic.clearcoatRoughness}
          />
        </mesh>
        {/* Arch support bump */}
        <mesh position={[0, orthoticHeight * 0.5, 0.05]}>
          <sphereGeometry args={[0.16 + archHeight * 0.08, 24, 16]} />
          <meshPhysicalMaterial
            color={orthotic.color}
            roughness={orthotic.roughness}
            metalness={orthotic.metalness}
            clearcoat={orthotic.clearcoat}
          />
        </mesh>
        {/* Heel cup */}
        <mesh position={[0, orthoticHeight * 0.5, -0.5]}>
          <cylinderGeometry args={[0.22, 0.28, orthoticHeight + heelDepth * 0.08, 24, 1, false]} />
          <meshPhysicalMaterial
            color={orthotic.color}
            roughness={orthotic.roughness + 0.05}
            metalness={orthotic.metalness}
          />
        </mesh>
      </group>
    </group>
  );
}

function PhysicalMat({ mat }: { mat: MaterialPreset }): React.ReactElement {
  return (
    <meshPhysicalMaterial
      color={mat.color}
      roughness={mat.roughness}
      metalness={mat.metalness}
      clearcoat={mat.clearcoat}
      clearcoatRoughness={mat.clearcoatRoughness}
      emissive={mat.emissive ?? "#000000"}
      emissiveIntensity={mat.emissiveIntensity ?? 0}
    />
  );
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  const out = ca.clone().lerp(cb, Math.max(0, Math.min(1, t)));
  return `#${out.getHexString()}`;
}

function CanvasLoader(): React.ReactElement {
  return (
    <Html center>
      <div className="text-xs text-neutral-500 font-mono">Loading mesh…</div>
    </Html>
  );
}

export default NeuralConfigurator;
