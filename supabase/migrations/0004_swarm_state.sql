-- PraxisOS · Swarm durable state (cross-instance on Vercel)
-- Migration: 0004_swarm_state.sql
-- Stores meta-harness tasks/journals/worktrees/daemon slice as JSON snapshots.
-- Service-role writes from Next.js; RLS denies anon/authenticated direct access.

CREATE TABLE IF NOT EXISTS swarm_snapshots (
  id            text PRIMARY KEY DEFAULT 'global',
  tenant_slug   text,
  payload       jsonb NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  revision      bigint NOT NULL DEFAULT 1
);

COMMENT ON TABLE swarm_snapshots IS
  'Durable S-H swarm memory · written by PraxisOS service role on flush';

ALTER TABLE swarm_snapshots ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → only service_role bypasses RLS.
-- Intentional: swarm internals are platform-ops, not tenant end-user data.

CREATE OR REPLACE FUNCTION swarm_snapshots_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  NEW.revision = COALESCE(OLD.revision, 0) + 1;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS swarm_snapshots_touch ON swarm_snapshots;
CREATE TRIGGER swarm_snapshots_touch
  BEFORE UPDATE ON swarm_snapshots
  FOR EACH ROW EXECUTE FUNCTION swarm_snapshots_touch();
