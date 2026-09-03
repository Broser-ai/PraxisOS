// DAWA-proxy · Danmarks Adressers Web API
// https://api.dataforsyningen.dk/autocomplete?q=...
//
// Vi proxyer for at:
//   1) undgå CORS-issues på klient-siden
//   2) tilføje caching (DAWA er gratis men har request-limits ved bursts)
//   3) normalisere response til vores eget format
// F32 · per-IP rate-limit (signup address scrape control).
import { NextResponse } from "next/server";
import { checkIpRateLimit } from "@/lib/rate-limit";

const DAWA = "https://api.dataforsyningen.dk/autocomplete";
const DAWA_LIMIT = 120; // / 15 min / IP
const DAWA_WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = checkIpRateLimit(ip, {
    key: "dawa",
    limit: DAWA_LIMIT,
    windowMs: DAWA_WINDOW_MS,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limited.retryAfterMs, suggestions: [] },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(limited.retryAfterMs / 1000).toString(),
          "access-control-allow-origin": "*",
        },
      },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    // type=adresse giver komplette adresser med husnummer + etage
    const res = await fetch(`${DAWA}?q=${encodeURIComponent(q)}&type=adresse&per_side=8`, {
      // Next caching · 1 dag
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ suggestions: [], error: "dawa_unavailable" }, { status: 502 });
    }
    const raw = await res.json();

    const suggestions = (raw as any[]).map((s) => {
      const a = s.data;
      return {
        tekst: s.tekst,
        forslagstekst: s.forslagstekst,
        caretpos: s.caretpos,
        type: s.type,
        adresse: a ? {
          vejnavn: a.vejnavn,
          husnr: a.husnr,
          etage: a.etage ?? undefined,
          doer: a.dør ?? a.doer ?? undefined,
          postnr: a.postnr,
          postnrnavn: a.postnrnavn,
          fuldText: s.tekst,
          kommunekode: a.kommunekode,
          vejkode: a.vejkode,
          betegnelse: a.id,
        } : undefined,
      };
    });

    return NextResponse.json({ suggestions }, {
      headers: {
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err: any) {
    // Fallback i tilfælde af netværksfejl eller DAWA-nedetid: returnér tom liste
    // OG en demo-vej der altid kan vælges, så onboarding-flowet ikke blokeres.
    return NextResponse.json({
      suggestions: [
        {
          tekst: `${q} (demo · DAWA utilgængelig)`,
          forslagstekst: q,
          caretpos: q.length,
          type: "adresse",
          adresse: {
            vejnavn: q.split(" ")[0] || "Hovedgaden",
            husnr: "1",
            postnr: "8000",
            postnrnavn: "Aarhus C",
            fuldText: `${q.split(" ")[0] || "Hovedgaden"} 1, 8000 Aarhus C`,
          },
        },
      ],
      degraded: true,
    });
  }
}
