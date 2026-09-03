// Universal API · klienter
// GET  /api/v1/{tenant}/clients
// POST /api/v1/{tenant}/clients

import { NextResponse } from "next/server";
import {
  createClientForTenant,
  dataBackend,
  listClientsForTenant,
} from "@/lib/data/repo";
import { getTenant } from "@/lib/tenants";
import { auditLog } from "@/lib/audit";
import {
  jsonAuthFail,
  requireTenantAccess,
} from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const auth = requireTenantAccess(req, tenant, {
    scopes: ["read:clients"],
    permissions: ["bookings"],
  });
  if (!auth.ok) return jsonAuthFail(auth);

  const clients = await listClientsForTenant(tenant);
  return NextResponse.json(
    {
      data: clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        age: c.age,
        tag: c.tag,
        joined: c.joined,
        lastVisit: c.lastVisit,
        consentLevel: c.consentLevel,
      })),
      meta: { count: clients.length, tenant, backend: dataBackend() },
    },
    { headers: { "access-control-allow-origin": "*" } },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const auth = requireTenantAccess(req, tenant, {
    scopes: ["write:clients"],
    permissions: ["bookings"],
  });
  if (!auth.ok) return jsonAuthFail(auth);

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    consentLevel?: "Almindelig" | "Sundhedsdata" | "Forskning";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.name || !body.email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const created = await createClientForTenant(tenant, {
    name: body.name,
    email: body.email,
    phone: body.phone,
    consentLevel: body.consentLevel,
  });
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  auditLog("client.created", {
    tenant_id: tenant,
    actor_user_id: auth.accountId,
    target_ref: `client/${created.id}`,
  });

  return NextResponse.json(
    {
      id: created.id,
      tenant,
      name: created.name,
      email: created.email,
      phone: created.phone,
      consentLevel: created.consentLevel,
      createdAt: new Date().toISOString(),
      backend: dataBackend(),
    },
    { status: 201, headers: { "access-control-allow-origin": "*" } },
  );
}
