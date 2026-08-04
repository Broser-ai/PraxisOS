// Unified data repository — Supabase when configured, else durable memory store.

import type { Account, Role } from "@/lib/auth";
import type { Booking, BookingStatus } from "@/lib/bookings";
import { bookings as seedBookings } from "@/lib/bookings";
import type { ClientProfile } from "@/lib/clients";
import { clientsFull as seedClients } from "@/lib/clients";
import { hasConflict, toInterval } from "@/lib/calendar";
import {
  ensureBookingSeed,
  ensureClientSeed,
  getMemoryStore,
  type StoredClient,
} from "@/lib/data/memory";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getServiceSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getTenant } from "@/lib/tenants";

function readyMemory() {
  ensureClientSeed(seedClients);
  ensureBookingSeed(seedBookings);
  return getMemoryStore();
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() ||
    "XX"
  );
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function listClientsForTenant(tenant: string): Promise<ClientProfile[]> {
  const sb = getServiceSupabase();
  if (sb) {
    const { data: trow } = await sb.from("tenants").select("id").eq("slug", tenant).maybeSingle();
    if (!trow) return [];
    const { data, error } = await sb
      .from("clients")
      .select("*")
      .eq("tenant_id", trow.id)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map(mapDbClient);
  }

  return readyMemory().clients.filter((c) => c.tenant === tenant);
}

export async function getClientForTenant(
  tenant: string,
  id: string,
): Promise<ClientProfile | null> {
  const clients = await listClientsForTenant(tenant);
  return clients.find((c) => c.id === id) ?? null;
}

export async function createClientForTenant(
  tenant: string,
  input: {
    name: string;
    email: string;
    phone?: string;
    consentLevel?: ClientProfile["consentLevel"];
  },
): Promise<ClientProfile | { error: string }> {
  const sb = getServiceSupabase();
  if (sb) {
    const { data: trow } = await sb.from("tenants").select("id").eq("slug", tenant).maybeSingle();
    if (!trow) return { error: "tenant_not_found" };
    const { data, error } = await sb
      .from("clients")
      .insert({
        tenant_id: trow.id,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone ?? null,
        consent_level: input.consentLevel ?? "Almindelig",
      })
      .select("*")
      .single();
    if (error || !data) return { error: error?.message ?? "insert_failed" };
    return mapDbClient(data);
  }

  const store = readyMemory();
  const profile: StoredClient = {
    id: "cli_" + Math.random().toString(36).slice(2, 11),
    tenant,
    name: input.name.trim(),
    initials: initialsFromName(input.name),
    age: 0,
    tag: "Fodpleje",
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? "",
    cprMasked: "********-????",
    joined: new Date().toISOString().slice(0, 10),
    lastVisit: "Ny",
    trend: "flat",
    consentLevel: input.consentLevel ?? "Almindelig",
    mitidVerified: false,
  };
  store.clients.unshift(profile);
  return profile;
}

