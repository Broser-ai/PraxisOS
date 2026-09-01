// Process-local durable store (survives warm instances / next dev).
// Used when Supabase is not configured. Not multi-instance durable on Vercel.

import type { Booking } from "@/lib/bookings";
import type { ClientProfile } from "@/lib/clients";

export type StoredClient = ClientProfile & { tenant: string };

type MemoryRoot = {
  clients: StoredClient[];
  bookings: Booking[];
  clientsSeeded: boolean;
  bookingsSeeded: boolean;
};

const GLOBAL_KEY = "__praxisos_memory_store_v1__";

function empty(): MemoryRoot {
  return {
    clients: [],
    bookings: [],
    clientsSeeded: false,
    bookingsSeeded: false,
  };
}

export function getMemoryStore(): MemoryRoot {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryRoot };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = empty();
  return g[GLOBAL_KEY];
}

export function ensureClientSeed(seed: ClientProfile[], tenant = "bypilar"): void {
  const store = getMemoryStore();
  if (store.clientsSeeded) return;
  store.clients = seed.map((c) => ({ ...c, tenant }));
  store.clientsSeeded = true;
}

export function ensureBookingSeed(seed: Booking[]): void {
  const store = getMemoryStore();
  if (store.bookingsSeeded) return;
  store.bookings = seed.map((b) => ({ ...b }));
  store.bookingsSeeded = true;
}

export function resetMemoryStoreForTests(): void {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryRoot };
  g[GLOBAL_KEY] = empty();
}
