import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { auditLogWithContext } from "@/lib/audit";
import { sessionFromRequest } from "@/lib/request-auth";

/** F55 · logout clears session cookie + optional audit when session present. */
export async function POST(req: Request) {
  const session = sessionFromRequest(req);
  if (session) {
    auditLogWithContext(req, "logout.success", {
      tenant_id: session.tenant,
      actor_user_id: session.accountId,
      auth_mode: "session",
      meta: { role: session.role },
    });
  } else {
    auditLogWithContext(req, "logout.success", {
      auth_mode: "public",
      meta: { anonymous: true },
    });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
