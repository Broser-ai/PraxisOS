import { NextRequest, NextResponse } from "next/server";
import { getAlphaxivOverview, getAlphaxivPaper } from "@/lib/alphaxiv";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string; arxivId: string }> },
) {
  const { tenant, arxivId } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || (session.tenant !== tenant && session.role !== "support")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const paper = await getAlphaxivPaper(arxivId);
  if (!paper) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const wantOverview = new URL(req.url).searchParams.get("overview") === "1";
  const overview = wantOverview ? await getAlphaxivOverview(arxivId) : null;

  return NextResponse.json({
    data: paper,
    overview,
    tenant,
  });
}
