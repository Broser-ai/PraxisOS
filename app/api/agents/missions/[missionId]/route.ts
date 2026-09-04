/**
 * `/api/agents/missions/[missionId]` — GET alias for a single mission view.
 * Delegates to `/api/v1/[tenant]/prime/missions?view=mission&missionId=…`
 * (same resolveRequestAuth / requireTenantAccess as the prime handler).
 */
import { NextRequest } from "next/server";
import { GET as primeGet } from "@/app/api/v1/[tenant]/prime/missions/route";

export const runtime = "nodejs";

const DEFAULT_TENANT = "bypilar";

export async function GET(
  req: NextRequest,
  routeCtx: { params: Promise<{ missionId: string }> },
) {
  const { missionId } = await routeCtx.params;
  const tenant =
    req.nextUrl.searchParams.get("tenant")?.trim() || DEFAULT_TENANT;

  const url = new URL(req.url);
  url.searchParams.set("view", "mission");
  url.searchParams.set("missionId", missionId);
  url.searchParams.set("tenant", tenant);

  const headers = new Headers(req.headers);
  const forwarded = new NextRequest(url, { method: "GET", headers });
  return primeGet(forwarded, { params: Promise.resolve({ tenant }) });
}
