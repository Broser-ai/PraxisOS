// Planway content-layer rewrite — parity with WP MU-plugin + theme filters

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BYPILAR_BOOK_EMBED_URL,
  BYPILAR_BOOK_URL,
  purgePlanwayHtml,
  rewritePlanwayToPraxis,
} from "@/lib/booking-urls";

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

describe("purgePlanwayHtml · content rewrite", () => {
  it("rewrites href planway.com to HTTPS PraxisOS book (keeps useful query)", () => {
    const html =
      '<a href="https://bypilar.planway.com/book?service=ude-std&utm=x">Book</a>';
    const out = purgePlanwayHtml(html);
    expect(out).not.toMatch(/planway\.com/i);
    expect(out).toContain('href="https://app.bypilar.dk/t/bypilar/book?service=ude-std"');
    expect(out).not.toContain("utm=");
  });

  it("rewrites iframe planway src to HTTPS embed", () => {
    const html =
      '<iframe src="https://bypilar.planway.com/embed" title="x"></iframe>';
    const out = purgePlanwayHtml(html);
    expect(out).not.toMatch(/planway\.com/i);
    expect(out).toContain(`src="${BYPILAR_BOOK_EMBED_URL}"`);
  });

  it("forces http://app.bypilar.dk → https", () => {
    const html =
      '<iframe src="http://app.bypilar.dk/t/bypilar/book?embed=1"></iframe>';
    const out = purgePlanwayHtml(html);
    expect(out).toContain("https://app.bypilar.dk/t/bypilar/book?embed=1");
    expect(out).not.toContain("http://app.bypilar.dk");
  });

  it("purges the udekoerende legacy fixture to zero planway.com", () => {
    const raw = readFileSync(
      join(ROOT, "tests/fixtures/planway-udekoerende-legacy.html"),
      "utf8",
    );
    expect(raw).toMatch(/planway\.com/i);
    const out = purgePlanwayHtml(raw);
    expect(out).not.toMatch(/planway\.com/i);
    expect(out).not.toContain("http://app.bypilar.dk");
    expect(out).toContain(BYPILAR_BOOK_URL);
    expect(out).toContain(BYPILAR_BOOK_EMBED_URL);
    expect(out).toContain("service=ude-std");
    expect(out).toContain("service=fod-std");
  });

  it("rewritePlanwayToPraxis href defaults to non-embed book URL", () => {
    expect(rewritePlanwayToPraxis("https://bypilar.planway.com/book")).toBe(
      BYPILAR_BOOK_URL,
    );
    expect(
      rewritePlanwayToPraxis("https://bypilar.planway.com/book", { embed: true }),
    ).toBe(BYPILAR_BOOK_EMBED_URL);
  });
});

describe("WP Planway content rewrite · repo wiring", () => {
  it("MU-plugin registers the_content / widget_text / nav_menu filters", () => {
    const mu = readFileSync(
      join(
        ROOT,
        "wordpress/mu-plugins/bypilar-planway-content-rewrite.php",
      ),
      "utf8",
    );
    expect(mu).toMatch(/function bypilar_purge_planway_html/);
    expect(mu).toMatch(/the_content/);
    expect(mu).toMatch(/widget_text/);
    expect(mu).toMatch(/nav_menu_link_attributes/);
    expect(mu).toMatch(/wp_nav_menu_items/);
    expect(mu).toMatch(/ob_start\(\s*'bypilar_purge_planway_html'\s*\)/);
    expect(mu).toMatch(/http:\/\/app\.bypilar\.dk/);
  });

  it("theme functions.php also filters content + uses purge helper", () => {
    const fn = readFileSync(
      join(ROOT, "wordpress/themes/pilar-theme/functions.php"),
      "utf8",
    );
    expect(fn).toMatch(/pilar_purge_planway_html/);
    expect(fn).toMatch(/the_content/);
    expect(fn).toMatch(/widget_text/);
    expect(fn).toMatch(/nav_menu_link_attributes/);
    expect(fn).toMatch(/bypilar_purge_planway_html/);
  });

  it("wp-cli kill script exists and targets planway hosts", () => {
    const sh = readFileSync(
      join(ROOT, "scripts/wp-cli-kill-planway.sh"),
      "utf8",
    );
    expect(sh).toMatch(/search-replace/);
    expect(sh).toMatch(/bypilar\.planway\.com/);
    expect(sh).toMatch(/app\.bypilar\.dk\/t\/bypilar\/book/);
    expect(sh).toMatch(/http:\/\/app\.bypilar\.dk/);
  });

  it("customer-facing wordpress/ has zero planway.com URL literals", () => {
    const hits: string[] = [];
    for (const file of walkFiles(join(ROOT, "wordpress"))) {
      if (/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ico)$/i.test(file)) continue;
      // Allow intentional mention in rewrite/kill plugins (they match planway.com)
      if (
        /bypilar-planway-content-rewrite\.php$/.test(file) ||
        /planway-udekoerende-legacy/.test(file)
      ) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      // Flag only URL-like planway.com (scheme or host), not prose "not Planway"
      if (/https?:\/\/[^\s"'<>]*planway\.com/i.test(text)) {
        hits.push(file.replace(ROOT + "/", ""));
      }
      if (/['"][^'"]*planway\.com[^'"]*['"]/i.test(text) && !/planway\.com/i.test(file)) {
        // string literals containing planway.com host — only OK in rewrite plugin (skipped)
        if (!/content-rewrite|planway-kill|purge_planway|is_planway/i.test(text)) {
          // still allow regex patterns in rewrite code; those files skipped above
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
