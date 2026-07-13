// PraxisOS · Neural Configurator material presets
//
// Modular MeshPhysicalMaterial presets loaded as data, not inlined into the
// React component. Add or edit a preset here and it appears automatically in
// the MaterialSelector grid in NeuralConfigurator.tsx.
//
// Only MeshPhysicalMaterial-supported scalar properties are exposed — no
// custom shaders. All values are within Three.js's documented ranges so a
// preset can be passed directly into <meshPhysicalMaterial /> or mutated
// onto an existing THREE.MeshPhysicalMaterial instance.
//
// Grafted from: THREEKIT (variant 1) — externalized preset module.

export type MaterialPreset = {
  id: string;
  label: string;
  description: string;
  color: string;               // base color, hex
  roughness: number;           // 0..1
  metalness: number;           // 0..1
  clearcoat: number;           // 0..1
  clearcoatRoughness: number;  // 0..1
  emissive?: string;           // hex; defaults to black when absent
  emissiveIntensity?: number;  // 0..∞, defaults to 0
  transmission?: number;       // 0..1, defaults to 0
  ior?: number;                // index of refraction, defaults to 1.5
};

export const MATERIAL_PRESETS: MaterialPreset[] = [
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

export const DEFAULT_SKIN_PRESET_ID = "skin-native";
export const DEFAULT_ORTHOTIC_PRESET_ID = "orthotic-eva";

/** Lookup by id with a safe fallback to the skin default. */
export function getPresetById(id: string | undefined): MaterialPreset {
  if (id) {
    const hit = MATERIAL_PRESETS.find((m) => m.id === id);
    if (hit) return hit;
  }
  return MATERIAL_PRESETS.find((m) => m.id === DEFAULT_SKIN_PRESET_ID) ?? MATERIAL_PRESETS[0]!;
}
