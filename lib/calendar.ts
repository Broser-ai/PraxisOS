// Pure calendar helpers — slot generation + conflict detection (no I/O).

export type Interval = { startMs: number; endMs: number };

export type BusyBlock = {
  startsAt: string;
  durationMin: number;
  status?: string;
};

export function toInterval(startsAt: string | Date, durationMin: number): Interval {
  const startMs =
    typeof startsAt === "string" ? new Date(startsAt).getTime() : startsAt.getTime();
  return {
    startMs,
    endMs: startMs + Math.max(1, durationMin) * 60_000,
  };
}

export function rangesOverlap(a: Interval, b: Interval): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function isBlockingBooking(status?: string): boolean {
  if (!status) return true;
  return status !== "cancelled";
}

/** True when candidate overlaps any non-cancelled busy block. */
export function hasConflict(candidate: Interval, busy: BusyBlock[]): boolean {
  for (const block of busy) {
    if (!isBlockingBooking(block.status)) continue;
    const other = toInterval(block.startsAt, block.durationMin);
    if (Number.isNaN(other.startMs)) continue;
    if (rangesOverlap(candidate, other)) return true;
  }
  return false;
}

export function generateBaseTimes(dayOfWeek: number): string[] {
  // 0 = Sunday closed
  if (dayOfWeek === 0) return [];
  if (dayOfWeek === 6) return ["09:00", "10:30", "12:00", "13:30"];
  return ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];
}

/**
 * Build availability days, removing times that conflict with existing bookings.
 */
export function buildAvailabilitySlots(input: {
  from: Date;
  days: number;
  durationMin: number;
  busy: BusyBlock[];
}): { day: string; times: string[] }[] {
  const slots: { day: string; times: string[] }[] = [];
  const dayCount = Math.min(14, Math.max(1, input.days));

  for (let i = 0; i < dayCount; i++) {
    const d = new Date(input.from);
    d.setHours(12, 0, 0, 0); // noon avoids DST edge when labeling the day
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const day = d.toISOString().slice(0, 10);
    const base = generateBaseTimes(dow);
    if (base.length === 0) continue;

    const times = base.filter((hhmm) => {
      const start = new Date(`${day}T${hhmm}:00`);
      if (Number.isNaN(start.getTime())) return false;
      return !hasConflict(toInterval(start, input.durationMin), input.busy);
    });
    slots.push({ day, times });
  }
  return slots;
}
