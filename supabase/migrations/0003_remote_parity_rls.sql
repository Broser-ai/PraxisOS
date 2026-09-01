-- PraxisOS · remote parity (merged from Supabase Cloud project jajdtvduzkitjzcazcng)
-- Source: supabase_migrations.schema_migrations · enable_rls_core_tables (20260616074751)
-- Plus: tenants.trial column (present remotely, missing in repo 0001) and modality UTF-8 fix.
--
-- Idempotent where possible. Safe on fresh local (after 0001/0002) and on empty remote.

-- ========================================================================
-- 1. Schema parity with remote initial_schema
-- ========================================================================

alter table tenants
  add column if not exists trial jsonb;

-- App + seed use Danish "Hjemmebesøg"; remote cloud used ASCII "Hjemmebesoeg".
-- Align constraint + existing rows toward the app contract.
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'bookings' and constraint_name like '%modality%'
  ) or exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%modality%'
  ) then
    update bookings set modality = 'Hjemmebesøg' where modality = 'Hjemmebesoeg';
    alter table bookings drop constraint if exists bookings_modality_check;
    alter table bookings
      add constraint bookings_modality_check
      check (modality in ('Klinik', 'Hjemmebesøg', 'Video'));
  end if;
exception
  when others then
    -- If constraint name differs, still try a best-effort rename of values.
    update bookings set modality = 'Hjemmebesøg' where modality = 'Hjemmebesoeg';
end $$;

-- Harden trigger functions (Supabase advisor: function_search_path_mutable)
create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function audit_hash_chain() returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare prev text;
begin
  select hash into prev from audit_log
    where tenant_id = new.tenant_id
    order by at desc limit 1;
  new.prev_hash = coalesce(prev, '0x0');
  new.hash = encode(digest(
    new.tenant_id::text || '|' || new.action || '|' || coalesce(new.target_cpr_hashed,'') || '|' || new.at::text || '|' || new.prev_hash,
    'sha256'
  ), 'hex');
  return new;
end $$;

-- ========================================================================
-- 2. RLS on tenants / users / memberships (remote-only until this file)
-- ========================================================================

alter table tenants     enable row level security;
alter table users       enable row level security;
alter table memberships enable row level security;

-- Tenants: anon may read (public clinic branding on /t/[slug])
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenants' and policyname = 'tenants_anon_read'
  ) then
    create policy tenants_anon_read on tenants for select
      to anon
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenants' and policyname = 'tenants_authenticated_read'
  ) then
    create policy tenants_authenticated_read on tenants for select
      to authenticated
      using (
        id = (current_setting('app.tenant_id', true))::uuid
        OR current_setting('app.role', true) = 'support'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'users_self_read'
  ) then
    create policy users_self_read on users for select
      to authenticated
      using (
        mitid_subject = current_setting('app.user_subject', true)
        OR email = current_setting('app.user_email', true)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'memberships' and policyname = 'memberships_self_read'
  ) then
    create policy memberships_self_read on memberships for select
      to authenticated
      using (
        user_id = (
          select id from users
          where mitid_subject = current_setting('app.user_subject', true)
             or email = current_setting('app.user_email', true)
          limit 1
        )
      );
  end if;
end $$;

-- Legacy policy from remote initial_schema (public role SELECT) — keep for parity.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenants' and policyname = 'tenants_select'
  ) then
    create policy tenants_select on tenants for select
      using (
        id = (current_setting('app.tenant_id', true))::uuid
        OR current_setting('app.role', true) = 'support'
      );
  end if;
end $$;

-- service_role bypasses RLS on Supabase / PostgREST — no extra write policies needed.
