import type {
  MitidPendingAuth,
  OutboxMessage,
  PaymentIntentRecord,
} from "@/lib/integrations/types";

type IntegrationRoot = {
  outbox: OutboxMessage[];
  paymentIntents: PaymentIntentRecord[];
  mitidPending: MitidPendingAuth[];
};

const GLOBAL_KEY = "__praxisos_integrations_store_v1__";

function empty(): IntegrationRoot {
  return {
    outbox: [],
    paymentIntents: [],
    mitidPending: [],
  };
}

export function getIntegrationStore(): IntegrationRoot {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: IntegrationRoot };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = empty();
  return g[GLOBAL_KEY];
}

export function resetIntegrationStoreForTests(): void {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: IntegrationRoot };
  g[GLOBAL_KEY] = empty();
}
