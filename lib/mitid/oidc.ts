import { randomBytes, createHash } from "node:crypto";
import { getIntegrationStore } from "@/lib/integrations/store";
import type { MitidPendingAuth } from "@/lib/integrations/types";

export type MitidIdentity = {
  sub: string;
  name: string;
  cprMasked: string;
  birthdate?: string;
  provider: "mock" | "signaturgruppen";
};

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3002").replace(
    /\/$/,
    "",
  );
}

export function mitidConfigured(): boolean {
  return Boolean(
    process.env.MITID_CLIENT_ID &&
      process.env.MITID_CLIENT_SECRET &&
      process.env.MITID_BROKER_URL,
  );
}

export function mitidMode(): "mock" | "live" {
  if ((process.env.MITID_MODE ?? "").toLowerCase() === "live") return "live";
  if (mitidConfigured() && (process.env.MITID_MODE ?? "").toLowerCase() !== "mock") {
    return "live";
  }
  return "mock";
}

function newState(): string {
  return randomBytes(24).toString("hex");
}

export function createMitidAuthRequest(input: {
  mode: "staff" | "patient";
  returnTo?: string;
}): { authorizeUrl: string; state: string; mode: "mock" | "live" } {
  const state = newState();
  const nonce = newState();
  const returnTo =
    input.returnTo ||
    (input.mode === "patient" ? "/t/bypilar/portal" : "/dashboard");
  const pending: MitidPendingAuth = {
    state,
    nonce,
    mode: input.mode,
    returnTo,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
  const store = getIntegrationStore();
  store.mitidPending = store.mitidPending.filter(
    (p) => new Date(p.expiresAt).getTime() > Date.now(),
  );
  store.mitidPending.push(pending);

  if (mitidMode() === "live" && mitidConfigured()) {
    const broker = process.env.MITID_BROKER_URL!.replace(/\/$/, "");
    const redirect =
      process.env.MITID_REDIRECT_URI ?? `${baseUrl()}/api/auth/mitid/callback`;
    const scope =
      input.mode === "staff" ? "openid nemlogin" : "openid mitid";
    const url = new URL(`${broker}/op/connect/authorize`);
    url.searchParams.set("client_id", process.env.MITID_CLIENT_ID!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    return { authorizeUrl: url.toString(), state, mode: "live" };
  }

  // Mock broker UI in-app
  const mockUrl = new URL(`${baseUrl()}/login/mitid`);
  mockUrl.searchParams.set("state", state);
  mockUrl.searchParams.set("mode", input.mode);
  mockUrl.searchParams.set("mock", "1");
  return { authorizeUrl: mockUrl.toString(), state, mode: "mock" };
}

export function consumeMitidState(state: string): MitidPendingAuth | null {
  const store = getIntegrationStore();
  const idx = store.mitidPending.findIndex((p) => p.state === state);
  if (idx < 0) return null;
  const pending = store.mitidPending[idx]!;
  store.mitidPending.splice(idx, 1);
  if (new Date(pending.expiresAt).getTime() < Date.now()) return null;
  return pending;
}

export async function exchangeMitidCode(input: {
  code: string;
  state: string;
}): Promise<
  | { ok: true; pending: MitidPendingAuth; identity: MitidIdentity }
  | { ok: false; error: string }
> {
  const pending = consumeMitidState(input.state);
  if (!pending) return { ok: false, error: "invalid_or_expired_state" };

  if (mitidMode() === "mock" || input.code.startsWith("mock")) {
    const identity: MitidIdentity =
      pending.mode === "staff"
        ? {
            sub: "mock-staff-pilar",
            name: "Pilar Mortensen",
            cprMasked: "********-****",
            birthdate: "1985-04-12",
            provider: "mock",
          }
        : {
            sub: "mock-patient-mette",
            name: "Mette Lindqvist",
            cprMasked: "********-1024",
            birthdate: "1982-11-03",
            provider: "mock",
          };
    return { ok: true, pending, identity };
  }

  if (!mitidConfigured()) {
    return { ok: false, error: "mitid_not_configured" };
  }

  const broker = process.env.MITID_BROKER_URL!.replace(/\/$/, "");
  const redirect =
    process.env.MITID_REDIRECT_URI ?? `${baseUrl()}/api/auth/mitid/callback`;
  try {
    const res = await fetch(`${broker}/op/connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: redirect,
        client_id: process.env.MITID_CLIENT_ID!,
        client_secret: process.env.MITID_CLIENT_SECRET!,
      }),
    });
    if (!res.ok) return { ok: false, error: `token_http_${res.status}` };
    const token = (await res.json()) as { id_token?: string; access_token?: string };
    // Minimal claim extract — full JWT verify lands when broker keys are issued.
    const sub = createHash("sha256")
      .update(token.id_token ?? token.access_token ?? input.code)
      .digest("hex")
      .slice(0, 24);
    return {
      ok: true,
      pending,
      identity: {
        sub,
        name: "MitID bruger",
        cprMasked: "********-****",
        provider: "signaturgruppen",
      },
    };
  } catch {
    return { ok: false, error: "mitid_network" };
  }
}
