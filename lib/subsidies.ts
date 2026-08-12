// Danske tilskudsordninger · subsidies-beregning
//
// PraxisOS understøtter at klinikker er aftalehavere hos:
//   1. Sygeforsikringen "danmark"           — privat sygesikring, største · ~2,5 mio. medlemmer
//   2. Den offentlige sygesikring            — via ydernummer (lægebehandling, fysio, kiropraktor)
//   3. Helbredstillæg (pensionister)         — kommunalt tilskud · varierer pr. kommune
//   4. Behandlingsforsikringer (privat)      — Tryg, Topdanmark, Codan, PFA · faktura sendes
//   5. Diabetiker-tilskud (kommunalt)        — fodpleje for diabetikere op til 6 gange/år
//   6. §7-tilskud (kronisk syge)             — kommunalt
//
// Hver ordning har:
//   - berettigelses-kriterier (alder, diagnose, ydelse-type)
//   - tilskuds-sats (procent eller fast beløb)
//   - max pr. år
//   - indberetnings-krav (hvilken instans, hvornår, format)

export type SubsidyScheme =
  | "danmark_g1"       // Sygesikringen "danmark" gruppe 1 (almindelig)
  | "danmark_g2"       // Gruppe 2
  | "danmark_g5"       // Gruppe 5 (børn, studerende)
  | "offentlig_g1"     // Offentlig sygesikring gruppe 1 (lægehenvisning)
  | "offentlig_g2"     // Gruppe 2 (frit valg, højere egenbetaling)
  | "helbredstillaeg"  // Kommunal pensionist-støtte
  | "diabetes"         // Kommunal støtte til fodpleje for diabetikere
  | "kronisk_p7"       // §7 til kroniske
  | "privat_forsikring";

export const SCHEME_LABEL: Record<SubsidyScheme, string> = {
  danmark_g1:        "Sygesikringen \"danmark\" · Gruppe 1",
  danmark_g2:        "Sygesikringen \"danmark\" · Gruppe 2",
  danmark_g5:        "Sygesikringen \"danmark\" · Gruppe 5",
  offentlig_g1:      "Offentlig sygesikring · Gruppe 1",
  offentlig_g2:      "Offentlig sygesikring · Gruppe 2",
  helbredstillaeg:   "Helbredstillæg · pensionist",
  diabetes:          "Diabetes-tilskud · kommunal",
  kronisk_p7:        "§7-tilskud · kronisk syg",
  privat_forsikring: "Privat behandlingsforsikring",
};

export const SCHEME_AUTHORITY: Record<SubsidyScheme, { name: string; reportingMethod: "EDI_DANMARK" | "MEDCOM" | "KOMMUNAL_API" | "MANUEL" | "FORSIKRING_API" }> = {
  danmark_g1:        { name: "Sygeforsikringen \"danmark\"",         reportingMethod: "EDI_DANMARK" },
  danmark_g2:        { name: "Sygeforsikringen \"danmark\"",         reportingMethod: "EDI_DANMARK" },
  danmark_g5:        { name: "Sygeforsikringen \"danmark\"",         reportingMethod: "EDI_DANMARK" },
  offentlig_g1:      { name: "Regionernes Lønnings- og Takstnævn",   reportingMethod: "MEDCOM" },
  offentlig_g2:      { name: "Regionernes Lønnings- og Takstnævn",   reportingMethod: "MEDCOM" },
  helbredstillaeg:   { name: "Kommunens borgerservice",              reportingMethod: "KOMMUNAL_API" },
  diabetes:          { name: "Kommunens sundhedsforvaltning",        reportingMethod: "KOMMUNAL_API" },
  kronisk_p7:        { name: "Kommunens sundhedsforvaltning",        reportingMethod: "KOMMUNAL_API" },
  privat_forsikring: { name: "Privat forsikringsselskab",            reportingMethod: "FORSIKRING_API" },
};

// -----------------------------------------------------------------------------
// Tilskuds-tabel · pr. ydelse + ordning
//   Hver post: "Hvor meget får patienten tilbage hvis de er i ordning X og får ydelse Y?"
// -----------------------------------------------------------------------------

type SubsidyRule = {
  scheme: SubsidyScheme;
  serviceId: string;
  serviceName: string;
  // Tilskud: enten en fast sats i kroner ELLER en procent
  amountKr?: number;
  percentBp?: number;       // basispoint (100bp = 1%)
  maxPerYearKr?: number;
  maxSessionsPerYear?: number;
  // Krav til at tilskuddet udløses
  requiresReferral?: boolean;
  requiresDiagnosisCode?: string[];  // ICD-10
  minAge?: number;
};

