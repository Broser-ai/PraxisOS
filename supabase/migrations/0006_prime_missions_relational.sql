-- PraxisOS · Prime Execution Control relational tables (DEL missions)
-- Complements 0005_mission_snapshots (blob mirror). Service-role / server only.

create table if not exists prime_missions (
  id              text primary key,
  tenant_slug     text not null default 'bypilar',
  title           text not null,
  goal            text not null default '',
  status          text not null default 'draft'
                  check (status in (
                    'draft','approved','running','paused','cancelled',
                    'completed','budget_exhausted'
                  )),
  risk_level      text not null default 'green'
                  check (risk_level in ('green','yellow','red')),
  platform_scope  jsonb not null default '[]'::jsonb,
  budgets         jsonb not null default '{}'::jsonb,
  usage           jsonb not null default '{}'::jsonb,
  fixture_id      text,
  created_by      text not null default 'system',
  approved_by     text,
  approved_at     timestamptz,
  human_decisions jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists prime_missions_tenant_status_idx
  on prime_missions (tenant_slug, status);

create table if not exists prime_workstreams (
  id                   text primary key,
  mission_id           text not null references prime_missions(id) on delete cascade,
  tenant_slug          text not null default 'bypilar',
  title                text not null,
  status               text not null default 'queued'
                       check (status in (
                         'queued','running','blocked','awaiting_human',
                         'awaiting_verification','ready_for_review',
                         'approved_for_merge','done','failed','cancelled',
                         'budget_exhausted'
                       )),
  role                 text not null
                       check (role in (
                         'prime_commander','scout','builder','verifier',
                         'reviewer','release_steward'
                       )),
  allowed_paths        jsonb not null default '[]'::jsonb,
  forbidden_paths      jsonb not null default '[]'::jsonb,
  acceptance_criteria  jsonb not null default '[]'::jsonb,
  branch_name          text,
  worktree_path        text,
  changed_files        jsonb not null default '[]'::jsonb,
  evidence_id          text,
  blocked_reason       text,
  agent_run_ids        jsonb not null default '[]'::jsonb,
  rework_loops         int not null default 0,
  attempt_count        int not null default 0,
  lease_id             text,
  lease_owner          text,
  lease_expires_at     timestamptz,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists prime_workstreams_mission_status_idx
  on prime_workstreams (mission_id, status);
create index if not exists prime_workstreams_lease_idx
  on prime_workstreams (lease_id) where lease_id is not null;

create table if not exists prime_agent_runs (
  id               text primary key,
  mission_id       text not null references prime_missions(id) on delete cascade,
  workstream_id    text references prime_workstreams(id) on delete set null,
  role             text not null,
  status           text not null default 'queued',
  token_usage      jsonb not null default '{}'::jsonb,
  tool_call_count  int not null default 0,
  agent_run_id     text,
  error            text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz
);

create index if not exists prime_agent_runs_mission_idx
  on prime_agent_runs (mission_id);

alter table prime_missions enable row level security;
alter table prime_workstreams enable row level security;
alter table prime_agent_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'prime_missions'
      and policyname = 'prime_missions_deny_anon'
  ) then
    create policy prime_missions_deny_anon on prime_missions
      for all to anon using (false) with check (false);
    create policy prime_missions_deny_authenticated on prime_missions
      for all to authenticated using (false) with check (false);
    create policy prime_workstreams_deny_anon on prime_workstreams
      for all to anon using (false) with check (false);
    create policy prime_workstreams_deny_authenticated on prime_workstreams
      for all to authenticated using (false) with check (false);
    create policy prime_agent_runs_deny_anon on prime_agent_runs
      for all to anon using (false) with check (false);
    create policy prime_agent_runs_deny_authenticated on prime_agent_runs
      for all to authenticated using (false) with check (false);
  end if;
end $$;
