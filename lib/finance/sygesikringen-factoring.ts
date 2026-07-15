// Sygesikringen "danmark" claim + factoring-partner adapter.
// Kontrakt: STATE-OF-THE-ART §9 Sprint 4 · Petersen operational moat
//
// PROBLEM (Petersen):
//   Reimbursement flow: fra scan til Sygesikringen payout er 60-120 dage.
//   Klinikker bærer working capital. Factoring-partner (Aros Finans / Danske
//   Fond) kan discounte claim med 2-4 % → klinik får 48-timers payout.
//
// STAKEHOLDERS:
//   - Sygesikringen "danmark" · EDIFACT D04A afregnings-format
//   - Factoring-partner (Aros Finans, Danske Bank Erhverv, Alektum)
//   - Klinik-CVR · SE-nummer · ydernummer
//
// FAILSAFE:
//   Mangler SYGESIKRINGEN_API_KEY / FACTORING_API_KEY → deterministisk stub.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Types · claim submission
// ---------------------------------------------------------------------------

export const sygesikringenGroupSchema = z.enum([
  "g1",   // danmark gruppe 1 (~85% tilskud)
  "g2",   // danmark gruppe 2 (~50%)
  "g5",   // gruppe 5 (~85% udvidet)
]);
export type SygesikringenGroup = z.infer<typeof sygesikringenGroupSchema>;

export const claimStatusSchema = z.enum([
  "draft",
  "submitted",
  "acknowledged",
  "approved",
  "paid",
  "rejected",
  "disputed",
]);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const factoringStatusSchema = z.enum([
  "eligible",
  "declined",
  "advanced",       // klinik har fået penge
  "settled",        // sygesikringen har betalt factoring-partner
  "in_dispute",
]);
export type FactoringStatus = z.infer<typeof factoringStatusSchema>;

// ---------------------------------------------------------------------------
// Claim schema
// ---------------------------------------------------------------------------

export const claimSubmissionSchema = z.object({
  claim_id: z.string(),
  tenant_id: z.string(),
  clinic_cvr: z.string().regex(/^\d{8}$/, "CVR must be 8 digits"),
  ydernummer: z.string().regex(/^\d{6}$/, "ydernummer 6 digits"),
  // NB: aldrig rå CPR i denne struct · brug hashed reference
  client_cpr_hashed: z.string().min(20),
  client_cpr_masked: z.string().regex(/^X{6}-\d{4}$/, "must be masked XXXXXX-NNNN"),
  encounter_date: z.string().date(),
  service_codes: z.array(z.string()).min(1),   // Sygesikringens ydelseskoder
  group: sygesikringenGroupSchema,
  amount_oere: z.number().int().nonnegative(),
  vat_included: z.boolean().default(true),
  // Reference til finding + configuration som klinisk begrundelse
  reason_references: z
    .object({
      finding_ids: z.array(z.string()).optional(),
      orthotic_config_id: z.string().optional(),
    })
    .optional(),
});
export type ClaimSubmission = z.infer<typeof claimSubmissionSchema>;

export const claimResultSchema = z.object({
  claim_id: z.string(),
  status: claimStatusSchema,
  submitted_at: z.string().datetime(),
  edifact_reference: z.string().optional(),
  expected_payout_days: z.number().int().nonnegative().optional(),
  amount_approved_oere: z.number().int().nonnegative().optional(),
  reject_reason: z.string().optional(),
});
export type ClaimResult = z.infer<typeof claimResultSchema>;

export const factoringOfferSchema = z.object({
  claim_id: z.string(),
  status: factoringStatusSchema,
  advance_amount_oere: z.number().int().nonnegative(),  // hvad klinik får udbetalt
  discount_rate_bps: z.number().int().min(0).max(1000), // 200 = 2 %
  advance_eta_hours: z.number().nonnegative(),           // typisk 24-48
  partner: z.enum(["aros-finans", "danske-bank-erhverv", "alektum", "stub"]),
});
export type FactoringOffer = z.infer<typeof factoringOfferSchema>;

// ---------------------------------------------------------------------------
// EDIFACT D04A serializer (Sygesikringen "danmark"-format, minimal subset)
// ---------------------------------------------------------------------------

/**
 * Serialiser en claim til EDIFACT D04A message. Real Sygesikringen-format
 * er kompleks; vi laver et minimalt gyldigt subset som stub.
 */
