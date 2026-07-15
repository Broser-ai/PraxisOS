// Sygesikringen + factoring adapter tests
// Kontrakt: STATE-OF-THE-ART §9 Sprint 4 · Petersen operational moat

import { describe, it, expect } from "vitest";
import {
  createStubSygesikringenAdapter,
  createStubFactoringAdapter,
  serializeClaimToEdifact,
  claimSubmissionSchema,
  type ClaimSubmission,
} from "@/lib/finance/sygesikringen-factoring";

function makeClaim(overrides: Partial<ClaimSubmission> = {}): ClaimSubmission {
  return claimSubmissionSchema.parse({
    claim_id: "claim_stub_001",
    tenant_id: "bypilar",
    clinic_cvr: "12345678",
    ydernummer: "123456",
    client_cpr_hashed: "a".repeat(64),
    client_cpr_masked: "XXXXXX-1234",
    encounter_date: "2026-07-13",
    service_codes: ["8110", "8120"],
    group: "g1",
    amount_oere: 65000,
    ...overrides,
  });
}

describe("sygesikringen · claim submission stub", () => {
  it("submitClaim returns status='submitted' + EDIFACT reference", async () => {
    const adapter = createStubSygesikringenAdapter();
    const result = await adapter.submitClaim(makeClaim());
    expect(result.status).toBe("submitted");
    expect(result.edifact_reference).toContain("EDI-STUB");
    expect(result.expected_payout_days).toBe(60);
    expect(result.amount_approved_oere).toBe(Math.floor(65000 * 0.85));
  });

  it("getStatus retrieves persisted claim", async () => {
    const adapter = createStubSygesikringenAdapter();
    const submitted = await adapter.submitClaim(makeClaim({ claim_id: "claim_x" }));
    const status = await adapter.getStatus("claim_x");
    expect(status.claim_id).toBe("claim_x");
    expect(status.edifact_reference).toBe(submitted.edifact_reference);
  });

  it("getStatus for unknown claim returns 'rejected' + reason", async () => {
    const adapter = createStubSygesikringenAdapter();
    const status = await adapter.getStatus("nonexistent_claim");
    expect(status.status).toBe("rejected");
    expect(status.reject_reason).toBeTruthy();
  });
});

describe("sygesikringen · claim validation", () => {
  it("rejects invalid CVR (not 8 digits)", () => {
    expect(() => makeClaim({ clinic_cvr: "1234567" })).toThrow();
  });

  it("rejects invalid ydernummer (not 6 digits)", () => {
    expect(() => makeClaim({ ydernummer: "12345" })).toThrow();
  });

  it("rejects malformed CPR-masked field", () => {
    expect(() => makeClaim({ client_cpr_masked: "raw-cpr" })).toThrow();
  });

  it("requires at least one service_code", () => {
    expect(() => makeClaim({ service_codes: [] })).toThrow();
  });
});

describe("sygesikringen · EDIFACT serialization", () => {
  it("serialized message contains UNH header + BGM claim ref + NAD segments", () => {
    const edi = serializeClaimToEdifact(makeClaim());
    expect(edi).toContain("UNH+1+MEDRPT:D:04A");
    expect(edi).toContain("BGM+CLM+claim_stub_001");
    expect(edi).toContain("NAD+PR+12345678");
    expect(edi).toContain("NAD+PT+");
    expect(edi).toContain("MOA+66:650.00:DKK");
  });

  it("EDIFACT never contains raw CPR", () => {
    const edi = serializeClaimToEdifact(makeClaim());
    // Der er ingen 10-cifret sekvens i output (fordi vi bruger hash + masked)
    expect(edi).not.toMatch(/\b\d{10}\b/);
    expect(edi).not.toMatch(/\b\d{6}-\d{4}\b/);
  });
});

describe("factoring · stub adapter", () => {
  it("requestOffer discounts claim by ~2.5 %", async () => {
    const sygAdapter = createStubSygesikringenAdapter();
    const factAdapter = createStubFactoringAdapter();
    const claim = makeClaim();
    const claimResult = await sygAdapter.submitClaim(claim);
    const offer = await factAdapter.requestOffer(claim, claimResult);
    expect(offer.status).toBe("eligible");
    expect(offer.discount_rate_bps).toBe(250);
    expect(offer.partner).toBe("stub");
    expect(offer.advance_amount_oere).toBeLessThan(claimResult.amount_approved_oere!);
    // Advance skal være ~97.5 % af approved
    const expectedAdvance = Math.floor(claimResult.amount_approved_oere! * 0.975);
    expect(offer.advance_amount_oere).toBe(expectedAdvance);
  });

  it("acceptOffer changes status to 'advanced'", async () => {
    const factAdapter = createStubFactoringAdapter();
    const accepted = await factAdapter.acceptOffer("claim_x");
    expect(accepted.status).toBe("advanced");
    expect(accepted.advance_eta_hours).toBeLessThanOrEqual(48);
  });
});
