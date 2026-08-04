import { NextResponse } from "next/server";
import { createMitidAuthRequest, mitidConfigured, mitidMode } from "@/lib/mitid/oidc";

/** GET /api/auth/mitid/start?mode=staff|patient&returnTo=/dashboard */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const modeParam = url.searchParams.get("mode");
  const mode = modeParam === "patient" ? "patient" : "staff";
  const returnTo = url.searchParams.get("returnTo") ?? undefined;

  const { authorizeUrl, state, mode: runtime } = createMitidAuthRequest({
    mode,
    returnTo,
  });

  // Prefer redirect for browser navigation
  if (url.searchParams.get("json") === "1") {
    return NextResponse.json({
      authorizeUrl,
      state,
      mitidMode: runtime,
      mitidConfigured: mitidConfigured(),
    });
  }

  return NextResponse.redirect(authorizeUrl);
}
