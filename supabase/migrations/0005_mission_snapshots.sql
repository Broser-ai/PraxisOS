-- PraxisOS · Prime Execution Control mission snapshots (optional durability)
-- Consumers: lib/prime/mission-store.ts (file mirror primary; this table for shared hosts)

create table if not exists mission_snapshots (
  id           text primary key,
  tenant_slug  text not null default 'bypilar',
  payload      jsonb not null default '{}'::jsonb,
  revision     bigint not null default 1,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists mission_snapshots_tenant_idx
  on mission_snapshots (tenant_slug);

create or replace function mission_snapshots_touch() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.revision = coalesce(old.revision, 0) + 1;
  return new;
end $$;

drop trigger if exists mission_snapshots_touch on mission_snapshots;
create trigger mission_snapshots_touch
  before update on mission_snapshots
  for each row execute function mission_snapshots_touch();

alter table mission_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mission_snapshots'
      and policyname = 'mission_snapshots_deny_anon'
  ) then
    create policy mission_snapshots_deny_anon on mission_snapshots
      for all to anon using (false) with check (false);
    create policy mission_snapshots_deny_authenticated on mission_snapshots
      for all to authenticated using (false) with check (false);
  end if;
end $$;
