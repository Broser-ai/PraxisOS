// Behandlere/staff mock-data.

export type StaffRole = "Ejer" | "Behandler" | "Fodterapeut" | "Receptionist" | "Studerende";

export type Staff = {
  id: string;
  name: string;
  initials: string;
  email: string;
  tenant: string;
  role: StaffRole;
  permissions: ("admin" | "bookings" | "journal" | "billing" | "marketing")[];
  hoursThisWeek: number;
  active: boolean;
  startedAt: string;
  avatarColor: string;
};

export const staff: Staff[] = [
  { id: "pilar",  name: "Pilar Mortensen", initials: "PM", email: "pilar@bypilar.dk", tenant: "bypilar", role: "Ejer", permissions: ["admin","bookings","journal","billing","marketing"], hoursThisWeek: 37, active: true, startedAt: "2019-03-01", avatarColor: "#8a6a3d" },
  { id: "sk",     name: "Dr. Sofie Krarup", initials: "SK", email: "sofie@bypilar.dk", tenant: "bypilar", role: "Fodterapeut", permissions: ["bookings","journal"], hoursThisWeek: 28, active: true, startedAt: "2024-09-12", avatarColor: "#2f4a7c" },
  { id: "lh",     name: "Laila Hansen", initials: "LH", email: "laila@bypilar.dk", tenant: "bypilar", role: "Behandler", permissions: ["bookings","journal"], hoursThisWeek: 22, active: true, startedAt: "2023-06-15", avatarColor: "#b9543a" },
  { id: "ek",     name: "Emil Knudsen", initials: "EK", email: "emil@bypilar.dk", tenant: "bypilar", role: "Studerende", permissions: ["bookings"], hoursThisWeek: 12, active: true, startedAt: "2026-02-01", avatarColor: "#ad7a26" },
  { id: "nordlys-1", name: "Nadia Berg", initials: "NB", email: "nadia@nordlys.dk", tenant: "nordlys", role: "Ejer", permissions: ["admin","bookings","journal","billing"], hoursThisWeek: 35, active: true, startedAt: "2023-04-01", avatarColor: "#2f4a7c" },
];

export const ROLE_COLORS: Record<StaffRole, string> = {
  Ejer: "var(--color-clay)",
  Behandler: "var(--color-accent)",
  Fodterapeut: "var(--color-signal)",
  Receptionist: "var(--color-amber)",
  Studerende: "var(--color-faint)",
};
