import { describe, expect, it } from "vitest";
import {
  buildAvailabilitySlots,
  hasConflict,
  rangesOverlap,
  toInterval,
} from "@/lib/calendar";

describe("calendar conflict helpers", () => {
  it("detects overlapping ranges", () => {
    const a = toInterval("2026-08-10T09:00:00.000Z", 60);
    const b = toInterval("2026-08-10T09:30:00.000Z", 30);
    const c = toInterval("2026-08-10T10:00:00.000Z", 30);
    expect(rangesOverlap(a, b)).toBe(true);
    expect(rangesOverlap(a, c)).toBe(false);
  });

  it("ignores cancelled bookings in conflict checks", () => {
    const candidate = toInterval("2026-08-10T09:00:00.000Z", 45);
    expect(
      hasConflict(candidate, [
        { startsAt: "2026-08-10T09:00:00.000Z", durationMin: 45, status: "cancelled" },
      ]),
    ).toBe(false);
    expect(
      hasConflict(candidate, [
        { startsAt: "2026-08-10T09:00:00.000Z", durationMin: 45, status: "confirmed" },
      ]),
    ).toBe(true);
  });

  it("removes busy slots from availability", () => {
    const from = new Date("2026-08-10T12:00:00.000Z"); // Monday
    const slots = buildAvailabilitySlots({
      from,
      days: 1,
      durationMin: 45,
      busy: [
        { startsAt: "2026-08-10T09:00:00", durationMin: 45, status: "confirmed" },
      ],
    });
    expect(slots).toHaveLength(1);
    expect(slots[0]!.day).toBe("2026-08-10");
    expect(slots[0]!.times).not.toContain("09:00");
    expect(slots[0]!.times).toContain("10:30");
  });
});
