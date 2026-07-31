// Public booking-endpoint kaldes af bypilar.dk widget uden session.
//
// Sprint 6 · B5 hardening (2026-07-12):
//   1. IP-rate-limit + exponential backoff (lib/rate-limit.ts, SharedStore-backed)
//   2. Origin-allowlist mod PRAXIS_BOOKING_ORIGINS (comma-separated) → 403 hvis ikke matched
//   3. Body-size cap på 8KB via content-length → 413 hvis overskredet
//
// middleware.ts har fået tilføjet /api/v1/{tenant}/bookings til PUBLIC_PATH_PATTERNS
// så cookie-check ikke ryger foran denne route.

import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getBackoffMs, recordAttempt } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 8 * 1024;

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function parseAllowlist(): string[] {
  return (process.env.PRAXIS_BOOKING_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return parseAllowlist().includes(origin);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const ip = getClientIp(req);
  const backoffMs = await getBackoffMs(ip, ip);
  if (backoffMs > 0) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: backoffMs },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(backoffMs / 1000)) },
      },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    await recordAttempt(ip, ip, false);
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const required = ["serviceId", "startsAt", "client"];
  for (const k of required) {
    if (!body[k]) {
      await recordAttempt(ip, ip, false);
      return NextResponse.json({ error: `missing_${k}` }, { status: 400 });
    }
  }

  const service = t.services.find((s) => s.id === body.serviceId);
  if (!service) {
    await recordAttempt(ip, ip, false);
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  await recordAttempt(ip, ip, true);

  const bookingId = "bk_" + Math.random().toString(36).slice(2, 11);
  const idempotencyKey = req.headers.get("idempotency-key") ?? bookingId;

  return NextResponse.json({
    id: bookingId,
    tenant: t.slug,
    service: { id: service.id, name: service.name, durationMin: service.durationMin },
    startsAt: body.startsAt,
    modality: body.modality ?? "Klinik",
    client: { name: body.client.name, email: body.client.email, phone: body.client.phone },
    status: "confirmed",
    idempotencyKey,
    receiptUrl: `/r/${bookingId}`,
    aria: {
      reminderScheduled: true,
      message: "Tak! Du modtager en bekræftelse på e-mail og en SMS-påmindelse 24 timer før.",
    },
  }, { status: 201, headers: { "access-control-allow-origin": origin! } });
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const allowOrigin = isAllowedOrigin(origin) ? (origin as string) : "null";
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": allowOrigin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, idempotency-key, authorization",
      "access-control-max-age": "86400",
    },
  });
}
