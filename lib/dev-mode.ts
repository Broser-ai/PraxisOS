// Dev-mode helpers · lokalt bypass af MDR-gate for by Pilar.
// Kontrakt: Sprint 5 · Michael's "by Pilar er komplet test-object"-mandat
//
// PRINCIP:
//   I produktion afviser vores Class IIa agent-dispatch (canDispatchAgent
//   fra lib/agents.ts) tenants uden mdr_status='ce_marked'. Men vi vil
//   have by Pilar til at kunne teste ALLE features ende-til-ende — også
//   Niels/Liv/Scanner/Atlas — uden at vente på CE-mark.
//
//   Løsning: PRAXIS_CLINICAL_DEV=1 environment-flag der KUN aktiverer
//   Class IIa-bypass for tenant 'bypilar'. Enhver anden tenant er
//   uændret · gate håndhæves stadig.
//
// SIKKERHED:
//   Denne bypass MÅ ALDRIG være aktiv i produktion. Vi tjekker i tillæg
//   NODE_ENV — hvis production + PRAXIS_CLINICAL_DEV=1 → throws.

const DEV_TENANT_SLUG = "bypilar";

/**
 * True hvis clinical-dev-mode er aktiveret AND vi ikke er i production.
 * Fail-loud i production: hvis nogen ved fejl har PRAXIS_CLINICAL_DEV=1 i
 * prod env-vars, throws vi ved første kald så det bliver opdaget straks.
 */
export function isClinicalDevModeEnabled(): boolean {
  if (process.env.PRAXIS_CLINICAL_DEV !== "1") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
    throw new Error(
      "PRAXIS_CLINICAL_DEV=1 is ENABLED but NODE_ENV=production — clinical-dev-mode " +
        "must NEVER run in production. Unset PRAXIS_CLINICAL_DEV in Vercel env.",
    );
  }
  return true;
}

/**
 * Overrider canDispatchAgent-check: hvis dev-mode + tenant=bypilar,
 * accepter Class IIa-agenter selvom mdr_status != 'ce_marked'.
 */
export function shouldBypassMdrGate(tenantSlug: string): boolean {
  return isClinicalDevModeEnabled() && tenantSlug === DEV_TENANT_SLUG;
}

/**
 * True hvis by Pilar-seed data skal loades i-memory.
 * Bruges af demo-page + tests.
 */
export function isBypilarSeedEnabled(): boolean {
  return process.env.PRAXIS_BYPILAR_SEED === "1" || isClinicalDevModeEnabled();
}
