// byPilar setup visibility · staff path + white-label + HTTPS embed instructions
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import {
  BYPILAR_APP_ORIGIN,
  isBypilarHost,
  safeStaffNextPath,
} from "@/lib/bypilar-host";
import { GET as embedGet } from "@/app/embed/v1/[tenant]/route";

const ROOT = join(import.meta.dirname, "..");

function makeReq(pathname: string, host: string): NextRequest {
  const url = new URL(`https://${host}${pathname}`);
  return new NextRequest(url, {
    headers: new Headers({ host }),
    method: "GET",
  });
}

describe("byPilar · setup visibility", () => {
  it("recognizes bypilar customer hosts", () => {
    expect(isBypilarHost("app.bypilar.dk")).toBe(true);
    expect(isBypilarHost("www.bypilar.dk:443")).toBe(true);
    expect(isBypilarHost("praxisos.example")).toBe(false);
  });

  it("allows /setup on bypilar host (not redirect to /review)", () => {
    const res = middleware(makeReq("/setup", "app.bypilar.dk"));
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get("location")).toBeNull();
  });

  it("safeStaffNextPath blocks open redirects", () => {
    expect(safeStaffNextPath("/dashboard")).toBe("/dashboard");
    expect(safeStaffNextPath("/journal")).toBe("/journal");
    expect(safeStaffNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeStaffNextPath("//evil.example")).toBe("/dashboard");
    expect(safeStaffNextPath("/shop")).toBe("/dashboard");
  });

  it("tenant layout exposes Klinik-login · Staff → /login without PraxisOS brand", () => {
    const src = readFileSync(join(ROOT, "app/t/[tenant]/layout.tsx"), "utf8");
    expect(src).toMatch(/Klinik-login · Staff/);
    expect(src).toMatch(/\/login\?next=\/dashboard/);
    // Footer staff link must not advertise PraxisOS on customer surface
    const footer = src.slice(src.indexOf("<footer"));
    expect(footer).not.toMatch(/PraxisOS/);
  });

  it("tenant setup done-step uses Klinik-login and clinic-OS links", () => {
    const src = readFileSync(join(ROOT, "app/t/[tenant]/setup/page.tsx"), "utf8");
    expect(src).toMatch(/Klinik-login · Staff/);
    expect(src).toMatch(/\/dashboard/);
    expect(src).toMatch(/\/kalender/);
    expect(src).toMatch(/\/klienter/);
    expect(src).toMatch(/\/journal/);
    expect(src).toMatch(/\/scan/);
    expect(src).not.toMatch(/Log ind i PraxisOS/);
  });

  it("setup page maps whole clinic OS", () => {
    const src = readFileSync(join(ROOT, "app/setup/page.tsx"), "utf8");
    for (const href of ["/dashboard", "/kalender", "/klienter", "/journal", "/scan", "/admin/packaging"]) {
      expect(src).toContain(href);
    }
    expect(src).toMatch(/Klinik-login · Staff/);
  });

  it("login form white-label path exists (no PraxisOS on bypilar chrome)", () => {
    const form = readFileSync(join(ROOT, "app/login/login-form.tsx"), "utf8");
    expect(form).toMatch(/whiteLabel/);
    expect(form).toMatch(/Klinik-login/);
    const page = readFileSync(join(ROOT, "app/login/page.tsx"), "utf8");
    expect(page).toMatch(/isBypilarHost/);
  });

  it("ops doc lists customer vs staff vs admin HTTPS URLs", () => {
    const doc = readFileSync(join(ROOT, "docs/ops/bypilar-where-is-praxisos.md"), "utf8");
    expect(doc).toContain("https://app.bypilar.dk/t/bypilar");
    expect(doc).toContain("https://app.bypilar.dk/login?next=/dashboard");
    expect(doc).toContain("https://app.bypilar.dk/dashboard");
    expect(doc).toContain("https://app.bypilar.dk/kalender");
    expect(doc).toContain("https://app.bypilar.dk/klienter");
    expect(doc).toContain("https://app.bypilar.dk/journal");
    expect(doc).toContain("https://app.bypilar.dk/scan");
    expect(doc).toContain("https://app.bypilar.dk/admin/packaging");
    expect(doc).toContain("https://app.bypilar.dk/embed/v1/bypilar");
    expect(doc).toMatch(/by Pilar ≠ PraxisOS/);
    expect(doc).not.toMatch(/http:\/\/app\.bypilar\.dk/);
  });

  it("bypilar embed instructions / ORIGIN use HTTPS app.bypilar.dk", async () => {
    expect(BYPILAR_APP_ORIGIN).toBe("https://app.bypilar.dk");
    const route = readFileSync(join(ROOT, "app/embed/v1/[tenant]/route.ts"), "utf8");
    expect(route).toMatch(/https:\/\/app\.bypilar\.dk\/embed\/v1\/bypilar/);
    expect(route).not.toMatch(/http:\/\/app\.bypilar\.dk\/embed/);

    const res = await embedGet(
      new Request("http://localhost/embed/v1/bypilar", {
        headers: { host: "app.bypilar.dk", "x-forwarded-proto": "https" },
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    const body = await res.text();
    expect(body).toContain('ORIGIN = "https://app.bypilar.dk"');
    // White-label: no PraxisOS badge on bypilar embed
    expect(body).toMatch(/HIDE_BADGE = true/);
  });

  it("integration guide forces HTTPS for bypilar embed src", () => {
    const src = readFileSync(
      join(ROOT, "app/(internal)/admin/integration/[tenant]/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/BYPILAR_APP_ORIGIN/);
  });
});
