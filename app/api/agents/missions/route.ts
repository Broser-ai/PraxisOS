/**
 * `/api/agents/missions` — thin alias onto Prime Execution Control.
 *
 * Canonical surface remains `/api/v1/[tenant]/prime/missions`.
 * This tree exists so BUILD prompts that list `/api/agents/missions*` resolve
 * without duplicating mission domain logic. Same auth + invariants.
 */
import { NextRequest } from "next/server";
import {
  GET as primeGet,
  POST as primePost,
} from "@/app/api/v1/[tenant]/prime/missions/route";

export const runtime = "nodejs";

const DEFAULT_TENANT = "bypilar";

function tenantFromSearch(req: NextRequest): string {
  return req.nextUrl.searchParams.get("tenant")?.trim() || DEFAULT_TENANT;
}

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

/** GET — same views as prime missions (`list`, `mission`, `workstreams`, …). */
export async function GET(req: NextRequest) {
  return primeGet(req, ctx(tenantFromSearch(req)));
}

/**
 * POST — same actions as prime missions.
 * Optional `tenant` in JSON body (defaults to bypilar); body is re-issued so
 * the canonical handler can read it once.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const tenant =
    typeof body.tenant === "string" && body.tenant.trim()
      ? body.tenant.trim()
      : tenantFromSearch(req);

  const headers = new Headers(req.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const forwarded = new NextRequest(req.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return primePost(forwarded, ctx(tenant));
}
