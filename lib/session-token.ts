// PraxisOS · HMAC-signed session tokens
//
// Kontekst (Sprint 6 Batch 2 · B3-a):
// Prototype-versionen af `encodeSession` var ren base64 - enhver klient kunne
// forfalske en session ved at ændre payload og re-encoda. Denne modul bytter
// det ud med HMAC-SHA256 signering af payload'en. Formatet er:
//
//     base64url(payloadJson).base64url(hmac)
//
// Signatur-verifikation sker med `timingSafeEqual` for at undgå timing-leaks.
//
// Hemmelighed hentes fra `PRAXIS_SESSION_SECRET`. I production skal env-varen
// være sat - ellers throw'er modulet. I dev/test bruges en deterministisk
// fallback-nøgle (så tests kan køre uden env-opsætning), men med en klar
// note i loggen første gang den bruges.

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
    // eslint-disable-next-line no-console
    console.warn(
      "[praxisos] PRAXIS_SESSION_SECRET not set - using dev/test fallback.",
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
  // Genskab padding før decode
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function hmacSign(payload: string): Buffer {
  return createHmac("sha256", getSecret()).update(payload).digest();
}

/**
 * Encode en session-payload til et HMAC-signeret token.
 * Payload må være enhver JSON-serialiserbar struktur.
 */
export function encodeSignedSession<T>(payload: T): string {
  const json = JSON.stringify(payload);
  const payloadB64 = toBase64Url(Buffer.from(json, "utf-8"));
  const sig = hmacSign(payloadB64);
  return `${payloadB64}.${toBase64Url(sig)}`;
}

/**
 * Verificér og decode et session-token. Returnerer null hvis:
 *   - formatet ikke er `payload.signature`
 *   - signaturen ikke matcher (tampered payload)
 *   - JSON-payload'en ikke kan parses
 */
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
