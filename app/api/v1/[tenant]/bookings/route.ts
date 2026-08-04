import { NextResponse } from "next/server";
import {
  createBookingForTenant,
  dataBackend,
} from "@/lib/data/repo";
import { drainOutbox, enqueueBookingMessages } from "@/lib/messaging/outbox";
import { sendNotification } from "@/lib/notifications/dispatch";
import { getTenant } from "@/lib/tenants";

// POST /api/v1/{tenant}/bookings — persists booking (memory or Supabase)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  let body: {
    serviceId?: string;
    startsAt?: string;
    client?: { name?: string; email?: string; phone?: string };
    modality?: "Klinik" | "Hjemmebesøg" | "Video";
    notes?: string;
    source?: "online" | "tlf" | "aria" | "embed" | "admin";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.serviceId || !body.startsAt || !body.client) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!body.client.name || !body.client.email) {
    return NextResponse.json({ error: "missing_client_fields" }, { status: 400 });
  }

  const booking = await createBookingForTenant(slug, {
    serviceId: body.serviceId,
    startsAt: body.startsAt,
    client: {
      name: body.client.name,
      email: body.client.email,
      phone: body.client.phone,
    },
    modality: body.modality,
    notes: body.notes,
    source: body.source ?? "online",
  });

  if ("error" in booking) {
    const status =
      booking.error === "tenant_not_found" || booking.error === "service_not_found"
        ? 404
        : booking.error === "slot_conflict"
          ? 409
          : 400;
    return NextResponse.json({ error: booking.error }, { status });
  }

  const idempotencyKey = req.headers.get("idempotency-key") ?? booking.id;

  const queued = enqueueBookingMessages({
    tenant: t.slug,
    bookingId: booking.id,
    clientId: booking.clientId,
    clientName: booking.clientName,
    clientPhone: body.client.phone,
    clientEmail: body.client.email,
    clinicName: t.legalName,
    serviceName: booking.service,
    startsAt: booking.startsAt,
    receiptPath: `/r/${booking.id}`,
  });
  // Immediately drain due confirms (reminders stay scheduled).
  const drained = await drainOutbox(10);

  const staffNote = await sendNotification({
    tenant: t.slug,
    kind: "booking_created",
    title: "Ny booking",
    body: `${booking.clientName} · ${booking.service} · ${new Date(booking.startsAt).toLocaleString("da-DK")}`,
    channels: ["in_app"],
    audience: "staff",
    recipientName: booking.clientName,
    bookingId: booking.id,
    clientId: booking.clientId,
  });

  return NextResponse.json(
    {
      id: booking.id,
      tenant: t.slug,
      service: {
        id: booking.serviceId,
        name: booking.service,
        durationMin: booking.durationMin,
      },
      startsAt: booking.startsAt,
      modality: booking.modality,
      client: {
        id: booking.clientId,
        name: booking.clientName,
        email: body.client.email,
        phone: body.client.phone,
      },
      status: booking.status,
      priceKr: booking.priceKr,
      idempotencyKey,
      receiptUrl: `/r/${booking.id}`,
      backend: dataBackend(),
      messaging: {
        queued: queued.map((m) => ({
          id: m.id,
          category: m.category,
          status: m.status,
          scheduledAt: m.scheduledAt,
        })),
        drained,
      },
      notification:
        "error" in staffNote
          ? { error: staffNote.error }
          : { id: staffNote.id, status: staffNote.status },
      aria: {
        reminderScheduled: queued.some((m) => m.category === "reminder_24h"),
        message:
          "Booking gemt. SMS-outbox + staff-notifikation oprettet.",
      },
    },
    { status: 201, headers: { "access-control-allow-origin": "*" } },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers":
        "content-type, idempotency-key, authorization",
      "access-control-max-age": "86400",
    },
  });
}
