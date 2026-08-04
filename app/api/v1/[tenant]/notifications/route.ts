import { NextResponse } from "next/server";
import type {
  NotificationChannel,
  NotificationKind,
} from "@/lib/integrations/types";
import {
  listNotifications,
  sendNotification,
} from "@/lib/notifications/dispatch";
import { authorizeTenantRequest } from "@/lib/request-auth";
import { getTenant } from "@/lib/tenants";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const auth = authorizeTenantRequest(req, tenant, "read:clients");
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const data = listNotifications(tenant, { unreadOnly, limit: 100 });
  return NextResponse.json({
    data,
    meta: {
      tenant,
      count: data.length,
      unread: data.filter((n) => !n.readAt && n.channels.includes("in_app")).length,
      auth: auth.mode,
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const auth = authorizeTenantRequest(req, tenant, "write:clients");
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  let body: {
    kind?: NotificationKind;
    title?: string;
    body?: string;
    channels?: NotificationChannel[];
    audience?: "staff" | "client" | "both";
    recipientName?: string;
    toPhone?: string;
    toEmail?: string;
    bookingId?: string;
    clientId?: string;
    flush?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.title || !body.body) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const created = await sendNotification({
    tenant,
    kind: body.kind ?? "custom",
    title: body.title,
    body: body.body,
    channels: body.channels,
    audience: body.audience,
    recipientName: body.recipientName,
    toPhone: body.toPhone,
    toEmail: body.toEmail,
    bookingId: body.bookingId,
    clientId: body.clientId,
    flush: body.flush ?? true,
  });
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }
  return NextResponse.json(created, { status: 201 });
}
