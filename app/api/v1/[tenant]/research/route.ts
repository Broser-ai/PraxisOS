import { NextRequest, NextResponse } from "next/server";
import {
  formatFindingForJournal,
  listResearchTracks,
  runResearchHarvest,
} from "@/lib/alphaxiv";
import type { ResearchTrackId } from "@/lib/alphaxiv/types";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";
import { writeJournal } from "@/lib/swarm/journal";
import { getTenant } from "@/lib/tenants";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || (session.tenant !== tenant && session.role !== "support")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "tracks";
  if (view === "tracks") {
    return NextResponse.json({ data: listResearchTracks(), tenant });
  }

  const trackId = url.searchParams.get("track") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const finding = await runResearchHarvest({
    trackId: trackId as ResearchTrackId | undefined,
    query: q ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? "6") || 6,
  });
  return NextResponse.json({ data: finding, tenant });
}

/** POST · harvest + write LUNA journal (optional enqueue handled by swarm separately) */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || (session.tenant !== tenant && session.role !== "support")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "owner" && session.role !== "support") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { trackId?: string; query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const finding = await runResearchHarvest({
    trackId: body.trackId as ResearchTrackId | undefined,
    query: body.query,
    limit: body.limit,
  });

  writeJournal({
    agent: "LUNA_RESEARCH",
    kind: "learning",
    content: formatFindingForJournal(finding),
    meta: {
      tenant,
      track: finding.track,
      live: finding.live,
      papers: finding.papers.map((p) => p.arxivId),
      by: session.accountId,
    },
  });

  return NextResponse.json({
    data: finding,
    journaled: true,
    note: "NO_AUTO_MERGE — papers are citations for human/swarm review only",
  });
}
