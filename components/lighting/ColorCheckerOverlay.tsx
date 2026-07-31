"use client";

// ColorCheckerOverlay · X-Rite ColorChecker Classic 24-patch overlay.
// Kontrakt: FRONTIER-STANDARD-REPORT §Naughty-Dog #2 (ΔE < 3 calibration)
//
// Bruges første gang PraxisOS åbnes på et device. Praktiker sammenligner
// på-skærm patches med et fysisk kort (X-Rite / Calibrite Classic) og godkender
// devicen når ΔE < 3.

import * as React from "react";
import { deltaEOklab } from "@/lib/color/oklab";

// X-Rite ColorChecker Classic 24-patch reference values (sRGB · D50).
// Kilde: publiceret data-sheet 2014 revision.
const COLORCHECKER_24: Array<{ id: number; name: string; hex: string }> = [
  { id: 1, name: "Dark skin", hex: "#735244" },
  { id: 2, name: "Light skin", hex: "#c29682" },
  { id: 3, name: "Blue sky", hex: "#627a9d" },
  { id: 4, name: "Foliage", hex: "#576c43" },
  { id: 5, name: "Blue flower", hex: "#8580b1" },
  { id: 6, name: "Bluish green", hex: "#67bdaa" },
  { id: 7, name: "Orange", hex: "#d67e2c" },
  { id: 8, name: "Purplish blue", hex: "#505ba6" },
  { id: 9, name: "Moderate red", hex: "#c15a63" },
  { id: 10, name: "Purple", hex: "#5e3c6c" },
  { id: 11, name: "Yellow green", hex: "#9dbc40" },
  { id: 12, name: "Orange yellow", hex: "#e0a32e" },
  { id: 13, name: "Blue", hex: "#383d96" },
  { id: 14, name: "Green", hex: "#469449" },
  { id: 15, name: "Red", hex: "#af363c" },
  { id: 16, name: "Yellow", hex: "#e7c71f" },
  { id: 17, name: "Magenta", hex: "#bb5695" },
  { id: 18, name: "Cyan", hex: "#0885a1" },
  { id: 19, name: "White (.05*)", hex: "#f3f3f2" },
  { id: 20, name: "Neutral 8", hex: "#c8c8c8" },
  { id: 21, name: "Neutral 6.5", hex: "#a0a0a0" },
  { id: 22, name: "Neutral 5", hex: "#7a7a7a" },
  { id: 23, name: "Neutral 3.5", hex: "#555555" },
  { id: 24, name: "Black (.20*)", hex: "#343434" },
];

export type ColorCheckerOverlayProps = {
  /** Optional measured on-screen hex values matched against ideal. */
  measured?: Record<number, string>;
  /** Called when practitioner clicks accept — providing worst ΔE seen. */
  onAcceptCalibration?: (worstDeltaE: number) => void;
};

export function ColorCheckerOverlay(props: ColorCheckerOverlayProps): React.ReactElement {
  const deltas = React.useMemo(() => {
    if (!props.measured) return null;
    return COLORCHECKER_24.map((patch) => {
      const measured = props.measured?.[patch.id];
      if (!measured) return { ...patch, deltaE: null };
      return { ...patch, deltaE: +deltaEOklab(patch.hex, measured).toFixed(2) };
    });
  }, [props.measured]);

  const worstDeltaE = React.useMemo(() => {
    if (!deltas) return null;
    return deltas
      .map((d) => d.deltaE ?? 0)
      .reduce((max, v) => Math.max(max, v), 0);
  }, [deltas]);

  return (
    <div className="w-full max-w-[560px] p-4 rounded-xl bg-neutral-950 text-neutral-100 border border-neutral-800">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            X-Rite ColorChecker Classic · 24-patch calibration
          </p>
          <h2 className="text-sm font-semibold mt-1">
            Skærm-farve verifikation
          </h2>
        </div>
        {worstDeltaE !== null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
              Værste ΔE
            </p>
            <p
              className={
                "text-lg font-semibold tabular-nums " +
                (worstDeltaE < 3
                  ? "text-emerald-400"
                  : worstDeltaE < 6
                    ? "text-amber-400"
                    : "text-red-400")
              }
            >
              {worstDeltaE.toFixed(1)}
            </p>
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-6 gap-1"
        role="group"
        aria-label="24-patch farvekalibrerings-grid"
      >
        {(deltas ?? COLORCHECKER_24.map((p) => ({ ...p, deltaE: null }))).map((p) => (
          <div
            key={p.id}
            className="relative aspect-square rounded"
            style={{ background: p.hex }}
            role="img"
            aria-label={
              p.deltaE !== null
                ? `${p.name} — ΔE ${p.deltaE.toFixed(1)}`
                : `${p.name} — afventer måling`
            }
          >
            {p.deltaE !== null && (
              <span
                className={
                  "absolute inset-0 flex items-center justify-center text-[10px] tabular-nums font-semibold " +
                  (p.deltaE < 3
                    ? "text-white"
                    : p.deltaE < 6
                      ? "text-amber-200"
                      : "text-red-100")
                }
                style={{
                  textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                }}
                title={`${p.name} · ΔE ${p.deltaE}`}
              >
                {p.deltaE < 10 ? p.deltaE.toFixed(1) : Math.round(p.deltaE)}
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-neutral-500 leading-relaxed">
        Hold et fysisk X-Rite / Calibrite ColorChecker Classic op mod skærmen.
        Sammenlign patches. Klik <em>Godkend kalibrering</em> når alle ΔE-værdier
        er under 3 (grøn).
      </p>

      <button
        type="button"
        className="mt-3 w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-neutral-950 font-semibold py-2 text-sm transition"
        disabled={worstDeltaE === null || worstDeltaE >= 3}
        onClick={() => props.onAcceptCalibration?.(worstDeltaE ?? 0)}
        aria-label={
          worstDeltaE === null
            ? "Godkend farvekalibrering — afventer måling"
            : worstDeltaE < 3
              ? `Godkend farvekalibrering (værste ΔE ${worstDeltaE.toFixed(1)})`
              : `Kan ikke godkende: ΔE ${worstDeltaE.toFixed(1)} er over grænsen 3`
        }
        aria-disabled={worstDeltaE === null || worstDeltaE >= 3}
      >
        {worstDeltaE === null
          ? "Afventer måling"
          : worstDeltaE < 3
            ? `Godkend kalibrering (worst ΔE ${worstDeltaE.toFixed(1)})`
            : `ΔE ${worstDeltaE.toFixed(1)} for høj — juster skærm-lysstyrke`}
      </button>
    </div>
  );
}
