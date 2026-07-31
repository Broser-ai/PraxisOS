// PraxisOS · Env-var validation (Sprint 6 Batch 3 · relateret til SEC-12/SEC-14)
//
// Kontrakt (COMPLETE-AUDIT-REPORT.md · Batch 3 mandate):
//   Fejl-tidligt-boot: production-runtime skal validere env-vars ved app-start
//   fremfor lazily-fejle midt i en klinisk request. Non-required vars forbliver
//   frivillige · vi throw'er kun hvis required-vars mangler i production.
//
// Design:
//   * zod.object({...}) med hver env-var typed
//   * Production-required: PRAXIS_SESSION_SECRET, SUPABASE_SERVICE_ROLE_KEY,
//     NEXT_PUBLIC_SUPABASE_URL (klient-koden kan ikke virke uden dem).
//   * Adapter-required (live-mode) valideres af hver adapter selv; her holder
//     vi kun sanity-tjek paa PRAXIS_*-flag-vaerdier.
//   * Alle andre er .optional() med sensible defaults hvor relevant.
//
// Brug:
//   import { getEnv } from "@/lib/env";           // parsed & typed accessor
//   import { validateEnvOrThrow } from "@/lib/env"; // kald i middleware / boot
//
// I production: foerste getEnv()-kald smider ZodError hvis required-vars mangler.
// I dev/test: warn + fallback saa unit-tests kan koere uden fuld .env-fil.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema · required-i-prod markeres eksplicit via computed .optional()
// ---------------------------------------------------------------------------

function isProdEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

// Streng string-schema der forlanger min-laengde og forbyder placeholders.
const secret = (min: number) =>
  z
    .string()
    .min(min, `must be at least ${min} chars`)
    .refine((s) => !/^(demo|test|dev|change-?me)$/i.test(s), {
      message: "placeholder-vaerdi ikke tilladt i production",
    });

function buildSchema() {
  const prod = isProdEnv();
  return z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),

    PRAXIS_SESSION_SECRET: prod ? secret(32) : z.string().min(16).optional(),

    NEXT_PUBLIC_SUPABASE_URL: prod ? z.string().url() : z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: prod ? secret(40) : z.string().min(20).optional(),
    PRAXIS_DB: z.enum(["memory", "supabase"]).default("memory"),

    PRAXIS_AUDIT_MODE: z.enum(["memory", "supabase"]).default("memory"),

    PRAXIS_EVENTS_SECRET: prod ? secret(24) : z.string().min(16).optional(),

    PRAXIS_MCP_ORIGINS: z.string().optional(),

    PRAXIS_CLINICAL_DEV: z
      .string()
      .optional()
      .refine((v) => !(isProdEnv() && v === "1"), {
        message: "PRAXIS_CLINICAL_DEV maa ikke vaere sat i production",
      }),

    PRAXIS_LLM_MODE: z.enum(["mock", "live"]).optional(),
    PRAXIS_VOICE_MODE: z.enum(["mock", "live"]).optional(),
    PRAXIS_EMBEDDINGS_MODE: z.enum(["mock", "live"]).optional(),
    PRAXIS_GAIT_MODE: z.enum(["mock", "live"]).optional(),
    PRAXIS_SPRG_ALLOW_MOCK: z.enum(["0", "1"]).optional(),
    PRAXIS_MILL_MODE: z.enum(["mock", "live"]).optional(),

    ANTHROPIC_API_KEY: z.string().optional(),
    DEEPGRAM_API_KEY: z.string().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),
    LIVEKIT_URL: z.string().url().optional(),
    REPLICATE_API_TOKEN: z.string().optional(),
    REPLICATE_LIFTER_VERSION: z.string().optional(),
    VOYAGE_API_KEY: z.string().optional(),
    HF_INFERENCE_API_KEY: z.string().optional(),
    ROBOFLOW_API_KEY: z.string().optional(),
    ROBOFLOW_MCP_URL: z.string().url().optional(),
    MEDSAM_URL: z.string().url().optional(),
    MEDIAPIPE_ENABLED: z.enum(["0", "1"]).optional(),
    MILL_API_URL: z.string().url().optional(),
    MILL_API_KEY: z.string().optional(),
    SYGESIKRINGEN_API_KEY: z.string().optional(),
    FACTORING_API_KEY: z.string().optional(),
    FOOT_SCANNER_URL: z.string().url().optional(),
    FOOT_SCANNER_TOKEN: z
      .string()
      .optional()
      .refine((v) => !(isProdEnv() && v === "dev-token-change-me"), {
        message: "FOOT_SCANNER_TOKEN maa ikke vaere default-vaerdien i production",
      }),

    AGENT_ORCHESTRATION_ENABLED: z.enum(["0", "1"]).optional(),
    AGENT_LEARNING_ENABLED: z.enum(["0", "1"]).optional(),

    PRAXIS_RATE_LIMIT_EDGE: z.enum(["off", "on"]).default("on"),
    PRAXIS_CSP_REPORT_URI: z.string().url().optional(),
  });
}

export type Env = z.infer<ReturnType<typeof buildSchema>>;

let cached: Env | null = null;
let cachedError: z.ZodError | null = null;

function parseNow(): Env {
  const parsed = buildSchema().safeParse(process.env);
  if (!parsed.success) {
    cachedError = parsed.error;
    if (isProdEnv()) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(
        `[praxisos/env] Production env-validation failed:\n${issues}`,
      );
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[praxisos/env] env-validation warnings (non-prod, ikke-fatalt):",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
    return process.env as unknown as Env;
  }
  cachedError = null;
  return parsed.data;
}

export function getEnv(): Env {
  if (!cached) cached = parseNow();
  return cached;
}

export function validateEnvOrThrow(): Env {
  cached = null;
  return getEnv();
}

export function _resetEnvCacheForTests(): void {
  cached = null;
  cachedError = null;
}

export function lastEnvError(): z.ZodError | null {
  return cachedError;
}