export const subsidyRules: SubsidyRule[] = [
  // Sygesikringen "danmark" — almindelig / udvidet fodbehandling
  { scheme: "danmark_g1", serviceId: "fod-std", serviceName: "Fodbehandling", amountKr: 150, maxPerYearKr: 1800 },
  { scheme: "danmark_g2", serviceId: "fod-std", serviceName: "Fodbehandling", amountKr: 100, maxPerYearKr: 1200 },
  { scheme: "danmark_g5", serviceId: "fod-std", serviceName: "Fodbehandling", amountKr: 200, maxPerYearKr: 2400 },
  { scheme: "danmark_g1", serviceId: "fod-ext", serviceName: "Udvidet fodbehandling", amountKr: 150, maxPerYearKr: 1800 },
  { scheme: "danmark_g2", serviceId: "fod-ext", serviceName: "Udvidet fodbehandling", amountKr: 100, maxPerYearKr: 1200 },

  // Sygesikringen "danmark" — luksus (kun den kliniske del refunderes ift. katalog)
  { scheme: "danmark_g1", serviceId: "fod-lux", serviceName: "Luksus fodbehandling", amountKr: 150, maxPerYearKr: 1800 },
  { scheme: "danmark_g2", serviceId: "fod-lux", serviceName: "Luksus fodbehandling", amountKr: 100, maxPerYearKr: 1200 },

  // Diabetes-tilskud — kommunalt, op til 6 fodbehandlinger/år
  { scheme: "diabetes", serviceId: "fod-std", serviceName: "Fodbehandling", percentBp: 10000, maxSessionsPerYear: 6, requiresDiagnosisCode: ["E10", "E11"] },
  { scheme: "diabetes", serviceId: "fod-ext", serviceName: "Udvidet fodbehandling", percentBp: 10000, maxSessionsPerYear: 6, requiresDiagnosisCode: ["E10", "E11"] },

  // Kronisk §7
  { scheme: "kronisk_p7", serviceId: "fod-std", serviceName: "Fodbehandling", percentBp: 10000, maxSessionsPerYear: 12, requiresReferral: true },

  // Helbredstillæg
  { scheme: "helbredstillaeg", serviceId: "fod-std", serviceName: "Fodbehandling", percentBp: 8500, maxSessionsPerYear: 12, minAge: 65 },

  // Privat behandlingsforsikring
  { scheme: "privat_forsikring", serviceId: "fod-std", serviceName: "Fodbehandling", percentBp: 10000 },
];

// -----------------------------------------------------------------------------
// Patient subsidy-profil — hvilke ordninger er patienten i?
// -----------------------------------------------------------------------------

export type PatientSubsidyProfile = {
  clientId: string;
  schemes: {
    scheme: SubsidyScheme;
    memberId?: string;       // medlemsnummer hos sygesikringen / forsikringsselskab
    validUntil?: string;
    consumedThisYearKr?: number;
    consumedThisYearSessions?: number;
  }[];
  diagnoses?: string[];      // ICD-10 koder (frivillig — bruges til auto-eligibility)
  hasReferral?: boolean;
  age: number;
};

// SEED — pr. klient
export const patientProfiles: Record<string, PatientSubsidyProfile> = {
  mette:   { clientId: "mette", age: 42, schemes: [{ scheme: "danmark_g1", memberId: "DK-4291871", consumedThisYearKr: 300 }] },
  jonas:   { clientId: "jonas", age: 51, schemes: [{ scheme: "danmark_g2", memberId: "DK-5113422" }] },
  amira:   { clientId: "amira", age: 27, schemes: [{ scheme: "danmark_g5", memberId: "DK-2741988" }] },
  per:     { clientId: "per",   age: 73, schemes: [
    { scheme: "danmark_g1", memberId: "DK-7332091", consumedThisYearKr: 450 },
    { scheme: "diabetes",   memberId: "AAR-2024-PS-119", consumedThisYearSessions: 2 },
    { scheme: "helbredstillaeg", memberId: "AAR-HT-7301" },
  ], diagnoses: ["E11.9"] },
  clara:   { clientId: "clara", age: 38, schemes: [] }, // ingen ordning
};

// -----------------------------------------------------------------------------
// Beregning · hvilke tilskud kan en patient få for en bestemt ydelse?
// -----------------------------------------------------------------------------

