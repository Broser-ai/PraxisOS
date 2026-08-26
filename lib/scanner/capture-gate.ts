/**
 * CaptureGate-Σ — uncertainty-aware capture quality signals (SHADOW / audit only).
 *
 * Logs structured proxies for blur / exposure / crop / usable-view.
 * MUST NOT change SCAN_QUALITY_THRESHOLD (70) or drive PASS/HOLD.
 * MUST NOT replace scoreScanQuality.
 *
 * Feature flag: PRAXIS_CAPTURE_GATE_SHADOW (default OFF).
 * When OFF, helpers still compute for tests; scheduleCaptureGateShadow is a no-op log skip.
 */

import { createHash } from "node:crypto";
import { auditError, auditLog } from "@/lib/audit";

export const CAPTURE_GATE_FLAG = "PRAXIS_CAPTURE_GATE_SHADOW" as const;

export type UncertaintyBand = "low" | "med" | "high";

export type CaptureSliceTag =
  | "lighting_unknown"
  | "lighting_dim"
  | "lighting_harsh"
  | "possible_blur"
  | "tight_crop"
  | "loose_crop"
  | "usable_view"
  | "marginal_view"
  | "unusable_view";

/** Shadow score-card — audit / evaluation only. */
export type CaptureGateShadowCard = {
  event: "vision.capture_gate.shadow";
  blur_proxy: number; // 0–1, higher = sharper estimate
  exposure_proxy: number; // 0–1, ~0.5 ideal mid-tone
  crop_foot_ratio: number | null; // null when no foot bbox
  usable_view_proxy: number; // 0–1
  slice_tags: CaptureSliceTag[];
  uncertainty_band: UncertaintyBand;
  used_for_quality_gate: false;
  used_for_routing: false;
  used_for_patient_response: false;
  drives_pass_hold: false;
  scan_ref: string;
  notes: string[];
};

export type CaptureGateInput = {
  imageBase64?: string;
  imageBytes?: number;
  /** Normalized foot bbox in image coords (0–1). */
  footBBox?: { x: number; y: number; width: number; height: number };
  footDetected?: boolean;
  /** Optional downsampled luma stats when a decoder is available upstream. */
  previewStats?: {
    meanLuma: number; // 0–255
    laplacianVar?: number;
    width?: number;
    height?: number;
  };
  scanId?: string;
  tenantId?: string;
};

export type CaptureGateDeps = {
  flagEnabled?: boolean;
  audit?: { log: typeof auditLog; error: typeof auditError };
};

function truthyFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isCaptureGateShadowEnabled(
  processEnv: Record<string, string | undefined> = process.env,
): boolean {
  return truthyFlag(processEnv[CAPTURE_GATE_FLAG]);
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Best-effort JPEG SOF0/SOF2 dimensions from base64 (no full decode). */
export function peekJpegDimensions(
  imageBase64: string | undefined,
): { width: number; height: number } | null {
  if (!imageBase64) return null;
  try {
    const bare = stripDataUrl(imageBase64);
    const buf = Buffer.from(bare.slice(0, 24_000), "base64");
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = (buf[i + 2]! << 8) | buf[i + 3]!;
      // SOF0 / SOF2
      if (marker === 0xc0 || marker === 0xc2) {
        const height = (buf[i + 5]! << 8) | buf[i + 6]!;
        const width = (buf[i + 7]! << 8) | buf[i + 8]!;
        if (width > 0 && height > 0) return { width, height };
      }
      i += 2 + len;
    }
  } catch {
    return null;
  }
  return null;
}

function hashScanRef(parts: {
  scanId?: string;
  tenantId?: string;
  imageBase64?: string;
  imageBytes?: number;
}): string {
  const h = createHash("sha256");
  h.update(parts.scanId ?? "");
  h.update("|");
  h.update(parts.tenantId ?? "");
  h.update("|");
  h.update(String(parts.imageBytes ?? 0));
  if (parts.imageBase64) {
    const bare = stripDataUrl(parts.imageBase64);
    h.update(bare.slice(0, 48));
  }
  return h.digest("hex").slice(0, 16);
}

/**
 * Compute CaptureGate shadow proxies.
 * Pure function — safe to call always; does not touch PASS/HOLD.
 */
