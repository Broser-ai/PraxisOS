import { NextResponse } from "next/server";
import { findAccount, encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { getBackoffMs, recordAttempt, requiresCaptcha, getAttempts } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { email, password, tenant, captcha } = body;
  if (!email || !password) return NextResponse.json({ error: "missing_credentials" }, { status: 400 });

  // Rate-limit check
  const backoff = getBackoffMs(ip, email);
  if (backoff > 0) {
    return NextResponse.json({
      error: "rate_limited",
      retryAfterMs: backoff,
      attempts: getAttempts(ip, email),
    }, { status: 429, headers: { "Retry-After": Math.ceil(backoff / 1000).toString() } });
  }

  // CAPTCHA-step-up (efter 3 mislykkede forsøg)
  if (requiresCaptcha(ip, email) && !captcha) {
    return NextResponse.json({
      error: "captcha_required",
      hint: "Indtast verifikation for at fortsætte",
    }, { status: 403 });
  }

  const acc = findAccount(email, password);
  if (!acc) {
    recordAttempt(ip, email, false);
    return NextResponse.json({
      error: "invalid_credentials",
      attempts: getAttempts(ip, email),
      requiresCaptcha: requiresCaptcha(ip, email),
    }, { status: 401 });
  }

  // Hvis brugeren har flere tenants og ingen er valgt, returner liste (success-state)
  if (acc.tenants.length > 1 && !tenant) {
    recordAttempt(ip, email, true);
    return NextResponse.json({
      needsTenantPick: true,
      account: { name: acc.name, initials: acc.initials, avatarColor: acc.avatarColor },
      tenants: acc.tenants,
    });
  }

  const picked = tenant ? acc.tenants.find((t) => t.slug === tenant) : acc.tenants[0];
  if (!picked) return NextResponse.json({ error: "no_tenant_access" }, { status: 403 });

  recordAttempt(ip, email, true);

  const session = encodeSession({
    accountId: acc.id,
    tenant: picked.slug,
    role: picked.role,
    loggedInAt: new Date().toISOString(),
  });

  const res = NextResponse.json({
    success: true,
    account: { id: acc.id, name: acc.name, initials: acc.initials, email: acc.email, avatarColor: acc.avatarColor, twoFAEnabled: acc.twoFAEnabled },
    tenant: picked.slug,
    role: picked.role,
  });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return res;
}
