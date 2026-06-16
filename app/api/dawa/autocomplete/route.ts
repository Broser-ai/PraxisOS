// DAWA-proxy · Danmarks Adressers Web API
// https://api.dataforsyningen.dk/autocomplete?q=...
//
// Vi proxyer for at:
//   1) undgå CORS-issues på klient-siden
//   2) tilføje caching (DAWA er gratis men har request-limits ved bursts)
//   3) normalisere response til vores eget format
import { NextResponse } from "next/server";

const DAWA = "https://api.dataforsyningen.dk/autocomplete";

export async function GET(req: Request) {
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