export function computeCaptureGateShadow(
  input: CaptureGateInput,
): CaptureGateShadowCard {
  const notes: string[] = [];
  const bytes =
    input.imageBytes ??
    (input.imageBase64
      ? Math.floor((stripDataUrl(input.imageBase64).length * 3) / 4)
      : 0);

  const jpegDims = peekJpegDimensions(input.imageBase64);
  const width =
    input.previewStats?.width ?? jpegDims?.width ?? (bytes > 0 ? 1280 : 0);
  const height =
    input.previewStats?.height ?? jpegDims?.height ?? (bytes > 0 ? 960 : 0);
  const pixels = width > 0 && height > 0 ? width * height : 0;

  // Blur proxy: bytes-per-pixel heuristic (+ optional laplacian when provided).
  let blur_proxy = 0.5;
  if (input.previewStats?.laplacianVar != null) {
    // Typical phone Laplacian variance bands (heuristic, not clinical).
    blur_proxy = clamp01(input.previewStats.laplacianVar / 500);
    notes.push("blur_from_laplacian");
  } else if (pixels > 0 && bytes > 0) {
    const bpp = bytes / pixels;
    // ~0.15–0.6 bytes/pixel common for usable JPEG phone captures
    blur_proxy = clamp01((bpp - 0.05) / 0.45);
    notes.push("blur_from_bpp_heuristic");
  } else {
    notes.push("blur_unknown_default");
  }

  // Exposure proxy from mean luma or mid default.
  let exposure_proxy = 0.5;
  if (input.previewStats?.meanLuma != null) {
    const luma01 = clamp01(input.previewStats.meanLuma / 255);
    // Peak at ~0.45–0.55 mid-tone
    exposure_proxy = clamp01(1 - Math.abs(luma01 - 0.5) * 2);
    notes.push("exposure_from_luma");
  } else {
    notes.push("exposure_unknown_mid");
  }

  let crop_foot_ratio: number | null = null;
  if (input.footBBox) {
    const { width: bw, height: bh } = input.footBBox;
    crop_foot_ratio = clamp01(bw * bh);
    notes.push("crop_from_bbox");
  } else if (input.footDetected === false) {
    crop_foot_ratio = 0;
    notes.push("crop_no_foot");
  } else {
    notes.push("crop_unknown");
  }

  const slice_tags: CaptureSliceTag[] = [];
  if (!input.previewStats?.meanLuma) slice_tags.push("lighting_unknown");
  else if (input.previewStats.meanLuma < 60) slice_tags.push("lighting_dim");
  else if (input.previewStats.meanLuma > 200) slice_tags.push("lighting_harsh");

  if (blur_proxy < 0.35) slice_tags.push("possible_blur");
  if (crop_foot_ratio != null && crop_foot_ratio < 0.12) slice_tags.push("tight_crop");
  if (crop_foot_ratio != null && crop_foot_ratio > 0.85) slice_tags.push("loose_crop");

  const cropFactor =
    crop_foot_ratio == null
      ? input.footDetected === false
        ? 0.15
        : 0.7
      : crop_foot_ratio >= 0.15 && crop_foot_ratio <= 0.75
        ? 1
        : 0.45;

  const usable_view_proxy = clamp01(
    0.45 * blur_proxy + 0.25 * exposure_proxy + 0.3 * cropFactor,
  );

  if (usable_view_proxy >= 0.65) slice_tags.push("usable_view");
  else if (usable_view_proxy >= 0.4) slice_tags.push("marginal_view");
  else slice_tags.push("unusable_view");

  const unknownCount = notes.filter((n) => /unknown/.test(n)).length;
  let uncertainty_band: UncertaintyBand = "low";
  if (unknownCount >= 2 || usable_view_proxy < 0.4) uncertainty_band = "high";
  else if (unknownCount === 1 || usable_view_proxy < 0.65) uncertainty_band = "med";

  return {
    event: "vision.capture_gate.shadow",
    blur_proxy: Number(blur_proxy.toFixed(4)),
    exposure_proxy: Number(exposure_proxy.toFixed(4)),
    crop_foot_ratio:
      crop_foot_ratio == null ? null : Number(crop_foot_ratio.toFixed(4)),
    usable_view_proxy: Number(usable_view_proxy.toFixed(4)),
    slice_tags,
    uncertainty_band,
    used_for_quality_gate: false,
    used_for_routing: false,
    used_for_patient_response: false,
    drives_pass_hold: false,
    scan_ref: hashScanRef(input),
    notes,
  };
}

/**
 * Fire-and-forget audit when flag is ON. Never throws; never affects quality gate.
 */
export function scheduleCaptureGateShadow(
  input: CaptureGateInput,
  deps: CaptureGateDeps = {},
): CaptureGateShadowCard | null {
  const audit = deps.audit ?? { log: auditLog, error: auditError };
  const flagOn =
    deps.flagEnabled !== undefined
      ? deps.flagEnabled
      : isCaptureGateShadowEnabled();

  try {
    const card = computeCaptureGateShadow(input);
    if (!flagOn) {
      audit.log("vision.capture_gate.skipped", {
        ...card,
        skip_reason: "flag_off",
        target_ref: `capture_gate/${card.scan_ref}`,
      });
      return null;
    }
    audit.log("vision.capture_gate.shadow", {
      ...card,
      target_ref: `capture_gate/${card.scan_ref}`,
      tenant_id: input.tenantId,
    });
    return card;
  } catch (e) {
    try {
      audit.error("vision.capture_gate.error", e, {
        event: "vision.capture_gate.shadow",
        drives_pass_hold: false,
        used_for_quality_gate: false,
      });
    } catch {
      // never break primary
    }
    return null;
  }
}
