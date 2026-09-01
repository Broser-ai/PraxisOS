-- PraxisOS · swarm durability tables (persist.ts + agents/memory/swarm-memory.ts)
-- Consumers:
--   lib/swarm/persist.ts          → public.swarm_snapshots
--   agents/memory/swarm-memory.ts → public.swarm_memory

create table if not exists swarm_snapshots (
  id           text primary key,
  tenant_slug  text not null default 'bypilar',
  payload      jsonb not null default '{}'::jsonb,
  revision     bigint not null default 1,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists swarm_snapshots_tenant_idx
  on swarm_snapshots (tenant_slug);

create or replace function swarm_snapshots_touch() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.revision = coalesce(old.revision, 0) + 1;
  return new;
end $$;

drop trigger if exists swarm_snapshots_touch on swarm_snapshots;
create trigger swarm_snapshots_touch
  before update on swarm_snapshots
  for each row execute function swarm_snapshots_touch();

alter table swarm_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'swarm_snapshots'
      and policyname = 'swarm_snapshots_deny_anon'
  ) then
    create policy swarm_snapshots_deny_anon on swarm_snapshots
      for all to anon using (false) with check (false);
    create policy swarm_snapshots_deny_authenticated on swarm_snapshots
      for all to authenticated using (false) with check (false);
  end if;
end $$;

create table if not exists swarm_memory (
  id           text primary key,
  kind         text not null,
  tenant       text not null default 'bypilar',
  text         text not null,
  embedding    vector(64),
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists swarm_memory_tenant_kind_idx
  on swarm_memory (tenant, kind, created_at desc);

alter table swarm_memory enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'swarm_memory'
      and policyname = 'swarm_memory_deny_anon'
  ) then
    create policy swarm_memory_deny_anon on swarm_memory
      for all to anon using (false) with check (false);
    create policy swarm_memory_deny_authenticated on swarm_memory
      for all to authenticated using (false) with check (false);
  end if;
end $$;
