// INV-NC-1 locked-config test
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §6

import { describe, it, expect } from "vitest";
import { assertMutable } from "@/lib/configurator/constraints";
import { isLocked } from "@/lib/configurator/schema";

describe("INV-NC-1 · låst konfiguration er immutabel", () => {
  it("(a) draft er mutable", () => {
    expect(() => assertMutable("draft")).not.toThrow();
    expect(isLocked("draft")).toBe(false);
  });

  it("(b) reviewed er stadig mutable", () => {
    expect(() => assertMutable("reviewed")).not.toThrow();
  });

  it("(c) locked kaster INV-NC-1 ved mutation-forsøg", () => {
    expect(() => assertMutable("locked")).toThrow(/INV-NC-1/);
    expect(isLocked("locked")).toBe(true);
  });

  it("(d) sent_to_lab kaster også", () => {
    expect(() => assertMutable("sent_to_lab")).toThrow(/INV-NC-1/);
  });

  it("(e) delivered kaster også", () => {
    expect(() => assertMutable("delivered")).toThrow(/INV-NC-1/);
  });
});
