import { NextRequest, NextResponse } from "next/server";
import { isBirdConfigured, sendBirdSms, type BirdSmsCategory } from "@/lib/bird";
import { auditLog } from "@/lib/audit";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";

export const runtime = "nodejs";

type Body = {
  to?: string;
  text?: string;
  from?: string;
  category?: BirdSmsCategory;
};

export async function POST(req: NextRequest) {
  // Staff-only SMS gateway — was previously unauthenticated (open SMS).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);

  // Transactional SMS: reception+ (bookings permission). Marketing: owner/support.
  const roleGate = requireRole(auth as AuthOk, [
    "reception",
    "practitioner",
    "owner",
    "support",
  ]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);

  if (!isBirdConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Bird er ikke konfigureret (BIRD_API_KEY mangler)" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig JSON" }, { status: 400 });
  }

  const to = body.to?.trim();
  const text = body.text?.trim();
  if (!to || !text) {
    return NextResponse.json({ ok: false, error: "Kræver 'to' og 'text'" }, { status: 400 });
  }

  const category = body.category ?? "transactional";
  if (category === "marketing") {
    const marketingGate = requireRole(auth as AuthOk, ["owner", "support"]);
    if (!marketingGate.ok) return jsonAuthFail(marketingGate);
  }

  const result = await sendBirdSms({
    to,
    text,
    from: body.from,
    category,
  });

  auditLog("sms.sent", {
    tenant_id: (auth as AuthOk).tenant,
    actor_user_id: (auth as AuthOk).accountId,
    target_ref: `sms/${to}`,
    meta: { category, ok: result.ok },
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.statusCode && result.statusCode < 500 ? 400 : 502 });
  }

  return NextResponse.json(result, { status: 202 });
}
