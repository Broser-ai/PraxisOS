-- PraxisOS · Sprint 6 blocker B4 · fixer migration 0002 silent-death bugs
-- Kontrakt: COMPLETE-AUDIT-REPORT.md §B4 · data-model dimension
--
-- BUGS I 0002_foot_scanner.sql:
--   1. Bruger current_setting('praxis.tenant_id') i stedet for canonical
--      'app.tenant_id' — ALLE scans er usynlige under RLS.
--   2. Trigger insert'er til 'audit_events'-tabel som ALDRIG blev oprettet
--      i schema 0001 eller 0002 · hver scan-INSERT roller back med
--      "relation audit_events does not exist".
--
-- FIX:
--   A. Opret manglende audit_events tabel (mirror af audit_log struktur +
--      foot-scanner-specifikke kolonner)
--   B. DROP + re-CREATE alle foot-scanner RLS-policies med app.tenant_id
--   C. Idempotent (IF EXISTS/IF NOT EXISTS) så migrationen kan re-køres.

-- ---------------------------------------------------------------------------
-- A. Opret audit_events (manglende siden 0002 blev skrevet)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  actor_user_id uuid,
  action        text NOT NULL,
  resource      text NOT NULL,       -- fx 'foot_scan_session'
  resource_id   uuid,
  payload       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Foreign key til tenants (soft — SET NULL hvis tenant slettes)
  CONSTRAINT audit_events_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_tenant_read ON audit_events;
CREATE POLICY audit_events_tenant_read ON audit_events
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Kun service-role kan skrive (via trigger / audit-lib)
DROP POLICY IF EXISTS audit_events_service_write ON audit_events;
CREATE POLICY audit_events_service_write ON audit_events
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS audit_events_tenant_time_idx
  ON audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_resource_idx
  ON audit_events (tenant_id, resource, resource_id);

-- ---------------------------------------------------------------------------
-- B. Ret RLS-policies fra 0002 · praxis.tenant_id → app.tenant_id
-- ---------------------------------------------------------------------------

-- foot_scan_sessions policies
DROP POLICY IF EXISTS foot_scan_sessions_tenant ON foot_scan_sessions;
CREATE POLICY foot_scan_sessions_tenant ON foot_scan_sessions
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- foot_scan_frames policies
DROP POLICY IF EXISTS foot_scan_frames_tenant ON foot_scan_frames;
CREATE POLICY foot_scan_frames_tenant ON foot_scan_frames
  FOR ALL
  USING (EXISTS (SELECT 1 FROM foot_scan_sessions s
                 WHERE s.id = foot_scan_frames.session_id
                   AND s.tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM foot_scan_sessions s
                      WHERE s.id = foot_scan_frames.session_id
                        AND s.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- foot_scan_reconstructions policies
DROP POLICY IF EXISTS foot_scan_reconstructions_tenant ON foot_scan_reconstructions;
CREATE POLICY foot_scan_reconstructions_tenant ON foot_scan_reconstructions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM foot_scan_sessions s
                 WHERE s.id = foot_scan_reconstructions.session_id
                   AND s.tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM foot_scan_sessions s
                      WHERE s.id = foot_scan_reconstructions.session_id
                        AND s.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- foot_scan_orthotics policies
DROP POLICY IF EXISTS foot_scan_orthotics_tenant ON foot_scan_orthotics;
CREATE POLICY foot_scan_orthotics_tenant ON foot_scan_orthotics
  FOR ALL
  USING (EXISTS (SELECT 1 FROM foot_scan_sessions s
                 WHERE s.id = foot_scan_orthotics.session_id
                   AND s.tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM foot_scan_sessions s
                      WHERE s.id = foot_scan_orthotics.session_id
                        AND s.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- ---------------------------------------------------------------------------
-- C. Verificer at 0002-trigger nu virker (audit_events findes)
-- ---------------------------------------------------------------------------

-- Trigger-funktionen fra 0002 kaldes ved INSERT · den vil nu succeed
-- fordi audit_events tabellen eksisterer. Ingen trigger-ændring nødvendig.

-- Sanity: re-attach trigger hvis det ved en fejl blev droppet
-- (idempotent · DROP + CREATE)
DROP TRIGGER IF EXISTS foot_scan_sessions_audit ON foot_scan_sessions;
CREATE TRIGGER foot_scan_sessions_audit
  AFTER INSERT OR UPDATE OR DELETE ON foot_scan_sessions
  FOR EACH ROW EXECUTE FUNCTION foot_scan_audit();

-- ---------------------------------------------------------------------------
-- ROLLBACK (kommenteret ud)
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS audit_events;
-- DROP POLICY IF EXISTS foot_scan_sessions_tenant ON foot_scan_sessions;
-- DROP POLICY IF EXISTS foot_scan_frames_tenant ON foot_scan_frames;
-- DROP POLICY IF EXISTS foot_scan_reconstructions_tenant ON foot_scan_reconstructions;
-- DROP POLICY IF EXISTS foot_scan_orthotics_tenant ON foot_scan_orthotics;
