import { NextResponse } from "next/server";
import {
  accounts,
  encodeSession,
  SESSION_COOKIE,
  type Role,
} from "@/lib/auth";
import { exchangeMitidCode } from "@/lib/mitid/oidc";

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

/** OIDC callback · mock code=mock_* or live broker code */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl(req)}/login?mitid=missing_params`,
    );
  }

  const result = await exchangeMitidCode({ code, state });
  if (!result.ok) {
    return NextResponse.redirect(
      `${baseUrl(req)}/login?mitid=${encodeURIComponent(result.error)}`,
    );
  }

  const { pending, identity } = result;

  if (pending.mode === "patient") {
    // Patient portal does not use staff session cookie yet — return with identity hint.
    const dest = new URL(pending.returnTo, baseUrl(req));
    dest.searchParams.set("mitid", "ok");
    dest.searchParams.set("name", identity.name);
    return NextResponse.redirect(dest.toString());
  }

  // Staff · map mock/live identity onto demo owner for bypilar until CPR↔account link exists
  const account =
    accounts.find((a) => a.email === "pilar@bypilar.dk") ?? accounts[0];
  if (!account) {
    return NextResponse.redirect(`${baseUrl(req)}/login?mitid=no_account`);
  }
  const tenant = account.tenants[0]!;
  const token = encodeSession({
    accountId: account.id,
    tenant: tenant.slug,
    role: tenant.role as Role,
    loggedInAt: new Date().toISOString(),
  });

  const res = NextResponse.redirect(
    new URL(pending.returnTo, baseUrl(req)).toString(),
  );
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}

export async function POST(req: Request) {
  // Mock UI posts code+state as form/json
  let code = "";
  let state = "";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json()) as { code?: string; state?: string };
    code = body.code ?? "";
    state = body.state ?? "";
  } else {
    const form = await req.formData();
    code = String(form.get("code") ?? "");
    state = String(form.get("state") ?? "");
  }
  const fake = new URL(req.url);
  fake.searchParams.set("code", code || "mock_ok");
  fake.searchParams.set("state", state);
  return GET(
    new Request(fake.toString(), { headers: req.headers }),
  );
}