export type SubsidyCalculation = {
  scheme: SubsidyScheme;
  schemeLabel: string;
  subsidyKr: number;
  eligible: boolean;
  reason?: string;          // hvis ikke berettiget
  authority: string;
  reportingMethod: string;
  remainingThisYearKr?: number;
};

export function calculateSubsidies(opts: {
  serviceId: string;
  servicePriceKr: number;
  clientId: string;
}): SubsidyCalculation[] {
  const profile = patientProfiles[opts.clientId];
  if (!profile) return [];

  const matching = subsidyRules.filter((r) => r.serviceId === opts.serviceId);
  const results: SubsidyCalculation[] = [];

  for (const rule of matching) {
    const member = profile.schemes.find((s) => s.scheme === rule.scheme);
    if (!member) continue; // ikke medlem af denne ordning

    const auth = SCHEME_AUTHORITY[rule.scheme];

    // Tjek berettigelses-krav
    if (rule.minAge && profile.age < rule.minAge) {
      results.push({
        scheme: rule.scheme, schemeLabel: SCHEME_LABEL[rule.scheme],
        subsidyKr: 0, eligible: false,
        reason: `Kræver alder ≥ ${rule.minAge}`,
        authority: auth.name, reportingMethod: auth.reportingMethod,
      });
      continue;
    }

    if (rule.requiresReferral && !profile.hasReferral) {
      results.push({
        scheme: rule.scheme, schemeLabel: SCHEME_LABEL[rule.scheme],
        subsidyKr: 0, eligible: false,
        reason: "Kræver lægehenvisning",
        authority: auth.name, reportingMethod: auth.reportingMethod,
      });
      continue;
    }

    if (rule.requiresDiagnosisCode && rule.requiresDiagnosisCode.length > 0) {
      const hasDx = profile.diagnoses?.some((d) =>
        rule.requiresDiagnosisCode!.some((req) => d.startsWith(req))
      );
      if (!hasDx) {
        results.push({
          scheme: rule.scheme, schemeLabel: SCHEME_LABEL[rule.scheme],
          subsidyKr: 0, eligible: false,
          reason: `Kræver diagnose ${rule.requiresDiagnosisCode.join(" / ")}`,
          authority: auth.name, reportingMethod: auth.reportingMethod,
        });
        continue;
      }
    }

    // Beregn tilskud
    let subsidy = rule.amountKr ?? 0;
    if (rule.percentBp) {
      subsidy = Math.round((opts.servicePriceKr * rule.percentBp) / 10000);
    }

    // Cap baseret på årligt loft
    let remainingThisYear: number | undefined;
    if (rule.maxPerYearKr) {
      const consumed = member.consumedThisYearKr ?? 0;
      remainingThisYear = rule.maxPerYearKr - consumed;
      if (remainingThisYear <= 0) {
        results.push({
          scheme: rule.scheme, schemeLabel: SCHEME_LABEL[rule.scheme],
          subsidyKr: 0, eligible: false,
          reason: `Årligt loft (${rule.maxPerYearKr} kr) nået`,
          authority: auth.name, reportingMethod: auth.reportingMethod,
          remainingThisYearKr: 0,
        });
        continue;
      }
      subsidy = Math.min(subsidy, remainingThisYear);
    }

    if (rule.maxSessionsPerYear) {
      const consumed = member.consumedThisYearSessions ?? 0;
      if (consumed >= rule.maxSessionsPerYear) {
        results.push({
          scheme: rule.scheme, schemeLabel: SCHEME_LABEL[rule.scheme],
          subsidyKr: 0, eligible: false,
          reason: `Maks ${rule.maxSessionsPerYear} sessioner/år nået`,
          authority: auth.name, reportingMethod: auth.reportingMethod,
        });
        continue;
      }
    }

    // Tilskud kan aldrig overstige selve ydelses-prisen
    subsidy = Math.min(subsidy, opts.servicePriceKr);

    results.push({
      scheme: rule.scheme, schemeLabel: SCHEME_LABEL[rule.scheme],
      subsidyKr: subsidy, eligible: true,
      authority: auth.name, reportingMethod: auth.reportingMethod,
      remainingThisYearKr: remainingThisYear,
    });
  }

  return results;
}

// Vælg det højeste tilskud (vi anbefaler bedste ordning til patienten)
export function bestSubsidy(calcs: SubsidyCalculation[]): SubsidyCalculation | undefined {
  return calcs.filter((c) => c.eligible).sort((a, b) => b.subsidyKr - a.subsidyKr)[0];
}
