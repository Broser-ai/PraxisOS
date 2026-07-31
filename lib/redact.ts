// PraxisOS · PII-redaktion før LLM-call og før state-persistens.
// Kontrakt: docs/harness/EPIC-1-Orchestration.md §2.5 og §3 (INV-3).
//
// Brug:
//   const clean = redactPII(rawInput);
//   const cleanState = redactState(langgraphState);
//
// INV-3: LangGraph-state, agent_runs.input/output, agent_steps.input_state/
// output_state må ALDRIG indeholde 10-cifrede CPR-strenge. Denne fil er den
// eneste kilde-sandhed for pre-LLM og pre-persist redaktion.

/** CPR-mønstre der skal redagteres. Dækker:
 *  - "010190-1234"    (kanonisk med bindestreg)
 *  - "0101901234"     (uden bindestreg)
 *  - "010190 1234"    (whitespace-varianter)
 *  Ordgrænser sikrer at "12345678901234" (14 cifre) IKKE match'es.
 */
const CPR_PATTERNS: RegExp[] = [
  /\b(\d{6})-(\d{4})\b/g,
  /\b(\d{6})\s(\d{4})\b/g,
  /\b(\d{10})\b/g,
];

/** Anden PII: telefon-numre (dansk), e-mails, IPv4. */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const DK_PHONE_PATTERN = /\b(\+45\s?)?(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})\b/g;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

export type RedactOptions = {
  /** Redagter e-mail-adresser. Default: true */
  email?: boolean;
  /** Redagter danske telefon-numre. Default: true */
  phone?: boolean;
  /** Redagter IPv4. Default: false (bruges legitimt i audit) */
  ipv4?: boolean;
};

const DEFAULT_OPTS: Required<RedactOptions> = {
  email: true,
  phone: true,
  ipv4: false,
};

/**
 * Redagter PII fra en streng. CPR bliver maskeret som "XXXXXX-1234" så de
 * sidste 4 cifre bevares (matcher clients.cpr_masked-formatet).
 */
export function redactString(input: string, opts: RedactOptions = {}): string {
  const o = { ...DEFAULT_OPTS, ...opts };
  let out = input;

  // CPR først (mest kritisk)
  out = out.replace(CPR_PATTERNS[0], (_m, _p1, p2) => `XXXXXX-${p2}`);
  out = out.replace(CPR_PATTERNS[1], (_m, _p1, p2) => `XXXXXX ${p2}`);
  out = out.replace(CPR_PATTERNS[2], (m) => {
    // 10 cifre uden separator: bevar sidste 4
    return `XXXXXX${m.slice(6)}`;
  });

  if (o.email) out = out.replace(EMAIL_PATTERN, "[EMAIL]");
  if (o.phone) out = out.replace(DK_PHONE_PATTERN, "[PHONE]");
  if (o.ipv4)  out = out.replace(IPV4_PATTERN, "[IP]");

  return out;
}

/**
 * Rekursivt redagter alle string-værdier i et objekt/array/scalar.
 * Bruges før JSON.stringify() til agent_runs.input/output og
 * agent_steps.input_state/output_state.
 */
export function redactPII<T>(value: T, opts: RedactOptions = {}): T {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value, opts) as unknown as T;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactPII(v, opts)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Whitelistede felter der aldrig må redagteres (fx cpr_hashed er allerede hashet)
    if (k === "cpr_hashed" || k === "id" || k === "tenant_id") {
      out[k] = v;
    } else {
      out[k] = redactPII(v, opts);
    }
  }
  return out as unknown as T;
}

/**
 * Bevis-funktion: returnerer true hvis strengen (JSON-stringified) ikke
 * indeholder rå CPR. Bruges i test-suite til INV-3.
 */
export function containsRawCpr(value: unknown): boolean {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  // Bemærk: samme regex som CHECK constraint i migration 0003
  return /\b\d{6}-?\d{4}\b/.test(s) || /\b\d{10}\b/.test(s);
}
