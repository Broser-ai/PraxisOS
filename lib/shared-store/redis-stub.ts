// Redis SharedStore-stub · skeleton til Upstash-Redis integration.
//
// Formål: dokumentere kontrakten prod-runtime skal implementere, og fejle
// LYDT hvis nogen prøver at bruge stub'en uden at wire faktisk Redis-klient
// op. Bevidst NotImplementedError — vi vil ALDRIG silent-fallback til
// memory-store i multi-instance prod (det var netop B5-attack-vektoren).
//
// Wire-up (når vi er klar):
//   1. `npm i @upstash/redis`
//   2. Sæt UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN i prod-env
//   3. Erstat `throw new NotImplementedError(...)` med Upstash-kald:
//        - getCounter → redis.get(key)
//        - incrementCounter → redis.incrby(key, by)
//        - setCounterWithTtl → redis.set(key, value, { px: ttlMs })
//        - resetCounter → redis.del(key)
//   4. Kald setDefaultSharedStore(createRedisSharedStore()) ved app-start
//
// Indtil da: throws hvis nogen forsøger at bruge den.

import { NotImplementedError, type SharedStore } from "./adapter";

const GUIDANCE =
  "Wire Upstash Redis klient op (se lib/shared-store/redis-stub.ts) " +
  "eller registrer en anden distributed SharedStore-impl via setDefaultSharedStore().";

export function createRedisSharedStore(): SharedStore {
  return {
    async getCounter(_key) {
      throw new NotImplementedError("Redis.getCounter", GUIDANCE);
    },
    async incrementCounter(_key, _by) {
      throw new NotImplementedError("Redis.incrementCounter", GUIDANCE);
    },
    async setCounterWithTtl(_key, _value, _ttlMs) {
      throw new NotImplementedError("Redis.setCounterWithTtl", GUIDANCE);
    },
    async resetCounter(_key) {
      throw new NotImplementedError("Redis.resetCounter", GUIDANCE);
    },
  };
}
