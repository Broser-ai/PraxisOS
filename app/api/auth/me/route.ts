import { NextResponse } from "next/server";
import {
  decodeSession,
  getAccountById,
  SESSION_COOKIE,
} from "@/lib/auth";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

/**
 * GET /api/auth/me — staff session contract for lib/staff-session.ts
 * 200 StaffSession shape · 401 unauthorized
 */
export async function GET(req: Request) {
  const withCookies = req as Request & {
    cookies?: { get: (n: string) => { value: string } | undefined };
  };
  const fromJar = withCookies.cookies?.get?.(SESSION_COOKIE)?.value;
  let token = fromJar;
  if (!token) {
    const header = req.headers.get("cookie") ?? "";
    const match = header.match(/(?:^|;\s*)praxis_session=([^;]*)/);
    token = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }

  const session = decodeSession(token ?? "");
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = getAccountById(session.accountId);
  const tenant = getTenant(session.tenant);

  return NextResponse.json({
    accountId: session.accountId,
    tenant: session.tenant,
    role: session.role,
    name: account?.name ?? null,
    email: account?.email ?? null,
    initials: account?.initials ?? null,
    tenantName: tenant?.brand?.name ?? session.tenant,
  });
}
