-- PraxisOS · Sprint 6 Batch 3 · RLS paa delte core-tabeller
-- Migration: 0009_enable_rls_on_shared_tables.sql
-- Kontrakt: COMPLETE-AUDIT-REPORT.md
--   · DM-04 (data-model): RLS mangler paa users, memberships, tenants, learning_content
--   · SEC-15 (security): learning_content har hverken tenant_id eller RLS
--   · R§C5 (regulatory): compromised anon/service token enumerate alle klinikere
--
-- Efter denne migration:
--   * users: SELECT tilladt hvis current auth-user er == users.id, ellers hvis
--     bruger deler mindst en tenant med raekken (via memberships).
--   * memberships: SELECT tilladt kun for egne rows + support-role.
--   * tenants: SELECT tilladt hvis current tenant_id-setting matcher (extending
--     0001's simple policy med explicit ENABLE og WITH CHECK for INSERT/UPDATE).
--   * learning_content: FAAAR tenant_id kolonne (tilbagevirkende NULL for
--     global læringsstof) + RLS med policy der tillader:
--       - SELECT: samme tenant ELLER global (tenant_id IS NULL)
--       - INSERT/UPDATE: kun samme tenant (ingen tenant kan traedes paa global)
--
-- Alt er idempotent · migrationen kan re-koeres.

-- ---------------------------------------------------------------------------
-- A. USERS · enable RLS + policies
-- ---------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Bruger kan altid se sig selv (matcher current_setting('app.user_id'))
DROP POLICY IF EXISTS users_self_read ON users;
CREATE POLICY users_self_read ON users
  FOR SELECT
  USING (
    id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

-- Bruger kan se andre users der deler mindst en tenant med sig selv
-- (nødvendigt for practitioner-lister, agent-dispatch, journal-authorship)
DROP POLICY IF EXISTS users_shared_tenant_read ON users;
CREATE POLICY users_shared_tenant_read ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m_self
      JOIN memberships m_other ON m_other.tenant_id = m_self.tenant_id
      WHERE m_self.user_id  = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND m_other.user_id = users.id
        AND m_self.active   = true
        AND m_other.active  = true
    )
  );

-- Support-role kan se alt (til debugging + kundesupport). Escape hatch der
-- kraever aktiv role-switch via current_setting('app.role').
DROP POLICY IF EXISTS users_support_read ON users;
CREATE POLICY users_support_read ON users
  FOR SELECT
  USING (current_setting('app.role', true) = 'support');

-- Ingen INSERT/UPDATE/DELETE via anon-role · brugere oprettes via
-- service-role (signup-flow) med RLS bypass.

-- ---------------------------------------------------------------------------
-- B. MEMBERSHIPS · enable RLS + policies
-- ---------------------------------------------------------------------------

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Bruger kan se sine egne memberships
DROP POLICY IF EXISTS memberships_self_read ON memberships;
CREATE POLICY memberships_self_read ON memberships
  FOR SELECT
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

-- Tenant-admins (owner-role paa tenant) kan se alle memberships i tenanten
DROP POLICY IF EXISTS memberships_tenant_admin_read ON memberships;
CREATE POLICY memberships_tenant_admin_read ON memberships
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM memberships m_admin
      WHERE m_admin.user_id   = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND m_admin.tenant_id = memberships.tenant_id
        AND m_admin.role      = 'owner'
        AND m_admin.active    = true
    )
  );

-- Support-role kan se alt
DROP POLICY IF EXISTS memberships_support_read ON memberships;
CREATE POLICY memberships_support_read ON memberships
  FOR SELECT
  USING (current_setting('app.role', true) = 'support');

-- INSERT/UPDATE/DELETE kun via service-role.

-- ---------------------------------------------------------------------------
-- C. TENANTS · re-assert RLS (0001 lavede SELECT-policy men aldrig ENABLE)
-- ---------------------------------------------------------------------------

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 0001 lavede allerede en select-policy · re-create idempotent med samme navn
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants
  FOR SELECT
  USING (
    id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR current_setting('app.role', true) = 'support'
  );

-- Tenant-owner kan opdatere sin egen tenant (brand-config, contact osv.)
DROP POLICY IF EXISTS tenants_owner_update ON tenants;
CREATE POLICY tenants_owner_update ON tenants
  FOR UPDATE
  USING (
    id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = tenants.id
        AND m.user_id   = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND m.role      = 'owner'
        AND m.active    = true
    )
  )
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- INSERT (oprette ny tenant) kun via service-role (onboarding-scripts).
-- DELETE aldrig via RLS · cascading er destruktivt for hele klinikkens data.

-- ---------------------------------------------------------------------------
-- D. LEARNING_CONTENT · tilfoej tenant_id + enable RLS (SEC-15 + DM-04)
-- ---------------------------------------------------------------------------

-- Tilfoej tenant_id · NULL betyder "global (delt paa tvaers af tenants)"
ALTER TABLE learning_content
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS learning_content_tenant_idx
  ON learning_content (tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE learning_content ENABLE ROW LEVEL SECURITY;

-- SELECT: samme tenant ELLER global (NULL). Global-content er evidens-baseret
-- paedagogisk materiale (EPIC 4 kontrakt) og er by-design synligt for alle
-- authentificerede tenants.
DROP POLICY IF EXISTS learning_content_select ON learning_content;
CREATE POLICY learning_content_select ON learning_content
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- INSERT/UPDATE/DELETE: kun for egen tenant · ingen kan overskrive global content
-- (den skal oprettes via service-role signup-scripts, ikke tenant-flow).
DROP POLICY IF EXISTS learning_content_insert ON learning_content;
CREATE POLICY learning_content_insert ON learning_content
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS learning_content_update ON learning_content;
CREATE POLICY learning_content_update ON learning_content
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS learning_content_delete ON learning_content;
CREATE POLICY learning_content_delete ON learning_content
  FOR DELETE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- Support-role escape-hatch
DROP POLICY IF EXISTS learning_content_support_read ON learning_content;
CREATE POLICY learning_content_support_read ON learning_content
  FOR SELECT
  USING (current_setting('app.role', true) = 'support');

-- ---------------------------------------------------------------------------
-- E. Rollback (kommenteret ud)
-- ---------------------------------------------------------------------------
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS users_self_read ON users;
-- DROP POLICY IF EXISTS users_shared_tenant_read ON users;
-- DROP POLICY IF EXISTS users_support_read ON users;
--
-- ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS memberships_self_read ON memberships;
-- DROP POLICY IF EXISTS memberships_tenant_admin_read ON memberships;
-- DROP POLICY IF EXISTS memberships_support_read ON memberships;
--
-- ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tenants_select ON tenants;
-- DROP POLICY IF EXISTS tenants_owner_update ON tenants;
--
-- ALTER TABLE learning_content DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE learning_content DROP COLUMN IF EXISTS tenant_id;
-- DROP POLICY IF EXISTS learning_content_select ON learning_content;
-- DROP POLICY IF EXISTS learning_content_insert ON learning_content;
-- DROP POLICY IF EXISTS learning_content_update ON learning_content;
-- DROP POLICY IF EXISTS learning_content_delete ON learning_content;
-- DROP POLICY IF EXISTS learning_content_support_read ON learning_content;
