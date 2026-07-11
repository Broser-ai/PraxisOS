-- PraxisOS · EPIC 2 · Clinical Scanner & S-Agent
-- Migration: 0004_clinical_scanner.sql
-- Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §4
-- Godkendt: 2026-07-11 (Michael)
-- IKKE APPLIED til prod endnu · afventer feature-flag AGENT_SCANNER_V2_ENABLED

-- =============================================================================
-- 1. Udvid scans-tabellen (§4.1)
-- =============================================================================

ALTER TABLE IF EXISTS scans
  ADD COLUMN IF NOT EXISTS raw_frames_url text,
  ADD COLUMN IF NOT EXISTS sparse_cloud_url text,
  ADD COLUMN IF NOT EXISTS dense_mesh_url text,
  ADD COLUMN IF NOT EXISTS stl_url text,
  ADD COLUMN IF NOT EXISTS scanner_version text NOT NULL DEFAULT 'v1-manual'
    CHECK (scanner_version IN ('v1-manual','v2-sagent')),
  ADD COLUMN IF NOT EXISTS vlm_model_version text,
  ADD COLUMN IF NOT EXISTS findings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS watertight boolean,
  ADD COLUMN IF NOT EXISTS quality_score numeric(3,2),
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_finished_at timestamptz;

-- INV-CS-6: alle findings SKAL have ai_generated=true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scans_findings_ai_generated'
  ) THEN
    ALTER TABLE scans ADD CONSTRAINT scans_findings_ai_generated
      CHECK (
        findings = '[]'::jsonb
        OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(findings) f
          WHERE COALESCE((f->>'ai_generated')::boolean, false) IS DISTINCT FROM true
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scans_client_processing_idx
  ON scans (client_id, processing_finished_at DESC);

-- =============================================================================
-- 2. Ny tabel scanner_runs (§4.2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS scanner_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  scan_id           uuid REFERENCES scans(id) ON DELETE CASCADE,
  client_id         uuid,
  actor_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  agent_run_id      uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  level             int  NOT NULL CHECK (level IN (1,2,3)),
  status            text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','done','error','aborted')),
  input             jsonb NOT NULL,
  output            jsonb,
  vlm_model_version text,
  frames_used       int,
  latency_ms        int,
  gpu_seconds       numeric(8,3),
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  error             jsonb,

  -- INV-CS-11: ingen råt CPR i scanner-runs
  CONSTRAINT scanner_runs_no_raw_cpr_input
    CHECK (input::text  !~ '\m\d{6}-?\d{4}\M'),
  CONSTRAINT scanner_runs_no_raw_cpr_output
    CHECK (output IS NULL OR output::text !~ '\m\d{6}-?\d{4}\M')
);

ALTER TABLE scanner_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scanner_runs_isolation ON scanner_runs;
CREATE POLICY scanner_runs_isolation ON scanner_runs
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS scanner_runs_tenant_started_idx
  ON scanner_runs (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS scanner_runs_status_idx
  ON scanner_runs (tenant_id, status)
  WHERE status IN ('running');

-- =============================================================================
-- 3. Feature-flag kolonner på tenants (§4.3)
-- =============================================================================

ALTER TABLE IF EXISTS tenants
  ADD COLUMN IF NOT EXISTS feature_cad_export boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_clinical_scanner_v2 boolean NOT NULL DEFAULT false;

-- =============================================================================
-- 4. Rollback (kommenteret ud)
-- =============================================================================
-- DROP TABLE IF EXISTS scanner_runs;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS feature_cad_export;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS feature_clinical_scanner_v2;
-- ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_findings_ai_generated;
-- ALTER TABLE scans DROP COLUMN IF EXISTS raw_frames_url,
--                   DROP COLUMN IF EXISTS sparse_cloud_url,
--                   DROP COLUMN IF EXISTS dense_mesh_url,
--                   DROP COLUMN IF EXISTS stl_url,
--                   DROP COLUMN IF EXISTS scanner_version,
--                   DROP COLUMN IF EXISTS vlm_model_version,
--                   DROP COLUMN IF EXISTS findings,
--                   DROP COLUMN IF EXISTS watertight,
--                   DROP COLUMN IF EXISTS quality_score,
--                   DROP COLUMN IF EXISTS processing_started_at,
--                   DROP COLUMN IF EXISTS processing_finished_at;