export function serializeClaimToEdifact(claim: ClaimSubmission): string {
  const lines = [
    "UNH+1+MEDRPT:D:04A:UN:DANM01",
    `BGM+CLM+${claim.claim_id}+9`,
    `DTM+137:${claim.encounter_date.replace(/-/g, "")}:102`,
    `NAD+PR+${claim.clinic_cvr}::ZZZ::${claim.ydernummer}`,
    // Client identifikation via hashed CPR (aldrig rå)
    `NAD+PT+${claim.client_cpr_hashed.slice(0, 32)}::9`,
    ...claim.service_codes.map(
      (code, i) => `LIN+${i + 1}++${code}:${claim.group.toUpperCase()}`,
    ),
    `MOA+66:${(claim.amount_oere / 100).toFixed(2)}:DKK`,
    `UNT+${5 + claim.service_codes.length}+1`,
  ];
  return lines.join("'\n") + "'";
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface SygesikringenAdapter {
  submitClaim(claim: ClaimSubmission): Promise<ClaimResult>;
  getStatus(claimId: string): Promise<ClaimResult>;
}

export interface FactoringAdapter {
  requestOffer(claim: ClaimSubmission, claimResult: ClaimResult): Promise<FactoringOffer>;
  acceptOffer(claimId: string): Promise<FactoringOffer>;
}

// ---------------------------------------------------------------------------
// Stub adapters
// ---------------------------------------------------------------------------

const STUB_CLAIM_STORE = new Map<string, ClaimResult>();

export function createStubSygesikringenAdapter(): SygesikringenAdapter {
  return {
    async submitClaim(claim) {
      const parsed = claimSubmissionSchema.parse(claim);
      const result: ClaimResult = {
        claim_id: parsed.claim_id,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        edifact_reference: `EDI-STUB-${parsed.claim_id.slice(-8)}`,
        expected_payout_days: 60,
        amount_approved_oere: Math.floor(parsed.amount_oere * 0.85),
      };
      STUB_CLAIM_STORE.set(parsed.claim_id, result);
      return result;
    },
    async getStatus(claimId) {
      return (
        STUB_CLAIM_STORE.get(claimId) ?? {
          claim_id: claimId,
          status: "rejected",
          submitted_at: new Date().toISOString(),
          reject_reason: "unknown claim_id in stub store",
        }
      );
    },
  };
}

export function createStubFactoringAdapter(): FactoringAdapter {
  return {
    async requestOffer(claim, claimResult) {
      const approved = claimResult.amount_approved_oere ?? claim.amount_oere;
      const discountBps = 250; // 2.5 %
      const advance = Math.floor(approved * (1 - discountBps / 10_000));
      return {
        claim_id: claim.claim_id,
        status: "eligible",
        advance_amount_oere: advance,
        discount_rate_bps: discountBps,
        advance_eta_hours: 48,
        partner: "stub",
      };
    },
    async acceptOffer(claimId) {
      return {
        claim_id: claimId,
        status: "advanced",
        advance_amount_oere: 0,
        discount_rate_bps: 250,
        advance_eta_hours: 24,
        partner: "stub",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Live placeholders — fallback til stub når API-keys mangler
// ---------------------------------------------------------------------------

export function createLiveSygesikringenAdapter(): SygesikringenAdapter {
  return {
    async submitClaim(claim) {
      if (!process.env.SYGESIKRINGEN_API_KEY) {
        console.log("API Key Missing (SYGESIKRINGEN_API_KEY) — stubbing submitClaim");
        return createStubSygesikringenAdapter().submitClaim(claim);
      }
      // Real impl: POST EDIFACT til MedCom VANS · out of scope for scaffold
      return createStubSygesikringenAdapter().submitClaim(claim);
    },
    async getStatus(claimId) {
      if (!process.env.SYGESIKRINGEN_API_KEY) {
        return createStubSygesikringenAdapter().getStatus(claimId);
      }
      return createStubSygesikringenAdapter().getStatus(claimId);
    },
  };
}

export function createLiveFactoringAdapter(): FactoringAdapter {
  return {
    async requestOffer(claim, claimResult) {
      if (!process.env.FACTORING_API_KEY) {
        console.log("API Key Missing (FACTORING_API_KEY) — stubbing requestOffer");
      }
      return createStubFactoringAdapter().requestOffer(claim, claimResult);
    },
    async acceptOffer(claimId) {
      return createStubFactoringAdapter().acceptOffer(claimId);
    },
  };
}

export function createDefaultSygesikringenAdapter(): SygesikringenAdapter {
  return process.env.SYGESIKRINGEN_API_KEY
    ? createLiveSygesikringenAdapter()
    : createStubSygesikringenAdapter();
}

export function createDefaultFactoringAdapter(): FactoringAdapter {
  return process.env.FACTORING_API_KEY
    ? createLiveFactoringAdapter()
    : createStubFactoringAdapter();
}
