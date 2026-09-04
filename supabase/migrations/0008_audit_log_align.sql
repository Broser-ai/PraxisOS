-- 0008_audit_log_align.sql
-- Align audit_log schema with what lib/audit.ts persistSupabase() sends.
--
-- Problem (P0 plan §D.1): persistSupabase POSTs
--   at, action, tenant_id, actor_user_id, target_ref, meta, level
-- but the 0001 audit_log columns are
--   tenant_id, user_id, target_cpr_hashed, action, resource_type, resource_id,
--   purpose, treatment_ref, ip, user_agent, geo, hash, prev_hash, at
-- → no actor_user_id / target_ref / meta / level → supabase-mode drops data.
--
-- NOTE: plan originally numbered this 0005_audit_log_align.sql, but 0005/0006
-- were taken by mission_snapshots / prime_missions_relational in the live tree,
-- so this lands as 0008. Consent events landed as 0007.
--
-- Additive only (no drops, no renames) — safe to apply on a populated table.

alter table audit_log
  add column if not exists actor_user_id text,
  add column if not exists target_ref    text,
  add column if not exists meta          jsonb not null default '{}',
  add column if not exists level         text not null default 'info',
  add column if not exists request_id    text,
  add column if not exists route         text,
  add column if not exists auth_mode     text;

-- level normalization + check
alter table audit_log
  add constraint audit_log_level_chk
    check (level in ('info', 'warn', 'error'));

-- Index for tenant-scoped audit reads (recent-first) used by ops dashboards.
create index if not exists audit_log_tenant_at_idx
  on audit_log (tenant_id, at desc);

create index if not exists audit_log_actor_idx
  on audit_log (actor_user_id);

create index if not exists audit_log_target_ref_idx
  on audit_log (target_ref);

-- Helpful view: map legacy user_id (uuid users) to actor_user_id for reads
-- that want a unified actor column. (No data movement; view only.)
create or replace view audit_log_unified as
  select
    *,
    coalesce(actor_user_id, user_id::text) as unified_actor
  from audit_log;
