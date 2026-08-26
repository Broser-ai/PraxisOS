import { describe, expect, it, vi } from "vitest";
import {
  TRIVIEW_LIVE_MESH_PIN,
  isTriViewShadowEnabled,
  runTriViewShadowCompare,
} from "@/lib/scanner/triview-lift";

describe("TriView-Lift (shadow InstantMesh A/B)", () => {
  it("flag defaults OFF and live pin is TRELLIS", () => {
    expect(isTriViewShadowEnabled({})).toBe(false);
    expect(TRIVIEW_LIVE_MESH_PIN).toBe("firtoz/trellis");
  });

  it("skips when flag off — does not call fetch", async () => {
    const fetchFn = vi.fn();
    const log = vi.fn();
    const artifact = await runTriViewShadowCompare(
      {
        imageBase64: "aaaa",
        trellisGlbUrl: "https://replicate.delivery/example/trellis.glb",
      },
      { flagEnabled: false, fetchFn, audit: { log, error: vi.fn() } },
    );
    expect(artifact.skipped).toBe(true);
    expect(artifact.skip_reason).toBe("flag_off");
    expect(artifact.replaces_live_trellis).toBe(false);
    expect(artifact.used_for_routing).toBe(false);
    expect(artifact.live_mesh_pin).toBe("firtoz/trellis");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses InstantMesh model equal to live TRELLIS pin", async () => {
    const artifact = await runTriViewShadowCompare(
      {
        frames: {
          medial: "m",
          plantar: "p",
          lateral: "l",
        },
        trellisGlbUrl: "https://example.com/t.glb",
      },
      {
        flagEnabled: true,
        replicateToken: "tok",
        instantMeshModel: "firtoz/trellis",
        audit: { log: vi.fn(), error: vi.fn() },
      },
    );
    expect(artifact.skip_reason).toBe("refuses_live_pin");
    expect(artifact.replaces_live_trellis).toBe(false);
    expect(artifact.winner_shadow_only).toBe("trellis");
  });

  it("scaffolds without remote model (fail-soft)", async () => {
    const artifact = await runTriViewShadowCompare(
      {
        frames: { medial: "m", plantar: "p", lateral: "l" },
        trellisGlbUrl: "https://example.com/t.glb",
      },
      {
        flagEnabled: true,
        replicateToken: "tok",
        instantMeshModel: "",
        audit: { log: vi.fn(), error: vi.fn() },
      },
    );
    expect(artifact.skip_reason).toBe("missing_instantmesh_model");
    expect(artifact.frames_present).toEqual(["medial", "plantar", "lateral"]);
    expect(artifact.trellis_glb_url).toContain("example.com");
    expect(artifact.winner_shadow_only).toBe("trellis");
    expect(artifact.replaces_live_trellis).toBe(false);
  });
});
