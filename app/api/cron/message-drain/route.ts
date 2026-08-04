import { NextResponse } from "next/server";
import { drainOutbox } from "@/lib/messaging/outbox";
import { messagingMode, nemsmsConfigured } from "@/lib/messaging/provider";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.SWARM_CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

/** Drain due SMS/NemSMS outbox rows. */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await drainOutbox(50);
  return NextResponse.json({
    ok: true,
    ...result,
    messagingMode: messagingMode(),
    nemsmsConfigured: nemsmsConfigured(),
  });
}

export async function GET(req: Request) {
  return POST(req);
}
