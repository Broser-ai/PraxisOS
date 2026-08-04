import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notifications/dispatch";
import { authorizeTenantRequest } from "@/lib/request-auth";
import { getTenant } from "@/lib/tenants";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
) {
  const { tenant, id } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const auth = authorizeTenantRequest(req, tenant, "write:clients");
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const result = markNotificationRead(tenant, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result);
}
