import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  decodeSession,
  getAccountById,
  ROLE_LABEL,
} from "@/lib/auth";
import { getTenant } from "@/lib/tenants";

/** GET /api/auth/me — current signed session + account (staff UI tenant source). */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const session = decodeSession(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = getAccountById(session.accountId);
  const tenant = getTenant(session.tenant);

  return NextResponse.json({
    accountId: session.accountId,
    tenant: session.tenant,
    role: session.role,
    roleLabel: ROLE_LABEL[session.role],
    loggedInAt: session.loggedInAt,
    name: account?.name ?? null,
    email: account?.email ?? null,
    initials: account?.initials ?? null,
    tenants: account?.tenants ?? [{ slug: session.tenant, role: session.role }],
    tenantName: tenant?.legalName ?? session.tenant,
    services: (tenant?.services ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      priceKr: s.priceKr,
    })),
  });
}
