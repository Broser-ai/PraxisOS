// PraxisOS Auth · enkel session-baseret auth til prototype
//
// I prod: Supabase Auth + MitID OIDC-bro + JWT. Her: in-memory + cookie.
//
// Sprint 6 Batch 2 (2026-07-16) sikkerheds-fixes:
//   - Passwords hashes med scrypt (Node built-in), ikke plaintext.
//   - Session-tokens er HMAC-signeret (se lib/session-token.ts) i stedet
//     for ren base64, så payload ikke kan tampers med af klienten.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  encodeSignedSession,
  decodeSignedSession,
} from "@/lib/session-token";

export type Role = "owner" | "practitioner" | "reception" | "support";

export type Account = {
  id: string;
  email: string;
  /** scrypt-hash på formatet `scrypt$<salt-hex>$<hash-hex>` */
  passwordHash: string;
  name: string;
  initials: string;
  tenants: { slug: string; role: Role }[];
  twoFAEnabled: boolean;
  avatarColor: string;
  lastLogin?: string;
};

// --- Password hashing (scrypt, Node built-in) --------------------------------
// Format: `scrypt$<salt-hex>$<hash-hex>` med 32-byte salt + 64-byte hash.

const SCRYPT_SALT_BYTES = 32;
const SCRYPT_HASH_BYTES = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = scryptSync(plain, salt, SCRYPT_HASH_BYTES);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== SCRYPT_SALT_BYTES || expected.length !== SCRYPT_HASH_BYTES) {
    return false;
  }
  let candidate: Buffer;
  try {
    candidate = scryptSync(plain, salt, SCRYPT_HASH_BYTES);
  } catch {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}

// --- Demo-seed-konti ---------------------------------------------------------
// Password 'demo' hashes én gang ved modul-load, så prototypen aldrig holder
// plaintext passwords i memory efter init.

const DEMO_PASSWORD = "demo";
const DEMO_HASH = hashPassword(DEMO_PASSWORD);

export const accounts: Account[] = [
  {
    id: "acc_pilar",
    email: "pilar@bypilar.dk",
    passwordHash: DEMO_HASH,
    name: "Pilar Mortensen",
    initials: "PM",
    tenants: [{ slug: "bypilar", role: "owner" }],
    twoFAEnabled: true,
    avatarColor: "#8a6a3d",
  },
  {
    id: "acc_sofie",
    email: "sofie@bypilar.dk",
    passwordHash: DEMO_HASH,
    name: "Dr. Sofie Krarup",
    initials: "SK",
    tenants: [{ slug: "bypilar", role: "practitioner" }, { slug: "nordlys", role: "practitioner" }],
    twoFAEnabled: true,
    avatarColor: "#2f4a7c",
  },
  {
    id: "acc_nadia",
    email: "nadia@nordlys.dk",
    passwordHash: DEMO_HASH,
    name: "Nadia Berg",
    initials: "NB",
    tenants: [{ slug: "nordlys", role: "owner" }],
    twoFAEnabled: false,
    avatarColor: "#2f4a7c",
  },
  {
    id: "acc_ema",
    email: "emil@bypilar.dk",
    passwordHash: DEMO_HASH,
    name: "Emil Knudsen",
    initials: "EK",
    tenants: [{ slug: "bypilar", role: "reception" }],
    twoFAEnabled: false,
    avatarColor: "#ad7a26",
  },
];

export function findAccount(email: string, password: string): Account | undefined {
  const acc = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (!acc) return undefined;
  if (!verifyPassword(password, acc.passwordHash)) return undefined;
  return acc;
}

export function getAccountById(id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Ejer",
  practitioner: "Behandler",
  reception: "Receptionist",
  support: "Support · PraxisOS",
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ["admin", "bookings", "journal", "billing", "marketing", "api"],
  practitioner: ["bookings", "journal"],
  reception: ["bookings"],
  support: ["admin", "bookings", "journal", "billing", "marketing", "api", "support"],
};

// Cookie-baseret session - sættes af /api/auth/login, læses af middleware
export const SESSION_COOKIE = "praxis_session";

export type Session = {
  accountId: string;
  tenant: string;
  role: Role;
  loggedInAt: string;
};

// HMAC-signeret via lib/session-token.ts (Sprint 6 Batch 2 · B3-a).
// De to wrappere bevarer den eksisterende API-flade.
export function encodeSession(s: Session): string {
  return encodeSignedSession<Session>(s);
}

export function decodeSession(token: string): Session | null {
  return decodeSignedSession<Session>(token);
}
