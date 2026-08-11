import { NextResponse } from "next/server";
import { tickAutomation, ensureWorkflowSubscription } from "@/lib/agents/workflows";
import { nexusOnAgentTick } from "@/lib/nexus/runtime";

export const runtime = "nodejs";

function authorize(req: Request): boolean {
  const secret = process.env.AGENT_WORKER_SECRET?.trim() || process.env.PRAXIS_EVENT_SECRET?.trim();
  if (!secret) return true;
  const header =
    req.headers.get("x-agent-worker-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

/** Cron / worker heartbeat — runs all due scheduled workflows + Nexus (ARIA/LUNA) */
export async function POST(req: Request) {
  ensureWorkflowSubscription();
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let force = false;
  let tenant = "bypilar";
  try {
    const body = await req.json();
    force = Boolean(body?.force);
    if (typeof body?.tenant === "string") tenant = body.tenant;
  } catch {
    // empty body ok
  }
  const result = await tickAutomation({ tenant, force });
  const nexus = await nexusOnAgentTick({ tenant, forceHarvest: force });
  return NextResponse.json({ ...result, nexus });
}

export async function GET(req: Request) {
  ensureWorkflowSubscription();
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const result = await tickAutomation({ force });
  const nexus = await nexusOnAgentTick({ forceHarvest: force });
  return NextResponse.json({ ...result, nexus });
}
