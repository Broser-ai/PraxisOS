-- PraxisOS · EPIC 1 · Multi-Agent Orchestration
-- Migration: 0003_langgraph_state.sql
-- Formål: Persistent state for LangGraph Supervisor (agent_runs + agent_steps)
-- Kontrakt: docs/harness/EPIC-1-Orchestration.md §2 og §3
-- Godkendt: 2026-07-11 · Michael (Orchestrator)
-- IKKE APPLIED til prod endnu · afventer feature-flag AGENT_ORCHESTRATION_ENABLED=true

-- =============================================================================
-- 1. agent_runs · én række pr. Supervisor-invocation
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role        text NOT NULL CHECK (actor_role IN ('owner','practitioner','reception','support','system')),
  origin            text NOT NULL CHECK (origin IN ('chat','scribe','booking','felt','cron','api','portal')),
  origin_ref        text,
  status            text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','done','error','aborted','processing')),
  final_agent       text CHECK (final_agent IS NULL OR final_agent IN (
                      'supervisor','aria','niels','sigrid','magnus','frej','vega','bjorn','liv','atlas'
                    )),
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  input             jsonb NOT NULL,
  output            jsonb,
  token_usage       jsonb DEFAULT '{"prompt":0,"completion":0,"cost_oere":0}'::jsonb,
  error             jsonb,
  step_count        int  NOT NULL DEFAULT 0,

  -- INV-3: intet råt CPR i input/output (regex-guard på JSONB tekstindhold)
  CONSTRAINT agent_runs_no_raw_cpr_input
    CHECK (input::text  !~ '\m\d{6}-?\d{4}\M'),
  CONSTRAINT agent_runs_no_raw_cpr_output
    CHECK (output IS NULL OR output::text !~ '\m\d{6}-?\d{4}\M'),

  -- INV-15: max 12 node-transitioner
  CONSTRAINT agent_runs_max_steps CHECK (step_count <= 12)
);

COMMENT ON TABLE agent_runs IS
  'Én række pr. LangGraph Supervisor-invocation. Se docs/harness/EPIC-1-Orchestration.md';

-- =============================================================================
-- 2. agent_steps · én række pr. node-execution inde i et run (checkpoint)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL,  -- denormaliseret for RLS-effektivitet
  step_index        int  NOT NULL CHECK (step_index >= 0 AND step_index <= 12),
  node              text NOT NULL CHECK (node IN (
                      'supervisor','aria','niels','sigrid','magnus','frej',
                      'vega','bjorn','liv','atlas','tool','END'
                    )),
  agent_id          text,
  tool_name         text,
  tool_call_id      text,
  input_state       jsonb NOT NULL,
  output_state      jsonb NOT NULL,
  latency_ms        int CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (run_id, step_index),

  -- INV-3: intet råt CPR i input/output state
  CONSTRAINT agent_steps_no_raw_cpr_input
    CHECK (input_state::text  !~ '\m\d{6}-?\d{4}\M'),
  CONSTRAINT agent_steps_no_raw_cpr_output
    CHECK (output_state::text !~ '\m\d{6}-?\d{4}\M'),

  -- INV-4: tool-nodes skal have tool_name + tool_call_id
  CONSTRAINT agent_steps_tool_shape
    CHECK (
      (node != 'tool') OR
      (tool_name IS NOT NULL AND tool_call_id IS NOT NULL)
    )
);

COMMENT ON TABLE agent_steps IS
  'Én række pr. node-execution inde i agent_runs. Bruges til replay/debug/audit.';

-- =============================================================================
-- 3. Row-Level Security (INV-1, INV-2)
-- =============================================================================

ALTER TABLE agent_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_steps ENABLE ROW LEVEL SECURITY;

-- Standard tenant-isolation (samme mønster som resten af skemaet, jf. HANDOVER §2.3)
DROP POLICY IF EXISTS agent_runs_isolation ON agent_runs;
CREATE POLICY agent_runs_isolation ON agent_runs
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS agent_steps_isolation ON agent_steps;
CREATE POLICY agent_steps_isolation ON agent_steps
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Support-rolle: kan læse cross-tenant til triage (INV-2: aldrig skrive cross-tenant)
DROP POLICY IF EXISTS agent_runs_support_read ON agent_runs;
CREATE POLICY agent_runs_support_read ON agent_runs
  FOR SELECT
  USING (current_setting('app.role', true) = 'support');

DROP POLICY IF EXISTS agent_steps_support_read ON agent_steps;
CREATE POLICY agent_steps_support_read ON agent_steps
  FOR SELECT
  USING (current_setting('app.role', true) = 'support');

-- =============================================================================
-- 4. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS agent_runs_tenant_started_idx
  ON agent_runs (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS agent_runs_status_idx
  ON agent_runs (tenant_id, status)
  WHERE status IN ('running','processing');

CREATE INDEX IF NOT EXISTS agent_steps_run_index_idx
  ON agent_steps (run_id, step_index);

CREATE INDEX IF NOT EXISTS agent_steps_tenant_created_idx
  ON agent_steps (tenant_id, created_at DESC);

-- =============================================================================
-- 5. Trigger · sync step_count på agent_runs (understøtter INV-15)
-- =============================================================================

CREATE OR REPLACE FUNCTION agent_runs_sync_step_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agent_runs
    SET step_count = (SELECT count(*) FROM agent_steps WHERE run_id = NEW.run_id)
    WHERE id = NEW.run_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_runs_step_count ON agent_steps;
CREATE TRIGGER trg_agent_runs_step_count
  AFTER INSERT ON agent_steps
  FOR EACH ROW
  EXECUTE FUNCTION agent_runs_sync_step_count();

-- =============================================================================
-- 6. Rollback-script (kør omvendt hvis migration skal trækkes tilbage)
-- =============================================================================
--
-- DROP TRIGGER IF EXISTS trg_agent_runs_step_count ON agent_steps;
-- DROP FUNCTION IF EXISTS agent_runs_sync_step_count();
-- DROP TABLE IF EXISTS agent_steps;
-- DROP TABLE IF EXISTS agent_runs;
