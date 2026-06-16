// CVR-proxy · Erhvervsstyrelsens åbne data
// GET /api/cvr/lookup?cvr=12345678  → firmainfo
// GET /api/cvr/lookup?q=by+pilar    → søg på navn
//
// Bruger cvrapi.dk's gratis-tier (1.000 req/dag). Returnerer normaliseret format.

import { NextResponse } from "next/server";

const CVR_API = "https://cvrapi.dk/api";

type CvrResult = {
  cvr: string;
  name: string;
  vat: boolean;
  address: string;
  zipcode: string;
  city: string;
  protected: boolean;
  phone?: string;
  email?: string;
  industryCode: string;
  industryDesc: string;
  companyCode: string;
  companyDesc: string;
  startdate: string;
  enddate?: string;
  employees?: string;
  owners?: { name: string; type: string }[];
  productionUnits?: { pno: string; name: string; address: string }[];
};

const DEMO_RESULTS: Record<string, CvrResult> = {
  "43947079": {
    cvr: "43947079",
    name: "by Pilar IVS",
    vat: true,
    address: "Bruunsgade 12, 2 sal",
    zipcode: "8000",
    city: "Aarhus C",
    protected: false,
    phone: "+45 93 95 20 41",
    email: "hej@bypilar.dk",
    industryCode: "960210",
    industryDesc: "Frisørsaloner og skønhedssaloner",
    companyCode: "80",
    companyDesc: "Enkeltmandsvirksomhed",
    startdate: "2022-03-01",
    employees: "1",
    owners: [{ name: "Pilar Mortensen", type: "Ejer · 100%" }],
    productionUnits: [
      { pno: "1029834712", name: "by Pilar", address: "Bruunsgade 12, 2 sal, 8000 Aarhus C" },
    ],
  },
  "12345678": {
    cvr: "12345678",
    name: "Nordlys Klinik ApS",
    vat: true,
    address: "Vesterbrogade 47",
    zipcode: "1620",
    city: "København V",
    protected: false,
    phone: "+45 70 70 12 34",
    email: "info@nordlysklinik.dk",
    industryCode: "861000",
    industryDesc: "Hospitalsvirksomhed",
    companyCode: "10",
    companyDesc: "Anpartsselskab",
    startdate: "2018-08-15",
    employees: "4",
    owners: [{ name: "Nadia Berg", type: "Direktør · 60%" }, { name: "Tine Berg", type: "Bestyrelsesmedlem · 40%" }],
    productionUnits: [
      { pno: "1019034812", name: "Nordlys Klinik · Vesterbro", address: "Vesterbrogade 47, 1620 København V" },
      { pno: "1019034813", name: "Nordlys Klinik · Østerbro", address: "Østerbrogade 81, 2100 København Ø" },
    ],
  },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cvr = url.searchParams.get("cvr");
  const q = url.searchParams.get("q");

  if (!cvr && !q) {
    return NextResponse.json({ error: "missing_cvr_or_q" }, { status: 400 });
  }

  // Hvis CVR-nummer matcher demo-data, returnér det
  if (cvr && DEMO_RESULTS[cvr]) {
    return NextResponse.json({ result: DEMO_RESULTS[cvr], source: "demo-cache" }, {
      headers: { "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" },
    });
  }

  // Ellers prøv cvrapi.dk
  try {
    const params = new URLSearchParams();
    if (cvr) params.set("search", cvr);
    if (q) params.set("search", q);
    params.set("country", "dk");

    const res = await fetch(`${CVR_API}?${params}`, {
      headers: { "User-Agent": "PraxisOS/1.0" },
      next: { revalidate: 86400 * 7 },
    });

    if (!res.ok) {
      return NextResponse.json({
        error: "cvr_lookup_failed",
        hint: "cvrapi.dk har en grænse på 1.000 req/dag for gratis brug · prøv igen senere",
        fallback: cvr ? { cvr, name: `CVR-firma ${cvr}`, city: "Danmark" } : null,
      }, { status: 502, headers: { "access-control-allow-origin": "*" } });
    }

    const raw = await res.json();
    const result: CvrResult = {
      cvr: raw.vat?.toString() ?? cvr ?? "",
      name: raw.name ?? "",
      vat: raw.vat ? true : false,
      address: raw.address ?? "",
      zipcode: raw.zipcode?.toString() ?? "",
      city: raw.city ?? "",
      protected: raw.protected ?? false,
      phone: raw.phone,
      email: raw.email,
      industryCode: raw.industrycode ?? "",
      industryDesc: raw.industrydesc ?? "",
      companyCode: raw.companycode ?? "",
      companyDesc: raw.companydesc ?? "",
      startdate: raw.startdate ?? "",
      enddate: raw.enddate,
      employees: raw.employees,
    };
    return NextResponse.json({ result, source: "cvrapi" }, {
      headers: { "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" },
    });
  } catch (err: any) {
    return NextResponse.json({
      error: "network_failure",
      message: err.message,
      fallback: cvr ? { cvr, name: `CVR-firma ${cvr}`, city: "Danmark" } : null,
    }, { status: 502, headers: { "access-control-allow-origin": "*" } });
  }
}
