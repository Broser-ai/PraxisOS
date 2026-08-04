import { NextResponse } from "next/server";
import { enqueueMessage, listOutbox } from "@/lib/messaging/outbox";
import { messagingMode, nemsmsConfigured } from "@/lib/messaging/provider";
import type { NemSmsCategory } from "@/lib/nemsms";
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

  const data = listOutbox(tenant, 100);
  return NextResponse.json({
    data,
    meta: {
      tenant,
      count: data.length,
      messagingMode: messagingMode(),
      nemsmsConfigured: nemsmsConfigured(),
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
    category?: NemSmsCategory;
    toPhone?: string;
    toEmail?: string;
    recipientName?: string;
    bookingId?: string;
    vars?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.category || !body.recipientName || !body.vars) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const created = enqueueMessage({
    tenant,
    category: body.category,
    toPhone: body.toPhone,
    toEmail: body.toEmail,
    recipientName: body.recipientName,
    bookingId: body.bookingId,
    vars: body.vars,
  });
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }
  return NextResponse.json(created, { status: 201 });
}
