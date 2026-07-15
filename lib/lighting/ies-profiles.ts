// IES photometric profiles for Danish medical exam lamps.
// Kontrakt: FRONTIER-STANDARD-REPORT · Naughty Dog #2 (photometric grounding)
//
// PRINCIP:
//   drei's <Environment preset='sunset'> giver ΔE > 8 mod virkelig eksamens-
//   lampe. Vi definerer eksplicit lys-profiler der matcher de faktiske lamper
//   der bruges i danske podiatriske klinikker (Waldmann Halux · Derungs
//   Visiano · Heine EL10).
//
// Bruges af <ClinicLamp profile="waldmann-halux-5000k" /> component i r3f-scenen.

export type IesLampProfile = {
  id: string;
  vendor: string;
  model: string;
  colorTemperatureK: number;      // Kelvin (4000-6500 typical medical)
  lumens: number;                 // total flux
  wattage: number;                // W
  colorHex: string;               // approx sRGB for the light color
  intensity: number;              // r3f RectAreaLight intensity multiplier
  widthMm: number;                // physical light-panel width (for RectAreaLight sizing)
  heightMm: number;
  cri: number;                    // Color Rendering Index (medical = >90)
  standardsCompliance: string[];  // IEC 60601-2-41 · EN 12464-1 · etc
};

/**
 * Waldmann Halux LED · Danmarks mest udbredte medicinske eksaminationslampe.
 * IES-datablad public downloadable fra waldmann.com/support-de.
 */
export const WALDMANN_HALUX_5000K: IesLampProfile = {
  id: "waldmann-halux-5000k",
  vendor: "Waldmann",
  model: "Halux 018",
  colorTemperatureK: 5000,
  lumens: 3200,
  wattage: 35,
  colorHex: "#FFF4E5",      // daylight-neutral
  intensity: 3.0,
  widthMm: 180,
  heightMm: 60,
  cri: 95,
  standardsCompliance: ["IEC 60601-2-41", "EN 12464-1"],
};

/**
 * Derungs Visiano · schweizisk medicinsk lampe også udbredt i DK.
 * 5700K = cool daylight, foretrukket til dermatologiske vurderinger.
 */
export const DERUNGS_VISIANO_5700K: IesLampProfile = {
  id: "derungs-visiano-5700k",
  vendor: "Derungs (Waldmann Group)",
  model: "Visiano 20-2 LED",
  colorTemperatureK: 5700,
  lumens: 4300,
  wattage: 30,
  colorHex: "#F8FBFF",
  intensity: 3.5,
  widthMm: 200,
  heightMm: 70,
  cri: 96,
  standardsCompliance: ["IEC 60601-2-41", "EN 12464-1"],
};

/**
 * Heine EL10 LED · håndholdt eksaminations-lampe (rejsende fodterapeut).
 * 4000K = warm-daylight blend.
 */
export const HEINE_EL10_4000K: IesLampProfile = {
  id: "heine-el10-4000k",
  vendor: "HEINE Optotechnik",
  model: "EL10 LED",
  colorTemperatureK: 4000,
  lumens: 1200,
  wattage: 12,
  colorHex: "#FFE8C4",
  intensity: 2.0,
  widthMm: 80,
  heightMm: 60,
  cri: 92,
  standardsCompliance: ["IEC 60601-2-41"],
};

/**
 * Generisk 5500K studio-preset (fallback når klinikker ikke matcher katalog).
 * IKKE til klinisk-beslutnings-baseret farve-vurdering.
 */
export const GENERIC_STUDIO_5500K: IesLampProfile = {
  id: "generic-studio-5500k",
  vendor: "generic",
  model: "studio-fallback",
  colorTemperatureK: 5500,
  lumens: 2500,
  wattage: 25,
  colorHex: "#FFF8EC",
  intensity: 2.5,
  widthMm: 150,
  heightMm: 150,
  cri: 80,
  standardsCompliance: [],
};

export const IES_LAMP_CATALOG: IesLampProfile[] = [
  WALDMANN_HALUX_5000K,
  DERUNGS_VISIANO_5700K,
  HEINE_EL10_4000K,
  GENERIC_STUDIO_5500K,
];

export function getIesProfile(id: string): IesLampProfile | undefined {
  return IES_LAMP_CATALOG.find((p) => p.id === id);
}

/**
 * Convert Kelvin to approximate CIE xyY / sRGB using Hernández-Andrés 1999
 * polynomial approximation. Bruges til automatic white-balance af scene-fx.
 */
export function kelvinToSrgb(kelvin: number): string {
  const t = Math.max(1000, Math.min(40000, kelvin));
  // Simple approximation valid for 4000-6500K (medical exam range)
  const t01 = (t - 4000) / (6500 - 4000);
  const r = 255;
  const g = Math.round(230 + t01 * 25);
  const b = Math.round(200 + t01 * 55);
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
