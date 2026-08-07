// Bird.com (MessageBird) · SMS / WhatsApp channel for PraxisOS
// Replaces NemSMS stub for transactional clinic messages until KOMBIT is live.
//
// Env (server-only — never NEXT_PUBLIC_*):
//   BIRD_API_KEY      — from app.bird.com → Developers → API keys (bk_eu1_… / bk_us1_…)
//   BIRD_API_BASE     — optional; default https://eu1.platform.bird.com
//   BIRD_SMS_FROM     — E.164 number or alphanumeric sender (e.g. "BYPILAR")
//   BIRD_SMS_CATEGORY — authentication | transactional | marketing (default transactional)

export type BirdSmsCategory = "authentication" | "transactional" | "marketing";

export type BirdSendSmsInput = {
  to: string;
  text: string;
  from?: string;
  category?: BirdSmsCategory;
};

export type BirdSendSmsResult =
  | { ok: true; id: string; status: string; raw?: unknown }
  | { ok: false; error: string; statusCode?: number; raw?: unknown };

function birdConfig() {
  const apiKey = process.env.BIRD_API_KEY?.trim() ?? "";
  const apiBase = (process.env.BIRD_API_BASE?.trim() || "https://eu1.platform.bird.com").replace(/\/$/, "");
  const from = process.env.BIRD_SMS_FROM?.trim() || "PraxisOS";
  const defaultCategory = (process.env.BIRD_SMS_CATEGORY?.trim() || "transactional") as BirdSmsCategory;
  return { apiKey, apiBase, from, defaultCategory };
}

export function isBirdConfigured(): boolean {
  return Boolean(birdConfig().apiKey);
}

export function getBirdPublicStatus() {
  const { apiKey, apiBase, from, defaultCategory } = birdConfig();
  return {
    configured: Boolean(apiKey),
    apiBase,
    from,
    defaultCategory,
    keyHint: apiKey ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}` : null,
  };
}

/** Normalize DK numbers like 20 12 34 56 → +4520123456 */
export function normalizePhoneE164(input: string, defaultCountry = "45"): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length === 8 && defaultCountry === "45") return `+45${digits}`;
  if (digits.startsWith(defaultCountry) && digits.length > 8) return `+${digits}`;
  return `+${digits}`;
}

export async function sendBirdSms(input: BirdSendSmsInput): Promise<BirdSendSmsResult> {
  const { apiKey, apiBase, from: defaultFrom, defaultCategory } = birdConfig();
  if (!apiKey) {
    return { ok: false, error: "BIRD_API_KEY mangler i miljøvariabler" };
  }

  const to = normalizePhoneE164(input.to);
  const from = input.from?.trim() || defaultFrom;
  const category = input.category ?? defaultCategory;
  const text = input.text.trim();
  if (!to || to.length < 8) return { ok: false, error: "Ugyldigt telefonnummer" };
  if (!text) return { ok: false, error: "Tom besked" };

  try {
    const res = await fetch(`${apiBase}/v1/sms/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to, from, text, category }),
    });

    const raw: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message = extractBirdError(raw) || `Bird HTTP ${res.status}`;
      return { ok: false, error: message, statusCode: res.status, raw };
    }

    const id = extractId(raw) ?? "unknown";
    const status = extractStatus(raw) ?? "accepted";
    return { ok: true, id, status, raw };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Netværksfejl mod Bird";
    return { ok: false, error: message };
  }
}

function extractBirdError(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const err = obj.error;
  if (err && typeof err === "object") {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  if (typeof obj.message === "string") return obj.message;
  return null;
}

function extractId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  if (typeof obj.messageId === "string") return obj.messageId;
  return null;
}

function extractStatus(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.status === "string") return obj.status;
  return null;
}
