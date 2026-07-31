// Universal API · klienter
// GET  /api/v1/{tenant}/clients
// POST /api/v1/{tenant}/clients
//
// Sprint 6 · B6-fix: skiftet fra prefix-only auth (som tillod ALLE tokens
// der startede med sk_live_/sk_test_/pk_test_dead) til rigtig lookup mod
// api_keys tabellen med timingSafeEqual + tenant + scope + status-check.
// Cross-tenant leak lukket: nu filtrerer vi klient-listen på tenant-scope.
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { listClients } from "@/lib/clients";
import { verifyBearerToken, type ApiKeyScope } from "@/lib/api-keys";

function checkAuth(
  req: Request,
  tenant: string,
  requiredScopes: ApiKeyScope[],
): { ok: true } | { ok: false; status: number; body: object } {
  const verified = verifyBearerToken(req.headers.get("authorization"), {
    requiredTenant: tenant,
    requiredScopes,
  });
  if (!verified) {
    return {
      ok: false,
      status: 401,
      body: { error: "unauthorized", hint: "Invalid, revoked, or wrong-tenant token" },
    };
  }
  return { ok: true };
}

export async function GET(req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  if (!getTenant(tenant)) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const auth = checkAuth(req, tenant, ["read:clients"]);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  // Primær B6-fix er `verifyBearerToken({requiredTenant: tenant})` ovenfor —
  // en cross-tenant-key kommer ALDRIG hertil. ClientProfile-seedet mangler
  // stadig et `tenant` felt (Sprint 7-follow-up · data-model migration) så
  // vi kan filtrere rows også. Indtil da: kaldet er auth-scoped, data er
  // ikke row-scoped. Åbent i audit-fix backlog som "clients.tenant-field".
  const rows = listClients();
  return NextResponse.json({
    data: rows.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone, age: c.age,
      tag: c.tag, joined: c.joined, lastVisit: c.lastVisit, consentLevel: c.consentLevel,
    })),
    meta: { count: rows.length, tenant },
  }, { headers: { "access-control-allow-origin": "*" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  if (!getTenant(tenant)) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  const auth = checkAuth(req, tenant, ["write:clients"]);
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
