// F72–F74 · CVR/DAWA CORS strip + middleware security headers + checklist

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { applySecurityHeaders, middleware } from "../middleware";
import { NextResponse } from "next/server";

const ROOT = process.cwd();

describe("F72 · CVR/DAWA drop ACAO *", () => {
  it("sources have no wildcard ACAO", () => {
    for (const rel of [
      "app/api/cvr/lookup/route.ts",
      "app/api/dawa/autocomplete/route.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/access-control-allow-origin": "\*"/);
      expect(src).toMatch(/F72/);
    }
  });
});

describe("F73 · middleware security headers", () => {
  it("applySecurityHeaders sets nosniff + referrer + frame", () => {
    const res = applySecurityHeaders(NextResponse.next(), "/login");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("embed + book paths stay frameable (no X-Frame-Options)", () => {
    const embed = applySecurityHeaders(NextResponse.next(), "/embed/v1/bypilar");
    expect(embed.headers.get("x-frame-options")).toBeNull();
    const book = applySecurityHeaders(
      NextResponse.next(),
      "/t/bypilar/book",
    );
    expect(book.headers.get("x-frame-options")).toBeNull();
  });

  it("middleware response includes security headers", () => {
    const req = new NextRequest("http://localhost/login");
    const res = middleware(req);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});

describe("F74 · checklist covers F65–F73", () => {
  it("operator checklist mentions F65–F67 and security headers or F73", () => {
    const text = readFileSync(
      join(ROOT, "docs/ops/p0-operator-checklist-merge-cutover.md"),
      "utf8",
    );
    expect(text).toMatch(/F65/);
    expect(text).toMatch(/F72|F73|security headers|nosniff/i);
  });
});
