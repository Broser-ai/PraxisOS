// Bookings mock-data — past + upcoming på tværs af tenants.

export type BookingStatus = "confirmed" | "completed" | "cancelled" | "noshow" | "pending";

export type Booking = {
  id: string;
  tenant: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  service: string;
  serviceId: string;
  practitioner: string;
  startsAt: string; // ISO
  durationMin: number;
  modality: "Klinik" | "Hjemmebesøg" | "Video";
  status: BookingStatus;
  priceKr: number;
  paid: boolean;
  noShowRisk: number;
  source: "online" | "tlf" | "aria" | "embed" | "admin";
  notes?: string;
};

// Genererer en blanding af past + upcoming bookings
function isoOffset(daysOffset: number, hour: number, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export const bookings: Booking[] = [
  // I dag
  { id: "bk_a1", tenant: "bypilar", clientId: "mette",  clientName: "Mette Lindqvist", clientInitials: "ML", service: "Hudanalyse · opfølgning", serviceId: "fod-scan", practitioner: "Dr. Krarup", startsAt: isoOffset(0, 8, 30), durationMin: 30, modality: "Klinik", status: "completed", priceKr: 595, paid: true, noShowRisk: 6, source: "online" },
  { id: "bk_a2", tenant: "bypilar", clientId: "jonas",  clientName: "Jonas Brandt", clientInitials: "JB", service: "Medicinsk fodpleje", serviceId: "fod-med", practitioner: "Dr. Krarup", startsAt: isoOffset(0, 9, 15), durationMin: 45, modality: "Klinik", status: "confirmed", priceKr: 495, paid: false, noShowRisk: 12, source: "tlf" },
  { id: "bk_a3", tenant: "bypilar", clientId: "amira",  clientName: "Amira Haddad", clientInitials: "AH", service: "Gel manicure", serviceId: "gel-mani", practitioner: "Pilar", startsAt: isoOffset(0, 10, 30), durationMin: 45, modality: "Klinik", status: "confirmed", priceKr: 395, paid: true, noShowRisk: 41, source: "aria" },
  { id: "bk_a4", tenant: "bypilar", clientId: "per",    clientName: "Per Sørensen", clientInitials: "PS", service: "Medicinsk fodpleje", serviceId: "fod-med", practitioner: "Pilar", startsAt: isoOffset(0, 11, 30), durationMin: 45, modality: "Hjemmebesøg", status: "pending", priceKr: 495, paid: false, noShowRisk: 68, source: "embed" },
  { id: "bk_a5", tenant: "bypilar", clientId: "clara",  clientName: "Clara Winther", clientInitials: "CW", service: "Nail art", serviceId: "nail-art", practitioner: "Pilar", startsAt: isoOffset(0, 13, 30), durationMin: 60, modality: "Klinik", status: "confirmed", priceKr: 545, paid: true, noShowRisk: 9, source: "online" },

  // Imorgen
  { id: "bk_b1", tenant: "bypilar", clientId: "mette",  clientName: "Mette Lindqvist", clientInitials: "ML", service: "Luksus fodpleje", serviceId: "fod-lux", practitioner: "Dr. Krarup", startsAt: isoOffset(1, 10), durationMin: 75, modality: "Klinik", status: "confirmed", priceKr: 745, paid: true, noShowRisk: 5, source: "online" },
  { id: "bk_b2", tenant: "bypilar", clientId: "jonas",  clientName: "Jonas Brandt", clientInitials: "JB", service: "Gel manicure", serviceId: "gel-mani", practitioner: "Pilar", startsAt: isoOffset(1, 14), durationMin: 45, modality: "Klinik", status: "confirmed", priceKr: 395, paid: false, noShowRisk: 18, source: "aria" },

  // Næste uge
  { id: "bk_c1", tenant: "bypilar", clientId: "amira",  clientName: "Amira Haddad", clientInitials: "AH", service: "Fod-scan · Physical AI", serviceId: "fod-scan", practitioner: "Dr. Krarup", startsAt: isoOffset(4, 11), durationMin: 30, modality: "Klinik", status: "confirmed", priceKr: 595, paid: false, noShowRisk: 22, source: "online" },
  { id: "bk_c2", tenant: "bypilar", clientId: "clara",  clientName: "Clara Winther", clientInitials: "CW", service: "Medicinsk fodpleje", serviceId: "fod-med", practitioner: "Pilar", startsAt: isoOffset(5, 15), durationMin: 45, modality: "Hjemmebesøg", status: "confirmed", priceKr: 495, paid: false, noShowRisk: 14, source: "embed" },

  // Past
  { id: "bk_p1", tenant: "bypilar", clientId: "mette",  clientName: "Mette Lindqvist", clientInitials: "ML", service: "Hudanalyse · baseline", serviceId: "fod-scan", practitioner: "Dr. Krarup", startsAt: isoOffset(-7, 9), durationMin: 30, modality: "Klinik", status: "completed", priceKr: 595, paid: true, noShowRisk: 0, source: "online" },
  { id: "bk_p2", tenant: "bypilar", clientId: "per",    clientName: "Per Sørensen", clientInitials: "PS", service: "Medicinsk fodpleje", serviceId: "fod-med", practitioner: "Pilar", startsAt: isoOffset(-7, 11), durationMin: 45, modality: "Hjemmebesøg", status: "completed", priceKr: 495, paid: true, noShowRisk: 0, source: "tlf" },
  { id: "bk_p3", tenant: "bypilar", clientId: "jonas",  clientName: "Jonas Brandt", clientInitials: "JB", service: "Gel manicure", serviceId: "gel-mani", practitioner: "Pilar", startsAt: isoOffset(-14, 13), durationMin: 45, modality: "Klinik", status: "completed", priceKr: 395, paid: true, noShowRisk: 0, source: "online" },
  { id: "bk_p4", tenant: "bypilar", clientId: "clara",  clientName: "Clara Winther", clientInitials: "CW", service: "Nail art", serviceId: "nail-art", practitioner: "Pilar", startsAt: isoOffset(-21, 14), durationMin: 60, modality: "Klinik", status: "noshow", priceKr: 545, paid: false, noShowRisk: 0, source: "online", notes: "Patient mødte ikke op. Aria sendte recovery-flow." },
  { id: "bk_p5", tenant: "bypilar", clientId: "amira",  clientName: "Amira Haddad", clientInitials: "AH", service: "Luksus fodpleje", serviceId: "fod-lux", practitioner: "Pilar", startsAt: isoOffset(-30, 10), durationMin: 75, modality: "Klinik", status: "cancelled", priceKr: 745, paid: false, noShowRisk: 0, source: "online", notes: "Aflyst af patient · genbooket til ny tid." },
];

export function listBookings(opts?: { tenant?: string; status?: BookingStatus[]; clientId?: string }): Booking[] {
  return bookings.filter((b) => {
    if (opts?.tenant && b.tenant !== opts.tenant) return false;
    if (opts?.status && !opts.status.includes(b.status)) return false;
    if (opts?.clientId && b.clientId !== opts.clientId) return false;
    return true;
  });
}

export function getBooking(id: string): Booking | undefined {
  return bookings.find((b) => b.id === id);
}

export const statusLabel: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Bekræftet",  color: "var(--color-accent)", bg: "color-mix(in srgb, var(--color-accent) 12%, transparent)" },
  completed: { label: "Gennemført", color: "var(--color-signal)", bg: "color-mix(in srgb, var(--color-signal) 12%, transparent)" },
  cancelled: { label: "Aflyst",     color: "var(--color-faint)",  bg: "var(--color-paper-2)" },
  noshow:    { label: "No-show",    color: "var(--color-clay)",   bg: "color-mix(in srgb, var(--color-clay) 12%, transparent)" },
  pending:   { label: "Afventer",   color: "var(--color-amber)",  bg: "color-mix(in srgb, var(--color-amber) 12%, transparent)" },
};

export const sourceLabel: Record<Booking["source"], string> = {
  online: "Online",
  tlf: "Telefon",
  aria: "Aria-agent",
  embed: "Embed",
  admin: "Admin",
};
