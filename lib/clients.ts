// Klienter — udvidet mock-data så alle profiler har indhold.
// Erstatter den simple liste i lib/mock.ts.

export type ClientProfile = {
  id: string;
  name: string;
  initials: string;
  age: number;
  tag: "Æstetik" | "Acne-forløb" | "Filler" | "Sårpleje" | "Fodpleje" | "Negle";
  email: string;
  phone: string;
  cprMasked: string;
  joined: string; // ISO date
  lastVisit: string; // friendly
  trend: "up" | "down" | "flat";
  consentLevel: "Almindelig" | "Sundhedsdata" | "Forskning";
  mitidVerified: boolean;
  notes?: string;
  forloeb?: { name: string; progress: number; sessions: number; total: number; status: "active" | "paused" | "done" };
  // Modul-specifikke data (sat når relevant)
  hasSkinScan?: boolean;
  hasFootScan?: boolean;
};

export const clientsFull: ClientProfile[] = [
  {
    id: "mette", name: "Mette Lindqvist", initials: "ML", age: 42, tag: "Æstetik",
    email: "mette.l@example.com", phone: "+45 22 14 87 09", cprMasked: "********-1024",
    joined: "2024-09-12", lastVisit: "I dag", trend: "up",
    consentLevel: "Sundhedsdata", mitidVerified: true,
    forloeb: { name: "Acne-protokol", progress: 62, sessions: 5, total: 8, status: "active" },
    hasSkinScan: true, hasFootScan: true,
  },
  {
    id: "jonas", name: "Jonas Brandt", initials: "JB", age: 51, tag: "Æstetik",
    email: "jonas@brandt.dk", phone: "+45 28 41 53 22", cprMasked: "********-0573",
    joined: "2025-02-04", lastVisit: "I dag", trend: "flat",
    consentLevel: "Sundhedsdata", mitidVerified: true,
    forloeb: { name: "Botox-vedligehold", progress: 50, sessions: 1, total: 2, status: "active" },
    hasSkinScan: true,
  },
  {
    id: "amira", name: "Amira Haddad", initials: "AH", age: 27, tag: "Acne-forløb",
    email: "amira.h@example.com", phone: "+45 50 12 88 41", cprMasked: "********-2841",
    joined: "2025-04-22", lastVisit: "I dag", trend: "up",
    consentLevel: "Sundhedsdata", mitidVerified: true,
    notes: "Sensitiv hud. Følsom over for parfumeret lotion.",
    forloeb: { name: "Acne-forløb · 8 sessioner", progress: 50, sessions: 4, total: 8, status: "active" },
    hasSkinScan: true,
  },
  {
    id: "per", name: "Per Sørensen", initials: "PS", age: 73, tag: "Sårpleje",
    email: "per.s@example.com", phone: "+45 40 33 21 09", cprMasked: "********-3309",
    joined: "2024-01-03", lastVisit: "3 dage", trend: "down",
    consentLevel: "Sundhedsdata", mitidVerified: true,
    notes: "Diabetes type 2. Hjemmebesøg pga. begrænset mobilitet.",
    forloeb: { name: "Sår-opfølgning · 4 uger", progress: 75, sessions: 3, total: 4, status: "active" },
    hasFootScan: true,
  },
  {
    id: "clara", name: "Clara Winther", initials: "CW", age: 38, tag: "Filler",
    email: "clara.w@example.com", phone: "+45 27 89 14 56", cprMasked: "********-1456",
    joined: "2023-11-18", lastVisit: "6 uger", trend: "flat",
    consentLevel: "Almindelig", mitidVerified: true,
    forloeb: { name: "Filler · genbehandling", progress: 100, sessions: 1, total: 1, status: "done" },
    hasSkinScan: true,
  },
];

export function listClients(): ClientProfile[] {
  return clientsFull;
}

export function getClient(id: string): ClientProfile | undefined {
  return clientsFull.find((c) => c.id === id);
}

export function findClientByEmail(email: string): ClientProfile | undefined {
  const e = email.trim().toLowerCase();
  if (!e) return undefined;
  return clientsFull.find((c) => c.email.toLowerCase() === e);
}
