// PraxisOS · HMAC-signed session tokens
//
// Format: base64url(payloadJson).base64url(hmac-sha256)
// Node APIs here; Edge middleware reimplements verify with Web Crypto.

import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_TEST_FALLBACK_KEY =
  "praxisos-dev-test-session-key-do-not-use-in-production";

let warnedAboutFallback = false;

function getSecret(): string {
  const secret = process.env.PRAXIS_SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRAXIS_SESSION_SECRET is required in production (min 16 chars)",
    );
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      "[praxisos] PRAXIS_SESSION_SECRET not set — using dev/test fallback.",
    );
  }
  return DEV_TEST_FALLBACK_KEY;
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function hmacSign(payload: string): Buffer {
  return createHmac("sha256", getSecret()).update(payload).digest();
}

export function encodeSignedSession<T>(payload: T): string {
  const json = JSON.stringify(payload);
  const payloadB64 = toBase64Url(Buffer.from(json, "utf-8"));
  const sig = hmacSign(payloadB64);
  return `${payloadB64}.${toBase64Url(sig)}`;
}

export function decodeSignedSession<T>(token: string | undefined | null): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  let actualSig: Buffer;
  try {
    actualSig = fromBase64Url(sigB64);
  } catch {
    return null;
  }
  const expectedSig = hmacSign(payloadB64);
  if (actualSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(actualSig, expectedSig)) return null;

  try {
    const json = fromBase64Url(payloadB64).toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
