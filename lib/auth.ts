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
    id: "acc_ema",
    email: "emil@bypilar.dk",
    password: "demo",
    name: "Emil Knudsen",
    initials: "EK",
    tenants: [{ slug: "bypilar", role: "reception" }],
    twoFAEnabled: false,
    avatarColor: "#ad7a26",
  },
];

export function findAccount(email: string, password: string): Account | undefined {
  return accounts.find((a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
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
