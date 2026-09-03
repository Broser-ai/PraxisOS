import { NextResponse } from "next/server";
import { runDeepResearchAsk } from "@/lib/alphaxiv/bridge";
import type { ResearchTrackId } from "@/lib/alphaxiv/types";
import { writeJournal } from "@/lib/swarm/journal";
import { getTenant } from "@/lib/tenants";
import {
  jsonAuthFail,
  requireTenantAccess,
  type GuardOk,
} from "@/lib/request-auth";

/**
 * POST /api/v1/{tenant}/research/ask
 * Deep research against Alphaxiv (search + similar + optional Assistant).
 * For not-yet-launched ideas — never auto-implements.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  // F41 · requireTenantAccess replaces raw decodeSession
  const auth = requireTenantAccess(req, tenant, {
    roles: ["owner", "support"],
  });
  if (!auth.ok) return jsonAuthFail(auth);
  const session = auth as GuardOk;

  let body: {
    question?: string;
    trackId?: string;
    useAssistant?: boolean;
    journal?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.question?.trim()) {
    return NextResponse.json({ error: "missing_question" }, { status: 400 });
  }

  const result = await runDeepResearchAsk({
    question: body.question,
    trackId: body.trackId as ResearchTrackId | undefined,
    useAssistant: body.useAssistant,
  });

  if (body.journal !== false) {
    writeJournal({
      agent: "LUNA_RESEARCH",
      kind: "learning",
      content: `DeepAsk · ${result.question.slice(0, 120)} · papers=${result.finding.papers
        .slice(0, 5)
        .map((p) => p.arxivId)
        .join(",")} · assistant=${result.assistant?.ok ?? false}`,
      meta: {
        tenant,
        topics: result.topics,
        live: result.finding.live,
        by: session.accountId,
      },
    });
  }

  return NextResponse.json({
    data: result,
    tenant,
  });
}
