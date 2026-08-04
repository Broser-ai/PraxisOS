// PraxisOS Auth · scrypt password hashes + HMAC-signed session cookies

import { hashPassword, verifyPassword } from "@/lib/password";
import {
  encodeSignedSession,
  decodeSignedSession,
} from "@/lib/session-token";

export type Role = "owner" | "practitioner" | "reception" | "support";

export type Account = {
  id: string;
  email: string;
  /** scrypt$<salt-hex>$<hash-hex> */
  passwordHash: string;
  name: string;
  initials: string;
  tenants: { slug: string; role: Role }[];
  twoFAEnabled: boolean;
  avatarColor: string;
  lastLogin?: string;
};

export { hashPassword, verifyPassword };

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
    tenants: [
      { slug: "bypilar", role: "practitioner" },
      { slug: "nordlys", role: "practitioner" },
    ],
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
    id: "acc_emil_reception",
    email: "emil@bypilar.dk",
    passwordHash: DEMO_HASH,
    name: "Emil Knudsen",
    initials: "EK",
    tenants: [{ slug: "bypilar", role: "reception" }],
    twoFAEnabled: false,
    avatarColor: "#ad7a26",
  },
  {
    id: "acc_emil_support",
    email: "emil@support.praxis.app",
    passwordHash: DEMO_HASH,
    name: "Emil Support",
    initials: "ES",
    tenants: [
      { slug: "bypilar", role: "support" },
      { slug: "nordlys", role: "support" },
    ],
    twoFAEnabled: true,
    avatarColor: "#1b1a17",
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

export function getAccountByEmail(email: string): Account | undefined {
  return accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
}

/** Opretter owner-konto til ny tenant (memory). Password er påkrævet fra signup. */
export function registerOwnerAccount(input: {
  email: string;
  name: string;
  tenantSlug: string;
  password: string;
}): Account | { error: string } {
  if (getAccountByEmail(input.email)) return { error: "email_taken" };
  if (!input.password || input.password.length < 8) {
    return { error: "weak_password" };
  }
  const parts = input.name.trim().split(/\s+/);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() ||
    "XX";
  const account: Account = {
    id: "acc_" + Math.random().toString(36).slice(2, 10),
    email: input.email.toLowerCase(),
    passwordHash: hashPassword(input.password),
    name: input.name.trim(),
    initials,
    tenants: [{ slug: input.tenantSlug, role: "owner" }],
    twoFAEnabled: false,
    avatarColor: "#8a6a3d",
  };
  accounts.push(account);
  return account;
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

export const SESSION_COOKIE = "praxis_session";

export type Session = {
  accountId: string;
  tenant: string;
  role: Role;
  loggedInAt: string;
};

export function encodeSession(s: Session): string {
  return encodeSignedSession<Session>(s);
}

export function decodeSession(token: string): Session | null {
  return decodeSignedSession<Session>(token);
}
