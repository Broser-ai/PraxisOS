-- PraxisOS · C6 · FK cascade holes
-- Migration: 0010_fix_fk_cascade_holes.sql
--
-- 0001_initial_schema.sql efterlod fire FK'er med forkert/manglende
-- ON DELETE-semantik:
--   * events.tenant_id      -> ingen ON DELETE (NO ACTION)   => skal vaere CASCADE
--   * scans.client_id       -> ingen ON DELETE (NO ACTION)   => skal vaere RESTRICT
--   * bookings.client_id    -> allerede ON DELETE SET NULL   => re-assert
--   * journals.client_id    -> ON DELETE CASCADE (forkert!)  => skal vaere RESTRICT
--     (medicinsk journal maa ikke destrueres ved klient-erasure)
--
-- Idempotent: dropper eksisterende FK dynamisk (uanset constraint-navn) og
-- genopretter med deterministisk navn + korrekt ON DELETE. Skipper ALTER hvis
-- tabel eller kolonne ikke findes (logget som RAISE NOTICE).

do $$
declare
  fk_name text;
begin
  -- -------------------------------------------------------------------
  -- 1. events.tenant_id -> tenants(id) ON DELETE CASCADE
  -- -------------------------------------------------------------------
  if to_regclass('public.events') is null then
    raise notice 'SKIP: table events findes ikke';
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'tenant_id'
  ) then
    raise notice 'SKIP: events.tenant_id findes ikke';
  else
    select con.conname into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'events'
      and con.contype = 'f'
      and (select attname from pg_attribute
           where attrelid = con.conrelid and attnum = con.conkey[1]) = 'tenant_id'
    limit 1;

    if fk_name is not null then
      execute format('alter table public.events drop constraint %I', fk_name);
    end if;

    alter table public.events
      add constraint events_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;

  -- -------------------------------------------------------------------
  -- 2. scans.client_id -> clients(id) ON DELETE RESTRICT
  --    (medicinsk journal-relateret data maa ikke destrueres)
  -- -------------------------------------------------------------------
  if to_regclass('public.scans') is null then
    raise notice 'SKIP: table scans findes ikke';
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scans' and column_name = 'client_id'
  ) then
    raise notice 'SKIP: scans.client_id findes ikke';
  else
    select con.conname into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'scans'
      and con.contype = 'f'
      and (select attname from pg_attribute
           where attrelid = con.conrelid and attnum = con.conkey[1]) = 'client_id'
    limit 1;

    if fk_name is not null then
      execute format('alter table public.scans drop constraint %I', fk_name);
    end if;

    alter table public.scans
      add constraint scans_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete restrict;
  end if;

  -- -------------------------------------------------------------------
  -- 3. bookings.client_id -> clients(id) ON DELETE SET NULL
  --    (allerede korrekt i 0001 · re-assert idempotent)
  -- -------------------------------------------------------------------
  if to_regclass('public.bookings') is null then
    raise notice 'SKIP: table bookings findes ikke';
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'client_id'
  ) then
    raise notice 'SKIP: bookings.client_id findes ikke';
  else
    select con.conname into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'bookings'
      and con.contype = 'f'
      and (select attname from pg_attribute
           where attrelid = con.conrelid and attnum = con.conkey[1]) = 'client_id'
    limit 1;

    if fk_name is not null then
      execute format('alter table public.bookings drop constraint %I', fk_name);
    end if;

    alter table public.bookings
      add constraint bookings_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;

  -- -------------------------------------------------------------------
  -- 4. journals.client_id -> clients(id) ON DELETE RESTRICT
  --    (var CASCADE i 0001 · medicinsk journal maa ikke destrueres ved
  --    klient-erasure)
  -- -------------------------------------------------------------------
  if to_regclass('public.journals') is null then
    raise notice 'SKIP: table journals findes ikke';
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'journals' and column_name = 'client_id'
  ) then
    raise notice 'SKIP: journals.client_id findes ikke';
  else
    select con.conname into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'journals'
      and con.contype = 'f'
      and (select attname from pg_attribute
           where attrelid = con.conrelid and attnum = con.conkey[1]) = 'client_id'
    limit 1;

    if fk_name is not null then
      execute format('alter table public.journals drop constraint %I', fk_name);
    end if;

    alter table public.journals
      add constraint journals_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete restrict;
  end if;
end $$;
