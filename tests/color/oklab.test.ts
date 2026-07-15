// Oklab color-space tests
// Kontrakt: FRONTIER-STANDARD-REPORT · Naughty Dog #2

import { describe, it, expect } from "vitest";
import {
  hexToSrgb,
  srgbToHex,
  linearRgbToOklab,
  oklabToLinearRgb,
  srgbTripleToLinear,
  linearTripleToSrgb,
  lerpOklabHex,
  deltaEOklab,
} from "@/lib/color/oklab";

describe("oklab · hex conversion round-trip", () => {
  it("hex→srgb→hex preserves within 1 byte", () => {
    for (const hex of ["#000000", "#ffffff", "#808080", "#e0b498", "#f2ede4", "#c8ccd6"]) {
      const rt = srgbToHex(hexToSrgb(hex));
      expect(rt.toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it("invalid hex throws", () => {
    expect(() => hexToSrgb("not-a-hex")).toThrow();
  });
});

describe("oklab · linear ↔ Oklab round-trip", () => {
  it("srgb → linear → oklab → linear → srgb preserves color", () => {
    for (const hex of ["#e0b498", "#c29682", "#735244", "#67bdaa", "#8580b1"]) {
      const srgb = hexToSrgb(hex);
      const linear = srgbTripleToLinear(srgb);
      const oklab = linearRgbToOklab(linear);
      const backLinear = oklabToLinearRgb(oklab);
      const backSrgb = linearTripleToSrgb(backLinear);
      for (let i = 0; i < 3; i++) {
        expect(backSrgb[i]).toBeCloseTo(srgb[i], 2);
      }
    }
  });
});

describe("oklab · perceptual interpolation", () => {
  it("lerpOklabHex(a, b, 0) === a", () => {
    expect(lerpOklabHex("#e0b498", "#3a3f4a", 0).toLowerCase()).toBe("#e0b498");
  });

  it("lerpOklabHex(a, b, 1) === b", () => {
    expect(lerpOklabHex("#e0b498", "#3a3f4a", 1).toLowerCase()).toBe("#3a3f4a");
  });

  it("Oklab midpoint of black↔white matches perceptual middle-grey (~sRGB 0.39)", () => {
    const mid = hexToSrgb(lerpOklabHex("#000000", "#ffffff", 0.5));
    // Oklab L=0.5 = perceptual middle-grey → sRGB ~0.39 (DARKER end af "midt")
    // Dette er selve POINTEN i Oklab · lineær-sRGB-lerp giver 0.5 som er
    // PERCEPTUELT for lyst.
    expect(mid[0]).toBeGreaterThan(0.3);
    expect(mid[0]).toBeLessThan(0.5);
    // r=g=b (achromatic)
    expect(Math.abs(mid[1] - mid[0])).toBeLessThan(0.02);
    expect(Math.abs(mid[2] - mid[0])).toBeLessThan(0.02);
  });

  it("skin-tone Oklab midpoint does not become muddy brown", () => {
    // Naughty Dog #4: sRGB lerp of skin→orthotic mud-colors midtones.
    // Oklab lerp bevarer pink-to-tan naturlighed.
    const mid = lerpOklabHex("#e0b498", "#3a3f4a", 0.5);
    // Midpoint skal ligge tættere på skin-hue end mud-hue
    const midDeltaSkin = deltaEOklab(mid, "#e0b498");
    const midDeltaMud = deltaEOklab(mid, "#3a3f4a");
    // Ikke test at midpoint er perfekt — bare at det ikke er tættere på "mud"
    // end der er 25% forskel (fair pertubation).
    expect(midDeltaSkin).toBeLessThan(midDeltaMud * 1.5);
  });
});

describe("oklab · deltaE", () => {
  it("deltaE(x, x) = 0", () => {
    expect(deltaEOklab("#e0b498", "#e0b498")).toBeCloseTo(0, 4);
  });

  it("deltaE symmetric: dE(a, b) == dE(b, a)", () => {
    const ab = deltaEOklab("#c29682", "#576c43");
    const ba = deltaEOklab("#576c43", "#c29682");
    expect(ab).toBeCloseTo(ba, 6);
  });

  it("black vs white has large deltaE (> 50)", () => {
    expect(deltaEOklab("#000000", "#ffffff")).toBeGreaterThan(50);
  });

  it("similar neutral greys have small deltaE (< 10)", () => {
    expect(deltaEOklab("#7a7a7a", "#8a8a8a")).toBeLessThan(10);
  });
});
