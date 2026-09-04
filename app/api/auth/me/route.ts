import { NextResponse } from "next/server";
import { getAccountById } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
import { sessionFromRequest } from "@/lib/request-auth";
import { auditLogWithContext } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * GET /api/auth/me — staff session contract for lib/staff-session.ts
 * 200 StaffSession shape · 401 unauthorized
 * F50 · sessionFromRequest (shared cookie parse) + light auth.me audit.
 */
export async function GET(req: Request) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = getAccountById(session.accountId);
  const tenant = getTenant(session.tenant);

  auditLogWithContext(req, "auth.me", {
    tenant_id: session.tenant,
    actor_user_id: session.accountId,
    auth_mode: "session",
    meta: { role: session.role },
  });

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
