// Booking URL helpers + Planway purge + byPilar embed white-label

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BYPILAR_BOOK_EMBED_URL,
  BYPILAR_BOOK_URL,
  BYPILAR_KLINIK_URL,
  BYPILAR_PUBLIC_ORIGIN,
  byPilarStaffEntry,
  embedBookUrl,
  isPlanwayUrl,
  publicBookUrl,
  publicBookingOrigin,
  rewritePlanwayToPraxis,
} from "@/lib/booking-urls";
import { applySecurityHeaders } from "../middleware";
import { NextResponse } from "next/server";
import { GET as embedGet } from "@/app/embed/v1/[tenant]/route";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";

const ROOT = process.cwd();

function walkFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe("booking-urls helpers", () => {
  const prevPublic = process.env.PRAXIS_PUBLIC_BASE_URL;
  const prevNext = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    if (prevPublic === undefined) delete process.env.PRAXIS_PUBLIC_BASE_URL;
    else process.env.PRAXIS_PUBLIC_BASE_URL = prevPublic;
    if (prevNext === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = prevNext;
  });

  it("builds canonical HTTPS byPilar book + embed URLs", () => {
    expect(BYPILAR_BOOK_URL).toBe("https://app.bypilar.dk/t/bypilar/book");
    expect(BYPILAR_BOOK_EMBED_URL).toBe(
      "https://app.bypilar.dk/t/bypilar/book?embed=1",
    );
    expect(publicBookUrl("bypilar", { embed: true })).toBe(
      BYPILAR_BOOK_EMBED_URL,
    );
    expect(embedBookUrl("bypilar", "fod-std")).toContain("embed=1");
    expect(embedBookUrl("bypilar", "fod-std")).toContain("service=fod-std");
    expect(embedBookUrl("bypilar", "fod-std")).toMatch(/^https:\/\//);
  });

  it("publicBookingOrigin prefers PRAXIS_PUBLIC_BASE_URL", () => {
    process.env.PRAXIS_PUBLIC_BASE_URL = "https://app.bypilar.dk/";
    delete process.env.NEXT_PUBLIC_BASE_URL;
    expect(publicBookingOrigin()).toBe(BYPILAR_PUBLIC_ORIGIN);
    expect(
      publicBookingOrigin(new Request("http://localhost:3000/api/v1/x")),
    ).toBe(BYPILAR_PUBLIC_ORIGIN);
  });

  it("falls back to request origin then byPilar production", () => {
    delete process.env.PRAXIS_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    expect(
      publicBookingOrigin(new Request("http://127.0.0.1:3002/t/bypilar/book")),
    ).toBe("http://127.0.0.1:3002");
    expect(publicBookingOrigin()).toBe(BYPILAR_PUBLIC_ORIGIN);
  });

  it("detects and rewrites Planway URLs", () => {
    expect(isPlanwayUrl("https://bypilar.planway.com/book")).toBe(true);
    expect(isPlanwayUrl("https://app.bypilar.dk/t/bypilar/book")).toBe(false);
    expect(rewritePlanwayToPraxis("https://bypilar.planway.com/book")).toBe(
      BYPILAR_BOOK_EMBED_URL,
    );
    expect(rewritePlanwayToPraxis("https://bypilar.planway.com")).toBe(
      BYPILAR_BOOK_URL,
    );
  });

  it("staff entry is white-label (Kom i gang / Klinik, no PraxisOS)", () => {
    const s = byPilarStaffEntry();
    expect(s.href).toBe(BYPILAR_KLINIK_URL);
    expect(s.label).toMatch(/Kom i gang/i);
    expect(s.sublabel).toMatch(/Klinik/i);
    expect(JSON.stringify(s)).not.toMatch(/PraxisOS/i);
  });
});

describe("Planway purge · repo surfaces", () => {
  it("wordpress theme + bridge have no live planway.com URLs", () => {
    const roots = [
      join(ROOT, "wordpress"),
      join(ROOT, "app"),
      join(ROOT, "lib"),
      join(ROOT, "components"),
    ];
    // Only real URLs count: the purge itself must reference the bare host string
    // in order to detect and rewrite legacy Planway links.
    const livePlanwayUrl = /(?:https?:)?\/\/[\w.-]*planway\.com/i;
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of walkFiles(root)) {
        if (/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ico)$/i.test(file)) continue;
        const text = readFileSync(file, "utf8");
        if (livePlanwayUrl.test(text)) hits.push(file.replace(ROOT + "/", ""));
      }
    }
    expect(hits).toEqual([]);
  });

  it("booking page template embeds HTTPS app.bypilar.dk only", () => {
    const page = readFileSync(
      join(ROOT, "wordpress/themes/pilar-theme/page-booking.php"),
      "utf8",
    );
    expect(page).toMatch(/app\.bypilar\.dk\/t\/bypilar\/book/);
    expect(page).toMatch(/embed=1|praxisos_book_url\(true\)/);
    expect(page).not.toMatch(/planway\.com/i);
    expect(page).toMatch(/data-praxis-book|praxis_book/);
    expect(page).toMatch(/praxis_klinik|Kom i gang/);
  });

  it("mu-plugin defaults to HTTPS and exposes klinik staff entry", () => {
    const bridge = readFileSync(
      join(ROOT, "wordpress/mu-plugins/praxisos-bridge.php"),
      "utf8",
    );
    expect(bridge).toMatch(/https:\/\/app\.bypilar\.dk/);
    expect(bridge).toMatch(/praxis_klinik|Kom i gang/);
    expect(bridge).toMatch(/data-praxis-book/);
    expect(bridge).toMatch(/data-praxis-no-badge/);
  });
});

describe("embed helpers · frame CSP + white-label", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("book path sets CSP frame-ancestors and omits X-Frame-Options", () => {
    const res = applySecurityHeaders(NextResponse.next(), "/t/bypilar/book");
    expect(res.headers.get("x-frame-options")).toBeNull();
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/frame-ancestors/);
    expect(csp).toMatch(/bypilar\.dk/);
  });

  it("bypilar embed is white-label (no PraxisOS badge copy)", async () => {
    const res = await embedGet(
      new Request("http://localhost/embed/v1/bypilar", {
        headers: { "x-forwarded-for": "198.51.100.40" },
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/data-praxis-book/);
    expect(body).toMatch(/WHITE_LABEL = true/);
    expect(body).toMatch(/\?embed=1/);
    expect(body).not.toMatch(/drevet af PraxisOS/);
  });
});
