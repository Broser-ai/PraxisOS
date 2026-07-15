// Mill-adapter tests
// Kontrakt: STATE-OF-THE-ART §9 Sprint 3 · Vorum CAM handshake

import { describe, it, expect } from "vitest";
import {
  createStubMillAdapter,
  paramsToVorumRect,
  millManifestSchema,
  type MillManifest,
} from "@/lib/orthotic/mill-adapter";
import { defaultParams } from "@/lib/configurator/orthotic-generator";

function makeManifest(overrides: Partial<MillManifest> = {}): MillManifest {
  return millManifestSchema.parse({
    config_id: "config_stub_001",
    tenant_id: "bypilar",
    patient_ref: "pt_hash_abc",
    side: "pair",
    material: {
      eva_shore_a_forefoot: 32,
      eva_shore_a_heel: 55,
      top_cover: "microfiber",
      thickness_forefoot_mm: 4,
      thickness_heel_mm: 8,
    },
    tolerance_mm: 0.2,
    practitioner_signoff: {
      user_id: "user_pilar",
      initials: "MA",
      approved_at: "2026-07-13T10:30:00Z",
    },
    clinic_shipping_address_ref: "shipping_ref_bypilar_001",
    ...overrides,
  });
}

describe("mill-adapter · Vorum RECT mapping", () => {
  it("paramsToVorumRect returns all 16 param mappings", () => {
    const rect = paramsToVorumRect(defaultParams());
    expect(rect.HEEL_CUP_DEPTH).toBe(20);
    expect(rect.LONG_ARCH_PAD_HEIGHT).toBe(15);
    expect(rect.SHORE_A_HEEL).toBe(55);
    expect(rect.RECT_VERSION).toBe("PraxisOS-v1");
    // 16 params + 1 version field
    expect(Object.keys(rect).length).toBe(17);
  });
});

describe("mill-adapter · stub submit + status", () => {
  it("submit returns 'accepted' with job_id + eta", async () => {
    const adapter = createStubMillAdapter();
    const stl = new Uint8Array(84 + 50 * 10); // 10 triangles worth
    const result = await adapter.submit(stl, makeManifest());
    expect(result.status).toBe("accepted");
    expect(result.job_id).toContain("job_stub");
    expect(result.eta_at).toBeDefined();
    expect(result.message).toContain("stub-mill");
  });

  it("getStatus retrieves persisted job data", async () => {
    const adapter = createStubMillAdapter();
    const stl = new Uint8Array(84 + 50 * 5);
    const submission = await adapter.submit(stl, makeManifest());
    const status = await adapter.getStatus(submission.job_id);
    expect(status.job_id).toBe(submission.job_id);
    expect(status.status).toBe("accepted");
    expect(status.post_verify?.watertight).toBe(true);
    expect(status.post_verify?.face_count).toBe(5);
  });

  it("getStatus for unknown job_id returns 'error'", async () => {
    const adapter = createStubMillAdapter();
    const status = await adapter.getStatus("nonexistent_job");
    expect(status.status).toBe("error");
  });
});

describe("mill-adapter · manifest validation", () => {
  it("rejects manifest without practitioner_signoff", () => {
    expect(() =>
      millManifestSchema.parse({
        config_id: "x",
        tenant_id: "y",
        patient_ref: "z",
        side: "left",
        material: {
          eva_shore_a_forefoot: 30,
          eva_shore_a_heel: 50,
          thickness_forefoot_mm: 4,
          thickness_heel_mm: 8,
        },
        clinic_shipping_address_ref: "ref",
      }),
    ).toThrow();
  });

  it("rejects out-of-range Shore A values", () => {
    expect(() =>
      makeManifest({
        material: {
          eva_shore_a_forefoot: 15, // < 20
          eva_shore_a_heel: 55,
          top_cover: "microfiber",
          thickness_forefoot_mm: 4,
          thickness_heel_mm: 8,
        },
      }),
    ).toThrow();
  });
});
