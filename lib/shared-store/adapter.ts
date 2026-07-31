// Shared-store adapter · minimalt KV-interface til cross-instance state.
//
// Baggrund (COMPLETE-AUDIT-REPORT · B5):
//   Både GPU-budget (INV-CS-14) og login-brute-force-beskyttelse holdt
//   state i lokale Map<> — dvs. per-instance. På Vercel serverless (og
//   ethvert multi-instance runtime) er det uholdbart: en angriber kan
//   ramme forskellige warm-instances og omgå både cost-loft og backoff.
//
// Løsning: SharedStore-interface med metoder for counter + TTL. Default-
// implementationen er in-memory (matcher gammel adfærd i single-instance
// dev/test). Prod skal bruge Redis-stub eller anden distributed backend.
//
// Kontrakt for implementations:
//   * getCounter(key) → nuværende værdi eller 0 hvis ukendt/expireret
//   * incrementCounter(key, by) → returnerer NY værdi efter increment
//   * setCounterWithTtl(key, value, ttlMs) → sætter absolut værdi + expiry
//   * resetCounter(key) → sletter counter helt (til tests + admin-reset)
//
// TTL-semantik: en counter der er sat med setCounterWithTtl har absolut
// levetid. incrementCounter på en expireret counter starter fra 0 uden TTL.
// Callere der har brug for sliding-windows kalder setCounterWithTtl efter
// hvert increment (eksempel: rate-limit) eller ved første increment i en
// ny periode (eksempel: gpu-budget).

export interface SharedStore {
  /** Læs counter-værdi. 0 hvis ukendt eller expireret. */
  getCounter(key: string): Promise<number>;

  /** Increment counter atomisk. Returnerer ny værdi. */
  incrementCounter(key: string, by: number): Promise<number>;

  /** Sæt absolut værdi + expiry (ms fra nu). */
  setCounterWithTtl(key: string, value: number, ttlMs: number): Promise<void>;

  /** Slet counter fuldstændigt. */
  resetCounter(key: string): Promise<void>;
}

/**
 * NotImplementedError · kastes af redis-stub når prod-runtime ramler ind i
 * en metode uden faktisk Upstash-klient wired op. Bevidst tydelig fejl
 * fremfor silent-fallback.
 */
export class NotImplementedError extends Error {
  constructor(feature: string, guidance: string) {
    super(`[SharedStore] ${feature} not implemented. ${guidance}`);
    this.name = "NotImplementedError";
  }
}

// ---------------------------------------------------------------------------
// Default-adapter-selektion
// ---------------------------------------------------------------------------

let defaultStore: SharedStore | null = null;

/**
 * Registrér en global SharedStore-implementation. Bruges typisk én gang
 * ved app-start (fx via next.config eller server-init). Test-suite kalder
 * denne til at swappe adapters ind/ud.
 */
export function setDefaultSharedStore(store: SharedStore | null): void {
  defaultStore = store;
}

/**
 * Hent default-store. Hvis ingen er registreret returneres en frisk
 * memory-store — matcher legacy-adfærd for single-instance runtimes.
 * Prod-runtime bør altid registrere en distributed backend eksplicit.
 */
let defaultStoreFactory: (() => SharedStore) | null = null;

/**
 * Registrer en factory for default-store. Kaldes af memory-store som
 * module-load-side-effect saa vi undgaar cirkulaer static-import mellem
 * adapter.ts og memory-store.ts. Kan overskrives af Redis-integration
 * senere via setDefaultSharedStore().
 */
export function _registerDefaultFactory(factory: () => SharedStore): void {
  defaultStoreFactory = factory;
}

export function getDefaultSharedStore(): SharedStore {
  if (defaultStore) return defaultStore;
  if (!defaultStoreFactory) {
    throw new Error(
      "[SharedStore] No default factory registered. Import lib/shared-store/memory-store " +
      "somewhere in your app-startup, or call setDefaultSharedStore() eksplicit.",
    );
  }
  defaultStore = defaultStoreFactory();
  return defaultStore!;
}
