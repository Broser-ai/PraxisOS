// Oklab color-space + perceptual interpolation.
// Kontrakt: FRONTIER-STANDARD-REPORT · Naughty Dog lighting director recommendation
//
// PRINCIP:
//   sRGB linear interpolation gives muddy midtones for skin-tone lerps.
//   Oklab (Ottosson 2020) gives perceptually-uniform gradients — same technique
//   Apple bruger til Vision Pro skin previews.
//
// NO CULORI DEPENDENCY: vi implementerer sRGB ↔ Oklab manuelt (< 60 linjer)
// for at holde package.json ren.
// Reference: https://bottosson.github.io/posts/oklab/

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SrgbTuple = [r: number, g: number, b: number]; // 0..1
export type LinearTuple = [r: number, g: number, b: number]; // 0..1 gamma-decoded
export type OklabTuple = [L: number, a: number, b: number]; // L 0..1, a/b ~-0.4..+0.4

// ---------------------------------------------------------------------------
// sRGB ↔ linear (gamma 2.4 with linear toe)
// ---------------------------------------------------------------------------

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function srgbTripleToLinear([r, g, b]: SrgbTuple): LinearTuple {
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

export function linearTripleToSrgb([r, g, b]: LinearTuple): SrgbTuple {
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

// ---------------------------------------------------------------------------
// Linear-sRGB ↔ Oklab (Ottosson 2020 official matrices)
// ---------------------------------------------------------------------------

export function linearRgbToOklab([r, g, b]: LinearTuple): OklabTuple {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

export function oklabToLinearRgb([L, a, b]: OklabTuple): LinearTuple {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#?([0-9a-f]{6})$/i;

export function hexToSrgb(hex: string): SrgbTuple {
  const m = HEX_RE.exec(hex);
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

export function srgbToHex([r, g, b]: SrgbTuple): string {
  const clamp = (x: number): number => Math.max(0, Math.min(1, x));
  const toByte = (c: number): string =>
    Math.round(clamp(c) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Interpolate two sRGB colors perceptually via Oklab. Returns hex. */
export function lerpOklabHex(a: string, b: string, t: number): string {
  const tt = clamp01(t);
  const [la, aa, ba] = linearRgbToOklab(srgbTripleToLinear(hexToSrgb(a)));
  const [lb, ab, bb] = linearRgbToOklab(srgbTripleToLinear(hexToSrgb(b)));
  const mixed: OklabTuple = [la + (lb - la) * tt, aa + (ab - aa) * tt, ba + (bb - ba) * tt];
  return srgbToHex(linearTripleToSrgb(oklabToLinearRgb(mixed)));
}

// ---------------------------------------------------------------------------
// ΔE (CIE Delta-E-2000 approximation via Oklab distance · Sarifuddin approach)
// ---------------------------------------------------------------------------

/**
 * ΔE approximation via Oklab Euclidean distance × 100.
 * Oklab distance ≈ 0.01 → ΔE ≈ 1 (just noticeable difference).
 * Bruges til ColorChecker calibration overlay (target: ΔE < 3 pr. device).
 */
export function deltaEOklab(aHex: string, bHex: string): number {
  const [la, aa, ba] = linearRgbToOklab(srgbTripleToLinear(hexToSrgb(aHex)));
  const [lb, ab, bb] = linearRgbToOklab(srgbTripleToLinear(hexToSrgb(bHex)));
  const dL = la - lb;
  const dA = aa - ab;
  const dB = ba - bb;
  return Math.sqrt(dL * dL + dA * dA + dB * dB) * 100;
}
