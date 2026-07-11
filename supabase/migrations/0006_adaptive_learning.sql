-- PraxisOS · EPIC 4 · Adaptive E-Learning
-- Migration: 0006_adaptive_learning.sql
-- Kontrakt: docs/harness/EPIC-4-ELearning.md §2
-- IKKE APPLIED til prod endnu · feature-flag AGENT_LEARNING_ENABLED

CREATE TABLE IF NOT EXISTS learning_content (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  body_md       text NOT NULL,
  tags          text[] NOT NULL DEFAULT '{}',
  source_url    text,
  language      text NOT NULL DEFAULT 'da' CHECK (language IN ('da','en')),
  embedding     vector(1536),
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- INV-EL-2: evidence-based
  CONSTRAINT learning_content_requires_source
    CHECK (source_url IS NOT NULL AND length(source_url) > 8)
);

CREATE INDEX IF NOT EXISTS learning_content_tags_idx
  ON learning_content USING GIN (tags);

CREATE INDEX IF NOT EXISTS learning_content_language_idx
  ON learning_content (language);

CREATE TABLE IF NOT EXISTS learning_paths (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id     uuid,
  scan_id       uuid REFERENCES scans(id) ON DELETE SET NULL,
  path_json     jsonb NOT NULL,
  progress_pct  numeric(5,2) NOT NULL DEFAULT 0
                CHECK (progress_pct >= 0 AND progress_pct <= 100),
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','paused','completed','archived')),
  language      text NOT NULL DEFAULT 'da' CHECK (language IN ('da','en')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- INV-EL-4: ingen råt CPR
  CONSTRAINT learning_paths_no_raw_cpr
    CHECK (path_json::text !~ '\m\d{6}-?\d{4}\M')
);

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_paths_isolation ON learning_paths;
CREATE POLICY learning_paths_isolation ON learning_paths
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS learning_paths_tenant_client_idx
  ON learning_paths (tenant_id, client_id, updated_at DESC);

-- Trigger: monotont voksende progress (INV-EL-7)
CREATE OR REPLACE FUNCTION learning_paths_progress_monotone()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.progress_pct < OLD.progress_pct THEN
    RAISE EXCEPTION 'INV-EL-7 violation: progress cannot decrease (was %, got %)',
      OLD.progress_pct, NEW.progress_pct;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learning_paths_progress_monotone ON learning_paths;
CREATE TRIGGER trg_learning_paths_progress_monotone
  BEFORE UPDATE ON learning_paths
  FOR EACH ROW EXECUTE FUNCTION learning_paths_progress_monotone();

-- Rollback:
-- DROP TABLE IF EXISTS learning_paths;
-- DROP TABLE IF EXISTS learning_content;
-- DROP FUNCTION IF EXISTS learning_paths_progress_monotone();
