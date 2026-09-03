// F42 · Captcha verify (Cloudflare Turnstile / hCaptcha)
//
// Feature-flagged real verify when secrets are present.
// Dev / no-keys behaviour is documented below — production fail-closed optional.
//
// Env:
//   CAPTCHA_PROVIDER=turnstile|hcaptcha|none   (optional; auto-detect from keys)
//   TURNSTILE_SECRET_KEY=…                     Cloudflare Turnstile secret
//   HCAPTCHA_SECRET_KEY=…                      hCaptcha secret
//   CAPTCHA_FAIL_CLOSED=1                      When required + no keys in prod → reject
//                                              (default ON when NODE_ENV=production)
//   CAPTCHA_DEV_BYPASS=1                       Non-prod: accept any non-empty token
//                                              without calling provider (default ON outside prod)
//
// Stub path (no keys):
//   - Development: non-empty token accepted as bypass (logged via meta.bypass).
//   - Production + CAPTCHA_FAIL_CLOSED (default): required captcha → captcha_unavailable.
//   - Production + CAPTCHA_FAIL_CLOSED=0: treat like missing provider (reject required).

export type CaptchaProvider = "turnstile" | "hcaptcha" | "none";

export type CaptchaVerifyOk = {
  ok: true;
  provider: CaptchaProvider;
  bypass?: boolean;
};

export type CaptchaVerifyFail = {
  ok: false;
  error:
    | "captcha_required"
    | "captcha_invalid"
    | "captcha_unavailable"
    | "captcha_provider_error";
  hint?: string;
};

export type CaptchaVerifyResult = CaptchaVerifyOk | CaptchaVerifyFail;

function envFlag(name: string, defaultOn: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultOn;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export function resolveCaptchaProvider(): CaptchaProvider {
  const explicit = (process.env.CAPTCHA_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "turnstile" || explicit === "hcaptcha" || explicit === "none") {
    return explicit;
  }
  if (process.env.TURNSTILE_SECRET_KEY?.trim()) return "turnstile";
  if (process.env.HCAPTCHA_SECRET_KEY?.trim()) return "hcaptcha";
  return "none";
}

export function captchaKeysConfigured(provider?: CaptchaProvider): boolean {
  const p = provider ?? resolveCaptchaProvider();
  if (p === "turnstile") return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
  if (p === "hcaptcha") return Boolean(process.env.HCAPTCHA_SECRET_KEY?.trim());
  return false;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Whether missing/unconfigured captcha should fail when a token is required. */
export function captchaFailClosed(): boolean {
  return envFlag("CAPTCHA_FAIL_CLOSED", isProduction());
}

function captchaDevBypass(): boolean {
  return envFlag("CAPTCHA_DEV_BYPASS", !isProduction());
}

async function verifyTurnstile(
  token: string,
  ip?: string,
): Promise<CaptchaVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY!.trim();
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } },
    );
    const data = (await res.json()) as { success?: boolean };
    if (data.success) return { ok: true, provider: "turnstile" };
    return { ok: false, error: "captcha_invalid", hint: "Turnstile verification failed" };
  } catch {
    return {
      ok: false,
      error: "captcha_provider_error",
      hint: "Turnstile unreachable",
    };
  }
}

async function verifyHcaptcha(
  token: string,
  ip?: string,
): Promise<CaptchaVerifyResult> {
  const secret = process.env.HCAPTCHA_SECRET_KEY!.trim();
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const data = (await res.json()) as { success?: boolean };
    if (data.success) return { ok: true, provider: "hcaptcha" };
    return { ok: false, error: "captcha_invalid", hint: "hCaptcha verification failed" };
  } catch {
    return {
      ok: false,
      error: "captcha_provider_error",
      hint: "hCaptcha unreachable",
    };
  }
}

/**
 * Verify a captcha token when required, or when a token is supplied.
 *
 * @param required — true after rate-limit step-up (requiresCaptcha)
 */
export async function verifyCaptchaToken(opts: {
  token?: string | null;
  ip?: string;
  required?: boolean;
}): Promise<CaptchaVerifyResult> {
  const token = opts.token?.trim() ?? "";
  const required = opts.required === true;

  if (!token) {
    if (required) {
      return {
        ok: false,
        error: "captcha_required",
        hint: "Captcha token required",
      };
    }
    return { ok: true, provider: "none", bypass: true };
  }

  const provider = resolveCaptchaProvider();

  if (provider === "turnstile" && captchaKeysConfigured("turnstile")) {
    return verifyTurnstile(token, opts.ip);
  }
  if (provider === "hcaptcha" && captchaKeysConfigured("hcaptcha")) {
    return verifyHcaptcha(token, opts.ip);
  }

  // No real keys — stub / fail-closed
  if (required && captchaFailClosed() && isProduction()) {
    return {
      ok: false,
      error: "captcha_unavailable",
      hint:
        "Captcha required but TURNSTILE_SECRET_KEY / HCAPTCHA_SECRET_KEY not configured (fail-closed)",
    };
  }

  if (captchaDevBypass() || !isProduction()) {
    // Documented mock/dev bypass: any non-empty token accepted when no keys.
    return { ok: true, provider: "none", bypass: true };
  }

  // Production, fail-closed off, but still required without keys → reject
  if (required) {
    return {
      ok: false,
      error: "captcha_unavailable",
      hint: "Captcha provider not configured",
    };
  }

  return { ok: true, provider: "none", bypass: true };
}
