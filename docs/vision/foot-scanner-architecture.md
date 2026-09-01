> **Archive port (additive)** · Source: Google Drive monorepo `ARCHITECTURE.md` (juli 2026). Historical architecture narrative — verify against current PraxisOS scanner routes before acting.
>
> **Clinical gate:** ICD / biomechanics / orthotic outputs described here are **suggestions only**. Pathology candidates stay shadow until clinician-adjudicated gates. No autonomous diagnosis, triage, or treatment.

# Foot-Scanner · Architecture

## 1. Layers

```
┌────────────────────────────────────────────────────────────────────┐
│                     Capture surface (client-side)                  │
│  Smartphone getUserMedia · /scan/capture  ·  clinical hardware SDK │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ multipart / signed uploads
┌──────────────────────────────▼─────────────────────────────────────┐
│         PraxisOS Next.js  (prototype/app/api/v1/[tenant]/…)        │
│  Tenant auth · RLS via set_config('praxis.tenant_id') · rate limit │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ Bearer FOOT_SCANNER_TOKEN
┌──────────────────────────────▼─────────────────────────────────────┐
│               Python engine — modules/foot-scanner                 │
│  FastAPI · Click CLI · stdio MCP · in-process pipeline             │
│                                                                    │
│  ┌────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────┐         │
│  │capture │─►│ calibrate │─►│ reconstruct  │─►│ mesh_ops │─┐       │
│  └────────┘  └───────────┘  └──────────────┘  └──────────┘ ▼       │
│                                             ┌─────────────────┐    │
│                                             │  biomech        │    │
│                                             └──────┬──────────┘    │
│                                                    ▼               │
│                                             ┌─────────────────┐    │
│                                             │  orthotic       │    │
│                                             └─────────────────┘    │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ files
┌──────────────────────────────▼─────────────────────────────────────┐
│          Supabase — Postgres (RLS) + Storage bucket                │
│                foot_scan_sessions / _frames / _reports             │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Data flow

1. **Capture** — operator opens `/scan/capture` on a phone. A4 sheet under
   the foot; 8–15 frames around a hemisphere. IMU quaternions are stored in
   sidecar JSON per frame for later pose-priors.
2. **Calibration** — first frame is passed through `calibrate.auto_calibrate`
   which tries A4 contour → ArUco → SAM zero-shot. Output is
   millimeters-per-pixel + world plane.
3. **Reconstruction** — chosen engine runs:
   - *colmap+open3d* (default): COLMAP `automatic_reconstructor` → dense
     `fused.ply` → Open3D voxel-downsample → Poisson meshing.
   - *neural_meshing*: casual-capture neural surface extraction.
   - *gaussian_splat*: Gaussian Splatting via nerfstudio (optional).
   - *hybrid*: COLMAP for poses, splatting for texture, Open3D for the
     final watertight mesh.
4. **Mesh ops** — PCA-aligned to a canonical frame (heel at Y-min, ground
   at Z=0). Anatomic hole filling under the heel via ray-cast synthesis.
   Optional symmetric completion when a contralateral scan exists.
5. **Biomechanics** — arch index (Cavanagh & Rodgers 1987), hallux valgus
   proxy from 1st MTP deviation, navicular drop, pressure-zone estimation.
   Clinical bands drive `flag ∈ {ok, watch, warn, critical}` and ICD-10
   suggestions.
6. **Orthotic** — parametric OpenSCAD template consumes the report's
   dimensions plus operator spec (arch height, wedges, metatarsal pad),
   renders `.scad` → `.stl` via `openscad`. Manufacturing notes track
   material, print style, top-cover.

## 3. Multi-tenant / RLS

Every write path passes tenant through the URL (`/api/v1/[tenant]/…`).
Postgres RLS is enforced by `set_config('praxis.tenant_id', '<uuid>', true)`
before the query. Storage is bucket-per-project with path-prefix ACL.

The engine itself is single-tenant per session — the tenant lives on the
session row so Python never sees Postgres directly (kept stateless so it can
scale horizontally behind a load balancer).

## 4. Failure modes and fallbacks

| Symptom                              | Fallback                                                     |
|--------------------------------------|--------------------------------------------------------------|
| COLMAP not installed                 | `available_engines()` reports false; UI hides engine choice   |
| Fewer than 12 sharp frames           | `capture.ingest_video` rejects; UI prompts re-scan            |
| A4 not detected                      | `calibrate.auto_calibrate` falls back to letter → aruco       |
| Poisson mesh not watertight          | `stats.watertight=false`; volume is omitted; UI shows warning |
| `openscad` binary missing            | `.scad` still written; notes flag it; ship source to shop     |
| Python engine offline in dev         | Next.js MCP handler returns deterministic stub responses      |

## 5. Extension points

* **New sensor** (structured light / pressure mat) — implement an
  `ingest_*` in `capture.py`, add an enum to `CaptureSource`, wire into
  the CLI.
* **New reconstruction engine** — implement a function returning
  `open3d.geometry.TriangleMesh`, add it to `reconstruct.reconstruct`.
* **New clinical band** — extend `biomech._BANDS`. Add a metric to the
  report; no schema migration required (metrics is a list).
* **New CAD template** — drop a `.scad` alongside `openscad/orthotic.scad`
  and swap `orthotic.SCAD_TEMPLATE`.

## 6. Security

* Bearer token between Next.js and engine (`FOOT_SCANNER_TOKEN`).
* No PII inside frame filenames — files are indexed by session_id only.
* Audit trigger on `foot_scan_sessions` writes to `audit_events`.
* CORS on the engine is `*` because the engine is *not* internet-facing —
  it lives on the private VPC and is only reachable from the Next.js
  server.

## 7. Testing

```
pytest -q tests/                    # schema + orthotic template
python scripts/smoke_test.py        # import sanity
foot-scanner engines                # backend availability
```

## 8. Where the code lives

```
modules/foot-scanner/
├── ARCHITECTURE.md
├── README.md
├── pyproject.toml
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── src/foot_scanner/
│   ├── __init__.py
│   ├── schemas.py
│   ├── capture.py
│   ├── calibrate.py
│   ├── reconstruct.py
│   ├── mesh_ops.py
│   ├── biomech.py
│   ├── orthotic.py
│   ├── api.py
│   ├── cli.py
│   └── mcp_bridge.py
├── openscad/orthotic.scad
├── mcp/praxisos-foot-scanner.json
├── .claude/mcp.json
├── .claude/commands/scan.md
├── .mcp.json
├── scripts/smoke_test.py
└── tests/test_pipeline.py

prototype/
├── lib/
│   └── foot-scanner.ts                       # typed client
├── app/
│   ├── (internal)/scan/capture/page.tsx      # mobile capture UI
│   └── api/
│       ├── mcp/v1/route.ts                   # extended with foot_scan.* tools
│       └── v1/[tenant]/foot-scan/            # REST bridge
│           ├── sessions/route.ts
│           └── [sessionId]/
│               ├── frames/route.ts
│               ├── reconstruct/route.ts
│               ├── report/route.ts
│               └── orthotic/route.ts
└── supabase/migrations/0002_foot_scanner.sql
```
