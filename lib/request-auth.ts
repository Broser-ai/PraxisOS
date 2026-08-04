// Unified request auth for tenant APIs · session cookie OR verified API key

import type { ApiKey, ApiKeyScope } from "@/lib/api-keys";
import { verifyApiKey } from "@/lib/api-keys";

export type AuthOk = {
  ok: true;
  mode: "session" | "api_key";
  tenant: string;
  role?: string;
  accountId?: string;
  apiKey?: ApiKey;
};

export type AuthFail = {
  ok: false;
  status: number;
  body: { error: string; hint?: string };
};

/**
 * Authorize a tenant-scoped API call.
 * - Session: middleware injects x-praxis-tenant / role / account; tenant must match
 *   (support may access any tenant).
 * - Bearer: must verify against known API keys for that tenant + required scope.
 */
export function authorizeTenantRequest(
  req: Request,
  tenant: string,
  requiredScope?: ApiKeyScope,
): AuthOk | AuthFail {
  const sessionTenant = req.headers.get("x-praxis-tenant");
  const sessionRole = req.headers.get("x-praxis-role") ?? undefined;
  const accountId = req.headers.get("x-praxis-account") ?? undefined;

  if (sessionTenant) {
    if (sessionTenant !== tenant && sessionRole !== "support") {
      return {
        ok: false,
        status: 403,
        body: { error: "tenant_mismatch" },
      };
    }
    return {
      ok: true,
      mode: "session",
      tenant,
      role: sessionRole,
      accountId,
    };
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "unauthorized",
        hint: "Session cookie or Authorization: Bearer sk_live_...",
      },
    };
  }

  const token = auth.slice("Bearer ".length).trim();
  const verified = verifyApiKey(token, tenant, requiredScope);
  if (!verified.ok) {
    return {
      ok: false,
      status: 401,
      body: { error: verified.error },
    };
  }

  return {
    ok: true,
    mode: "api_key",
    tenant,
    apiKey: verified.key,
  };
}
