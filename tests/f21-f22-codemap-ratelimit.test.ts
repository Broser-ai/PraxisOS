// F21 · CODE-MAP accuracy + F22 lookup/voucher rate-limit harden.

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { GET as lookupGet } from "@/app/api/v1/[tenant]/lookup/route";
import { GET as voucherGet } from "@/app/api/v1/[tenant]/voucher/route";
import { POST as bookingsPost } from "@/app/api/v1/[tenant]/bookings/route";
import {
  bookingRateLimit,
  publicLookupRateLimit,
  _resetBookingRateLimitForTests,
} from "@/lib/public-booking-kit";

const root = process.cwd();

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("F21 · CODE-MAP accuracy", () => {
  const map = readFileSync(join(root, "CODE-MAP.md"), "utf8");

  it("documents 44 API route handlers (not stale 15)", () => {
    expect(map).toMatch(/44 API route handlers/);
    expect(map).not.toMatch(/## API endpoints \(15\)/);
  });

  it("lists health fail-fast, consent, events staff GET, workflows gate", () => {
    expect(map).toMatch(/\/api\/health/);
    expect(map).toMatch(/F16 fail-fast/);
    expect(map).toMatch(/\/api\/v1\/\[tenant\]\/consent/);
    expect(map).toMatch(/\/api\/events/);
    expect(map).toMatch(/F19/);
    expect(map).toMatch(/\/api\/agents\/workflows/);
    expect(map).toMatch(/F20/);
  });

  it("notes FootScan/SwarmPanel removed; lists NexusScanPanel", () => {
    expect(map).toMatch(/FootScan\.tsx.*removed/s);
    expect(map).toMatch(/NexusScanPanel/);
    expect(existsSync(join(root, "components/FootScan.tsx"))).toBe(false);
    expect(existsSync(join(root, "components/SwarmPanel.tsx"))).toBe(false);
    expect(existsSync(join(root, "components/NexusScanPanel.tsx"))).toBe(true);
  });

  it("route file count matches CODE-MAP claim (≥40)", () => {
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(p));
        else if (ent.name === "route.ts") out.push(p);
      }
      return out;
    }
    const routes = walk(join(root, "app/api"));
    expect(routes.length).toBeGreaterThanOrEqual(40);
    expect(map).toMatch(String(routes.length));
  });
});

describe("F22 · lookup/voucher rate-limit harden", () => {
  beforeEach(() => {
    _resetBookingRateLimitForTests();
  });

  it("publicLookupRateLimit defaults to 20 then 429", () => {
    for (let i = 0; i < 20; i++) {
      expect(publicLookupRateLimit("1.2.3.4", "bypilar").ok).toBe(true);
    }
    const over = publicLookupRateLimit("1.2.3.4", "bypilar");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.status).toBe(429);
  });

  it("lookup bucket is isolated from booking bucket", () => {
    for (let i = 0; i < 30; i++) bookingRateLimit("1.2.3.4", "bypilar");
    expect(bookingRateLimit("1.2.3.4", "bypilar").ok).toBe(false);
    // lookup still fresh
    expect(publicLookupRateLimit("1.2.3.4", "bypilar").ok).toBe(true);
  });

  it("lookup route 429s under stricter limit without starving bookings", async () => {
    let last = 0;
    for (let i = 0; i < 25; i++) {
      const res = await lookupGet(
        new Request(
          "http://localhost/api/v1/bypilar/lookup?email=unknown@example.com&service=fod-med",
        ),
        ctx("bypilar"),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);

    // Booking still works (isolated bucket)
    const book = await bookingsPost(
      new Request("http://localhost/api/v1/bypilar/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: "fod-med",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          client: {
            name: "F22",
            email: `f22-${Date.now()}@example.com`,
            phone: "+4512345678",
          },
        }),
      }),
      ctx("bypilar"),
    );
    expect(book.status).toBe(201);
  });

  it("voucher route uses publicLookupRateLimit", async () => {
    let last = 0;
    for (let i = 0; i < 25; i++) {
      const res = await voucherGet(
        new Request(
          "http://localhost/api/v1/bypilar/voucher?code=NOPE-0000-0000&service=fod-med",
        ),
        ctx("bypilar"),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });
});
