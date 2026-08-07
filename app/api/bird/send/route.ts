import { NextRequest, NextResponse } from "next/server";
import { isBirdConfigured, sendBirdSms, type BirdSmsCategory } from "@/lib/bird";

export const runtime = "nodejs";

type Body = {
  to?: string;
  text?: string;
  from?: string;
  category?: BirdSmsCategory;
};

export async function POST(req: NextRequest) {
  if (!isBirdConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Bird er ikke konfigureret (BIRD_API_KEY mangler)" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig JSON" }, { status: 400 });
  }

  const to = body.to?.trim();
  const text = body.text?.trim();
  if (!to || !text) {
    return NextResponse.json({ ok: false, error: "Kræver 'to' og 'text'" }, { status: 400 });
  }

  const result = await sendBirdSms({
    to,
    text,
    from: body.from,
    category: body.category,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.statusCode && result.statusCode < 500 ? 400 : 502 });
  }

  return NextResponse.json(result, { status: 202 });
}
