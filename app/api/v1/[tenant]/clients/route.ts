// Universal API · klienter
// GET  /api/v1/{tenant}/clients
// POST /api/v1/{tenant}/clients
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { listClients } from "@/lib/clients";

function checkAuth(req: Request): { ok: true } | { ok: false; status: number; body: object } {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { ok: false, status: 401, body: { error: "unauthorized", hint: "Add Authorization: Bearer sk_live_..." } };
  }
  const token = auth.slice(7);
  if (!token.startsWith("sk_live_") && !token.startsWith("sk_test_") && !token.startsWith("pk_test_dead")) {
    return { ok: false, status: 401, body: { error: "invalid_token" } };
  }
  return { ok: true };
}

export async function GET(req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  if (!getTenant(tenant)) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const auth = checkAuth(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  return NextResponse.json({
    data: listClients().map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone, age: c.age,
      tag: c.tag, joined: c.joined, lastVisit: c.lastVisit, consentLevel: c.consentLevel,
    })),
    meta: { count: listClients().length, tenant },
  }, { headers: { "access-control-allow-origin": "*" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  if (!getTenant(tenant)) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  const auth = checkAuth(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const required = ["name", "email"];
  for (const k of required) if (!body[k]) return NextResponse.json({ error: `missing_${k}` }, { status: 400 });

  const id = "cli_" + Math.random().toString(36).slice(2, 11);
  return NextResponse.json({
    id, tenant,
    name: body.name, email: body.email, phone: body.phone ?? null,
    consentLevel: body.consentLevel ?? "Almindelig",
    createdAt: new Date().toISOString(),
  }, { status: 201, headers: { "access-control-allow-origin": "*" } });
}
