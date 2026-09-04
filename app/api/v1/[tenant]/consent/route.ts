// POST /api/v1/{tenant}/consent
// Public onboarding consent recorder (P0 plan §D.3 / §F17).
//
// Patient onboarding checkboxes POST here → recordConsentEvent per granted
// purpose (channel: web_onboarding). Rate-limited; no staff session required
// (patients are not logged in during onboarding). Does NOT change clinical
// policy and does NOT enable patient AI guidance.

import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import {
  hasActiveConsent,
  recordConsentEvent,
  type ConsentPurpose,
} from "@/lib/consent";
import {
  bookingRateLimit,
  clientIp,
  bookingAllowedOrigin,
} from "@/lib/public-booking-kit";
import { auditLogWithContext } from "@/lib/audit";

export const runtime = "nodejs";

const CHECKBOX_TO_PURPOSE: Record<string, ConsentPurpose> = {
  treatment: "treatment",
  journal: "journal",
  marketing: "sms_marketing",
  research: "research",
  photo_capture: "photo_capture",
  ai_processing: "ai_processing",
  sms_transactional: "sms_transactional",
};

type ConsentBody = {
  clientId?: string;
  email?: string;
  name?: string;
  phone?: string;
  consents?: Record<string, boolean>;
  consentVersion?: string;
};

function nextClientId(): string {
  return "cli_" + Math.random().toString(36).slice(2, 11);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const limit = bookingRateLimit(clientIp(req), slug);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let body: ConsentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const consents = body.consents ?? {};
  const grantedKeys = Object.entries(consents)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  if (grantedKeys.length === 0) {
    return NextResponse.json({ error: "no_consents" }, { status: 400 });
  }

  // treatment + journal are required for onboarding UX (match page.tsx gates)
  if (!consents.treatment || !consents.journal) {
    return NextResponse.json(
      { error: "required_consents_missing", required: ["treatment", "journal"] },
      { status: 400 },
    );
  }

  const clientId = (body.clientId?.trim() || nextClientId()).slice(0, 64);
  const consentVersion =
    body.consentVersion?.trim() || `${slug}-onboarding-v1`;

  // F79 · idempotent grants: skip purposes that already have an active event
  // so double-submit / back-navigation / stamdata enrich do not duplicate rows.
  const recorded: Array<{ purpose: ConsentPurpose; id: string }> = [];
  const already: ConsentPurpose[] = [];
  let sawValidPurpose = false;
  for (const key of grantedKeys) {
    const purpose = CHECKBOX_TO_PURPOSE[key];
    if (!purpose) continue;
    sawValidPurpose = true;
    const active = hasActiveConsent({
      tenantId: slug,
      clientId,
      purpose,
    });
    if (active.ok && active.source === "event") {
      already.push(purpose);
      continue;
    }
    const event = recordConsentEvent({
      tenantId: slug,
      clientId,
      eventType: "granted",
      purpose,
      consentVersion,
      channel: "web_onboarding",
      evidence: {
        email: body.email ? String(body.email).toLowerCase() : undefined,
        name: body.name ? String(body.name) : undefined,
        // No raw CPR — phone optional contact only
        phonePresent: Boolean(body.phone),
        checkbox: key,
      },
    });
    recorded.push({ purpose, id: event.id });
  }

  if (!sawValidPurpose) {
    return NextResponse.json({ error: "no_valid_purposes" }, { status: 400 });
  }

  if (recorded.length === 0 && already.length === 0) {
    return NextResponse.json({ error: "no_valid_purposes" }, { status: 400 });
  }

  const alreadyRecorded = recorded.length === 0 && already.length > 0;

  // F43 · request-context audit (ip / ua / route / request_id)
  // F79 · also emit on already-recorded so operators see idempotent retries
  auditLogWithContext(req, "consent.onboarding_batch", {
    tenant_id: slug,
    target_ref: `client/${clientId}`,
    auth_mode: "public",
    meta: {
      count: recorded.length,
      purposes: recorded.map((r) => r.purpose),
      already,
      alreadyRecorded,
      channel: "web_onboarding",
    },
  });

  const headers: Record<string, string> = { vary: "Origin" };
  const allowed = bookingAllowedOrigin(req, slug);
  if (allowed) headers["access-control-allow-origin"] = allowed;

  return NextResponse.json(
    {
      ok: true,
      clientId,
      consentVersion,
      recorded,
      already,
      alreadyRecorded,
    },
    // 200 when nothing new was written; 201 when at least one grant was created
    { status: alreadyRecorded ? 200 : 201, headers },
  );
}
