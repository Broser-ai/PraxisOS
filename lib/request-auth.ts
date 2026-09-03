// Unified request auth for tenant APIs · session cookie OR verified API key
//
// SECURITY: Never trust client-set x-praxis-* alone. Prefer HMAC session cookie
// (decodeSession) or verified API key. Headers are only accepted when they
// match a verified cookie session (middleware-injected or test double).

import { NextResponse } from "next/server";
import type { ApiKey, ApiKeyScope } from "@/lib/api-keys";
import { verifyApiKey } from "@/lib/api-keys";
import {
  decodeSession,
  ROLE_PERMISSIONS,
  SESSION_COOKIE,
  type Role,
  type Session,
} from "@/lib/auth";
import { getJournalEntry, type JournalEntry } from "@/lib/journal";

export type AuthOk = {
  ok: true;
  mode: "session" | "api_key";
  tenant: string;
  role?: string;
  accountId?: string;
  apiKey?: ApiKey;
  permissions?: string[];
};

export type AuthFail = {
  ok: false;
  status: number;
  body: { error: string; hint?: string };
};

export type GuardOk = AuthOk & {
  permissions: string[];
};

export type RequireTenantOpts = {
  /** API-key path — required scope when auth mode is api_key */
  scopes?: ApiKeyScope[];
  /** Session: must intersect ROLE_PERMISSIONS[role] */
  permissions?: string[];
  /** Explicit role allow-list (e.g. journal.sign) */
  roles?: Role[];
};

function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Read HMAC-verified session from Cookie header (or NextRequest cookies if present). */
export function sessionFromRequest(req: Request): Session | null {
  const withCookies = req as Request & {
    cookies?: { get: (n: string) => { value: string } | undefined };
  };
  const fromJar = withCookies.cookies?.get?.(SESSION_COOKIE)?.value;
  const token = fromJar ?? parseCookie(req, SESSION_COOKIE);
  if (!token) return null;
  return decodeSession(token);
}

/**
 * Resolve identity without requiring a tenant yet.
 * 1) Verified session cookie
 * 2) Else 401 (Bearer needs tenant — use requireTenantAccess)
 *
 * Spoofed x-praxis-* headers alone never authenticate.
 */
export function resolveRequestAuth(req: Request): AuthOk | AuthFail {
  const session = sessionFromRequest(req);
  if (session) {
    const role = session.role;
    return {
      ok: true,
      mode: "session",
      tenant: session.tenant,
      role,
      accountId: session.accountId,
      permissions: ROLE_PERMISSIONS[role] ?? [],
    };
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "unauthorized",
        hint: "Bearer requires tenant context — use requireTenantAccess",
      },
    };
  }

  return {
    ok: false,
    status: 401,
    body: {
      error: "unauthorized",
      hint: "Session cookie or Authorization: Bearer sk_live_...",
    },
  };
}

/**
 * Authorize a tenant-scoped API call.
 * - Session: HMAC cookie (preferred). Tenant must match (support may cross).
 * - Bearer: verified against known API keys for that tenant + required scope.
 * - Legacy x-praxis-* headers: accepted only when they match a verified cookie
 *   session (never alone — spoofing returns 401).
 */
export function authorizeTenantRequest(
  req: Request,
  tenant: string,
  requiredScope?: ApiKeyScope,
): AuthOk | AuthFail {
  const session = sessionFromRequest(req);
  if (session) {
    if (session.tenant !== tenant && session.role !== "support") {
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
      role: session.role,
      accountId: session.accountId,
      permissions: ROLE_PERMISSIONS[session.role] ?? [],
    };
  }

  // Reject spoofed session headers without a verified cookie
  const spoofTenant = req.headers.get("x-praxis-tenant");
  if (spoofTenant && !session) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "unauthorized",
        hint: "x-praxis-* headers require verified session cookie",
      },
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

function rolePermissions(role?: string): string[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function requirePermission(
  auth: AuthOk,
  permission: string,
): AuthOk | AuthFail {
  if (auth.mode === "api_key") {
    // API keys use scopes, not ROLE_PERMISSIONS — permission gate is session-only
    return auth;
  }
  const perms = auth.permissions ?? rolePermissions(auth.role);
  if (!perms.includes(permission)) {
    return {
      ok: false,
      status: 403,
      body: { error: "insufficient_role" },
    };
  }
  return { ...auth, permissions: perms };
}

export function requireRole(
  auth: AuthOk,
  roles: Role[],
): AuthOk | AuthFail {
  if (auth.mode === "api_key") {
    // API-key path: role list does not apply; scopes already checked
    return auth;
  }
  const role = auth.role as Role | undefined;
  if (!role || !roles.includes(role)) {
    return {
      ok: false,
      status: 403,
      body: { error: "insufficient_role" },
    };
  }
  return auth;
}

/**
 * Full tenant + role/permission/scope guard for staff APIs.
 */
export function requireTenantAccess(
  req: Request,
  tenant: string,
  opts?: RequireTenantOpts,
): GuardOk | AuthFail {
  const scope =
    opts?.scopes?.[0] ??
    (opts?.permissions?.includes("journal")
      ? ("read:journal" as ApiKeyScope)
      : undefined);

  const auth = authorizeTenantRequest(req, tenant, scope);
  if (!auth.ok) return auth;

  if (opts?.roles?.length) {
    const roleGate = requireRole(auth, opts.roles);
    if (!roleGate.ok) return roleGate;
  }

  if (opts?.permissions?.length && auth.mode === "session") {
    for (const p of opts.permissions) {
      const permGate = requirePermission(auth, p);
      if (!permGate.ok) return permGate;
    }
  }

  // API key: if multiple scopes listed, require at least one (authorizeTenantRequest
  // already checked the primary). Extra write scopes verified here when provided.
  if (auth.mode === "api_key" && opts?.scopes && opts.scopes.length > 1) {
    const key = auth.apiKey!;
    const ok = opts.scopes.some(
      (s) => key.scopes.includes("*") || key.scopes.includes(s),
    );
    if (!ok) {
      return {
        ok: false,
        status: 403,
        body: { error: "insufficient_scope" },
      };
    }
  }

  const permissions =
    auth.mode === "session"
      ? (auth.permissions ?? rolePermissions(auth.role))
      : opts?.scopes ?? [];

  return {
    ...auth,
    permissions,
  };
}

/**
 * Load journal entry and enforce tenant + journal permission.
 * Missing entry → 404 (no leakage of other tenants via timing of role check).
 */
export function requireJournalAccess(
  req: Request,
  journalId: string,
  opts?: RequireTenantOpts & { write?: boolean },
): (GuardOk & { entry: JournalEntry }) | AuthFail {
  const entry = getJournalEntry(journalId);
  if (!entry) {
    return {
      ok: false,
      status: 404,
      body: { error: "not_found" },
    };
  }

  const scopes: ApiKeyScope[] = opts?.write
    ? ["write:journal"]
    : opts?.scopes ?? ["read:journal"];

  const auth = requireTenantAccess(req, entry.tenant, {
    permissions: opts?.permissions ?? ["journal"],
    roles: opts?.roles ?? ["owner", "practitioner", "support"],
    scopes,
  });
  if (!auth.ok) return auth;

  return { ...auth, entry };
}

export function jsonAuthFail(fail: AuthFail): NextResponse {
  return NextResponse.json(fail.body, { status: fail.status });
}