function mapDbClient(row: Record<string, unknown>): ClientProfile {
  const name = String(row.name ?? "");
  return {
    id: String(row.id),
    name,
    initials: initialsFromName(name),
    age: Number(row.age ?? 0),
    tag: "Fodpleje",
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    cprMasked: String(row.cpr_masked ?? "********-????"),
    joined: String(row.joined_at ?? row.created_at ?? "").slice(0, 10),
    lastVisit: row.last_visit_at ? String(row.last_visit_at).slice(0, 10) : "—",
    trend: "flat",
    consentLevel: (row.consent_level as ClientProfile["consentLevel"]) ?? "Almindelig",
    mitidVerified: Boolean(row.mitid_verified),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export async function listBookingsForTenant(
  tenant: string,
  opts?: { status?: BookingStatus; limit?: number },
): Promise<Booking[]> {
  const sb = getServiceSupabase();
  if (sb) {
    const { data: trow } = await sb.from("tenants").select("id").eq("slug", tenant).maybeSingle();
    if (!trow) return [];
    let q = sb
      .from("bookings")
      .select("*, clients(name), services(name,slug,duration_min)")
      .eq("tenant_id", trow.id)
      .order("starts_at", { ascending: false })
      .limit(opts?.limit ?? 100);
    if (opts?.status) q = q.eq("status", opts.status);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map((row) => mapDbBooking(tenant, row as Record<string, unknown>));
  }

  let list = readyMemory().bookings.filter((b) => b.tenant === tenant);
  if (opts?.status) list = list.filter((b) => b.status === opts.status);
  list = list.sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  return list.slice(0, opts?.limit ?? 100);
}

export async function getBookingForTenant(
  tenant: string,
  id: string,
): Promise<Booking | null> {
  const list = await listBookingsForTenant(tenant, { limit: 500 });
  return list.find((b) => b.id === id) ?? null;
}

export async function createBookingForTenant(
  tenant: string,
  input: {
    serviceId: string;
    startsAt: string;
    client: { name: string; email: string; phone?: string };
    modality?: Booking["modality"];
    notes?: string;
    source?: Booking["source"];
  },
): Promise<Booking | { error: string }> {
  const t = getTenant(tenant);
  if (!t) return { error: "tenant_not_found" };
  const service = t.services.find((s) => s.id === input.serviceId);
  if (!service) return { error: "service_not_found" };

  const starts = new Date(input.startsAt);
  if (Number.isNaN(starts.getTime())) return { error: "invalid_startsAt" };
  const modality = input.modality ?? "Klinik";

  const existing = await listBookingsForTenant(tenant, { limit: 500 });
  if (
    hasConflict(toInterval(starts, service.durationMin), existing)
  ) {
    return { error: "slot_conflict" };
  }

  // Ensure client exists
  const clients = await listClientsForTenant(tenant);
  let client =
    clients.find((c) => c.email.toLowerCase() === input.client.email.trim().toLowerCase()) ??
    null;
  if (!client) {
    const created = await createClientForTenant(tenant, {
      name: input.client.name,
      email: input.client.email,
      phone: input.client.phone,
    });
    if ("error" in created) return created;
    client = created;
  }

  const sb = getServiceSupabase();
  if (sb) {
    const { data: trow } = await sb.from("tenants").select("id").eq("slug", tenant).maybeSingle();
    if (!trow) return { error: "tenant_not_found" };

    // Resolve service UUID by slug (seed uses slug = mock service id)
    const { data: svc } = await sb
      .from("services")
      .select("id,name,duration_min,price_kr")
      .eq("tenant_id", trow.id)
      .eq("slug", input.serviceId)
      .maybeSingle();

    const serviceUuid = svc?.id as string | undefined;
    const price = Number(svc?.price_kr ?? service.priceKr);
    const duration = Number(svc?.duration_min ?? service.durationMin);
    const endsDb = new Date(starts.getTime() + duration * 60_000);

    // client.id from mapDbClient is UUID when from supabase
    const { data, error } = await sb
      .from("bookings")
      .insert({
        tenant_id: trow.id,
        client_id: client.id,
        service_id: serviceUuid ?? null,
        starts_at: starts.toISOString(),
        ends_at: endsDb.toISOString(),
        modality,
        status: "confirmed",
        price_kr: price,
        paid: false,
        source: input.source ?? "online",
        notes: input.notes ?? null,
      })
      .select("*, clients(name), services(name,slug,duration_min)")
      .single();
    if (error || !data) return { error: error?.message ?? "insert_failed" };
    return mapDbBooking(tenant, data as Record<string, unknown>);
  }

  const booking: Booking = {
    id: "bk_" + Math.random().toString(36).slice(2, 11),
    tenant,
    clientId: client.id,
    clientName: client.name,
    clientInitials: client.initials,
    service: service.name,
    serviceId: service.id,
    practitioner: "Klinik",
    startsAt: starts.toISOString(),
    durationMin: service.durationMin,
    modality,
    status: "confirmed",
    priceKr: service.priceKr,
    paid: false,
    noShowRisk: 15,
    source: input.source ?? "online",
    notes: input.notes,
  };
  readyMemory().bookings.unshift(booking);
  return booking;
}

function mapDbBooking(tenant: string, row: Record<string, unknown>): Booking {
  const clients = row.clients as { name?: string } | null;
  const services = row.services as {
    name?: string;
    slug?: string;
    duration_min?: number;
  } | null;
  const name = clients?.name ?? "Klient";
  const startsAt = String(row.starts_at);
  const endsAt = String(row.ends_at);
  const durationMin =
    services?.duration_min ??
    Math.max(15, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000));
  return {
    id: String(row.id),
    tenant,
    clientId: String(row.client_id ?? ""),
    clientName: name,
    clientInitials: initialsFromName(name),
    service: services?.name ?? "Ydelse",
    serviceId: services?.slug ?? String(row.service_id ?? ""),
    practitioner: "Klinik",
    startsAt,
    durationMin,
    modality: (row.modality as Booking["modality"]) ?? "Klinik",
    status: (row.status as BookingStatus) ?? "confirmed",
    priceKr: Number(row.price_kr ?? 0),
    paid: Boolean(row.paid),
    noShowRisk: Number(row.no_show_risk ?? 0),
    source: (row.source as Booking["source"]) ?? "online",
    notes: row.notes ? String(row.notes) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Auth against Supabase
// ---------------------------------------------------------------------------

export async function authenticateAgainstSupabase(
  email: string,
  password: string,
): Promise<Account | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  const sb = getServiceSupabase();
  if (!sb) return undefined;

  const { data: user, error } = await sb
    .from("users")
    .select("id,email,name,initials,password_hash,two_fa_enabled,avatar_color")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error || !user?.password_hash) return undefined;
  if (!verifyPassword(password, String(user.password_hash))) return undefined;

  const { data: memberships } = await sb
    .from("memberships")
    .select("role, tenants(slug)")
    .eq("user_id", user.id)
    .eq("active", true);

  const tenants = (memberships ?? [])
    .map((m) => {
      const t = m.tenants as { slug?: string } | { slug?: string }[] | null;
      const slug = Array.isArray(t) ? t[0]?.slug : t?.slug;
      if (!slug) return null;
      return { slug, role: m.role as Role };
    })
    .filter((x): x is { slug: string; role: Role } => !!x);

  if (tenants.length === 0) return undefined;

  return {
    id: String(user.id),
    email: String(user.email),
    passwordHash: String(user.password_hash),
    name: String(user.name),
    initials: String(user.initials ?? initialsFromName(String(user.name))),
    tenants,
    twoFAEnabled: Boolean(user.two_fa_enabled),
    avatarColor: String(user.avatar_color ?? "#8a6a3d"),
  };
}

export async function signupTenantInSupabase(input: {
  slug: string;
  legalName: string;
  cvr?: string;
  address?: string;
  email: string;
  phone?: string;
  contactName: string;
  plan: string;
  password: string;
}): Promise<{ tenantId: string; userId: string } | { error: string }> {
  const sb = getServiceSupabase();
  if (!sb) return { error: "supabase_not_configured" };

  const { data: existing } = await sb
    .from("tenants")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();
  if (existing) return { error: "slug_taken" };

  const { data: emailTaken } = await sb
    .from("users")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();
  if (emailTaken) return { error: "email_taken" };

  const planLabel =
    input.plan === "starter"
      ? "Starter · trial"
      : input.plan === "practice-ai"
        ? "Practice + AI · trial"
        : "Practice · trial";

  const { data: tenant, error: tErr } = await sb
    .from("tenants")
    .insert({
      slug: input.slug,
      legal_name: input.legalName,
      cvr: input.cvr || null,
      brand: {
        name: input.legalName,
        tagline: "Ny klinik på PraxisOS",
        primary: "#1b1a17",
        accent: "#8a6a3d",
      },
      domains: [`${input.slug}.praxis.app`],
      mode: "full",
      locale: "da-DK",
      timezone: "Europe/Copenhagen",
      currency: "DKK",
      license: {
        plan: planLabel,
        status: "trial",
        seats: 3,
      },
      contact: {
        address: input.address ?? "",
        phone: input.phone ?? "",
        email: input.email,
        cvr: input.cvr,
      },
    })
    .select("id")
    .single();
  if (tErr || !tenant) return { error: tErr?.message ?? "tenant_insert_failed" };

  const parts = input.contactName.trim().split(/\s+/);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() ||
    "XX";

  const { data: user, error: uErr } = await sb
    .from("users")
    .insert({
      email: input.email,
      password_hash: hashPassword(input.password),
      name: input.contactName,
      initials,
      two_fa_enabled: false,
      avatar_color: "#8a6a3d",
    })
    .select("id")
    .single();
  if (uErr || !user) {
    await sb.from("tenants").delete().eq("id", tenant.id);
    return { error: uErr?.message ?? "user_insert_failed" };
  }

  const { error: mErr } = await sb.from("memberships").insert({
    user_id: user.id,
    tenant_id: tenant.id,
    role: "owner",
    permissions: ["admin", "bookings", "journal", "billing", "marketing", "api"],
    active: true,
  });
  if (mErr) {
    await sb.from("users").delete().eq("id", user.id);
    await sb.from("tenants").delete().eq("id", tenant.id);
    return { error: mErr.message };
  }

  return { tenantId: String(tenant.id), userId: String(user.id) };
}

export function dataBackend(): "supabase" | "memory" {
  return isSupabaseConfigured() ? "supabase" : "memory";
}
