// In-memory SharedStore-impl · default for dev + tests + single-instance.
//
// Ikke sikker for multi-instance prod: state deles ikke på tværs af
// serverless-warm-instances eller regioner. Til prod bruges Redis-stub
// (senere Upstash-klient) via setDefaultSharedStore().
//
// Datamodel: Map<key, { value: number; expiresAt: number | null }>.
// Ved læsning tjekkes expiresAt — abandoned-entries slettes lazy.

import { _registerDefaultFactory, type SharedStore } from "./adapter";

type Entry = { value: number; expiresAt: number | null };

export function createMemorySharedStore(): SharedStore {
  const store = new Map<string, Entry>();

  function readLive(key: string): Entry | null {
    const e = store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && Date.now() >= e.expiresAt) {
      store.delete(key);
      return null;
    }
    return e;
  }

  return {
    async getCounter(key) {
      const e = readLive(key);
      return e ? e.value : 0;
    },

    async incrementCounter(key, by) {
      const existing = readLive(key);
      const next: Entry = existing
        ? { value: existing.value + by, expiresAt: existing.expiresAt }
        : { value: by, expiresAt: null };
      store.set(key, next);
      return next.value;
    },

    async setCounterWithTtl(key, value, ttlMs) {
      store.set(key, {
        value,
        expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
      });
    },

    async resetCounter(key) {
      store.delete(key);
    },
  };
}

// Self-register som default-factory. Import af denne modul (direkte eller
// transitivt via gpu-adapter / rate-limit) er nok til at bootstrap default-
// store'n. Prod-runtime der bruger Redis kalder setDefaultSharedStore()
// ovenpaa dette.
_registerDefaultFactory(createMemorySharedStore);
