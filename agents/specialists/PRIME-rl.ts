// PRIME · RLVR specialist (class_0 education / ops self-critique)
// Registered alongside NINA / FELIX / LUNA — never a clinical oracle.

import { runPrimeCycle } from "@/lib/prime/agent";
import { PRIME_ID, PRIME_INVARIANTS } from "@/lib/prime/types";

export { PRIME_ID };

export type PrimeSpecialistBrief = {
  tenant?: string;
  query?: string;
  sampleSize?: number;
};

export async function primeRlCycle(brief: PrimeSpecialistBrief = {}) {
  const result = runPrimeCycle({
    tenantSlug: brief.tenant ?? "bypilar",
    brief: brief.query ?? "Prime specialist RLVR probe",
    sampleSize: brief.sampleSize ?? 5,
    proposePolicy: true,
  });
  return {
    id: PRIME_ID,
    role: "RLVR · verifiable-reward e-learning + ops self-critique",
    invariants: PRIME_INVARIANTS,
    result,
  };
}
