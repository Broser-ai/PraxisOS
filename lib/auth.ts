// PraxisOS Auth · enkel session-baseret auth til prototype
//
// I prod: Supabase Auth + MitID OIDC-bro + JWT. Her: in-memory + cookie.

export type Role = "owner" | "practitioner" | "reception" | "support";

export type Account = {
  id: string;
  email: string;
  password: string;     // ⚠ kun til prototype — hash i prod
  name: string;
  initials: string;
  tenants: { slug: string; role: Role }[];
  twoFAEnabled: boolean;
  avatarColor: string;
  lastLogin?: string;
};

// SEED · konti pr. tenant
export const accounts: Account[] = [
  {
    id: "acc_pilar",
    email: "pilar@bypilar.dk",
    password: "demo",
    name: "Pilar Mortensen",
    initials: "PM",
    tenants: [{ slug: "bypilar", role: "owner" }],
    twoFAEnabled: true,
    avatarColor: "#8a6a3d",
  },
  {
    id: "acc_sofie",
    email: "sofie@bypilar.dk",
    password: "demo",
    name: "Dr. Sofie Krarup",
    initials: "SK",
    tenants: [{ slug: "bypilar", role: "practitioner" }, { slug: "nordlys", role: "practitioner" }],
    twoFAEnabled: true,
    avatarColor: "#2f4a7c",
  },
  {
    id: "acc_nadia",
    email: "nadia@nordlys.dk",
    password: "demo",
    name: "Nadia Berg",
    initials: "NB",
    tenants: [{ slug: "nordlys", role: "owner" }],
    twoFAEnabled: false,
    avatarColor: "#2f4a7c",
  },
  {
    id: "acc_emil_reception",
    email: "emil@bypilar.dk",
    password: "demo",
    name: "Emil Knudsen",
    initials: "EK",
    tenants: [{ slug: "bypilar", role: "reception" }],
    twoFAEnabled: false,
    avatarColor: "#ad7a26",
  },
  {
    id: "acc_emil_support",
    email: "emil@support.praxis.app",
    password: "demo",
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
  return accounts.find((a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
}

export function getAccountById(id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}

export function getAccountByEmail(email: string): Account | undefined {
  return accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
}

/** Opretter owner-konto til ny tenant (mock-mode). Password = "demo" indtil MitID-invite. */
export function registerOwnerAccount(input: {
  email: string;
  name: string;
  tenantSlug: string;
}): Account | { error: string } {
  if (getAccountByEmail(input.email)) return { error: "email_taken" };
  const parts = input.name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "XX";
  const account: Account = {
    id: "acc_" + Math.random().toString(36).slice(2, 10),
    email: input.email.toLowerCase(),
    password: "demo",
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

// Cookie-baseret session — sættes af /api/auth/login, læses af middleware
export const SESSION_COOKIE = "praxis_session";

export type Session = {
  accountId: string;
  tenant: string;
  role: Role;
  loggedInAt: string;
};

export function encodeSession(s: Session): string {
  // Prototype: base64 — i prod bruges signed JWT
  return Buffer.from(JSON.stringify(s)).toString("base64");
}

export function decodeSession(token: string): Session | null {
  try { return JSON.parse(Buffer.from(token, "base64").toString("utf-8")); }
  catch { return null; }
}
