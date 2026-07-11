-- PraxisOS · EPIC 3 · Neural Configurator
-- Migration: 0005_neural_configurator.sql
-- Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §5
-- IKKE APPLIED til prod endnu · feature-flag AGENT_CONFIGURATOR_ENABLED

CREATE TABLE IF NOT EXISTS orthotic_configurations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  scan_id           uuid REFERENCES scans(id) ON DELETE CASCADE,
  client_id         uuid,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','reviewed','locked','sent_to_lab','delivered')),
  biophysical_map   jsonb,
  orthotic_params   jsonb NOT NULL,
  cad_stl_url       text,
  approved_by       uuid REFERENCES users(id),
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- INV-NC-2
  CONSTRAINT orthotic_biophysical_ai_generated
    CHECK (
      biophysical_map IS NULL
      OR COALESCE((biophysical_map->>'ai_generated')::boolean, false) = true
    ),

  -- INV-NC-3 (grov)
  CONSTRAINT orthotic_params_valid
    CHECK (jsonb_typeof(orthotic_params) = 'object'),

  -- INV-NC-4: sent_to_lab kræver approval
  CONSTRAINT orthotic_sent_requires_approval
    CHECK (status != 'sent_to_lab' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

ALTER TABLE orthotic_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orthotic_configurations_isolation ON orthotic_configurations;
CREATE POLICY orthotic_configurations_isolation ON orthotic_configurations
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS orthotic_tenant_scan_idx
  ON orthotic_configurations (tenant_id, scan_id);

CREATE INDEX IF NOT EXISTS orthotic_status_idx
  ON orthotic_configurations (tenant_id, status);

-- Trigger: opdater updated_at
CREATE OR REPLACE FUNCTION orthotic_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orthotic_updated_at ON orthotic_configurations;
CREATE TRIGGER trg_orthotic_updated_at
  BEFORE UPDATE ON orthotic_configurations
  FOR EACH ROW EXECUTE FUNCTION orthotic_touch_updated_at();

-- Rollback:
-- DROP TABLE IF EXISTS orthotic_configurations;
-- DROP FUNCTION IF EXISTS orthotic_touch_updated_at();
