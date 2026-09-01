-- PraxisOS · agent activity ledger + LLM call metrics (was "planned" in lib/supabase.ts)

create table if not exists agent_ledger (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete set null,
  tenant_slug   text not null default 'bypilar',
  agent         text not null,              -- e.g. aria, niels, s-agent
  workflow      text,
  event         text not null,              -- tick | tool_call | error | complete
  status        text not null default 'ok'
                  check (status in ('ok', 'warn', 'error', 'skipped')),
  payload       jsonb not null default '{}'::jsonb,
  error_message text,
  duration_ms   int,
  at            timestamptz not null default now()
);

create index if not exists agent_ledger_tenant_at_idx
  on agent_ledger (tenant_slug, at desc);
create index if not exists agent_ledger_agent_at_idx
  on agent_ledger (agent, at desc);

create table if not exists llm_call_metrics (
  id            uuid primary key default uuid_generate_v4(),
  tenant_slug   text not null default 'bypilar',
  agent         text,
  model         text not null,
  purpose       text,                       -- scribe | chat | classify | embed
  prompt_tokens int,
  completion_tokens int,
  total_tokens  int,
  latency_ms    int,
  ok            boolean not null default true,
  error_message text,
  meta          jsonb not null default '{}'::jsonb,
  at            timestamptz not null default now()
);

create index if not exists llm_call_metrics_at_idx
  on llm_call_metrics (tenant_slug, at desc);

alter table agent_ledger enable row level security;
alter table llm_call_metrics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_ledger'
      and policyname = 'agent_ledger_tenant_isolated'
  ) then
    create policy agent_ledger_tenant_isolated on agent_ledger
      for all
      using (
        tenant_id is null
        or tenant_id = (current_setting('app.tenant_id', true))::uuid
        or current_setting('app.role', true) = 'support'
      )
      with check (
        tenant_id is null
        or tenant_id = (current_setting('app.tenant_id', true))::uuid
        or current_setting('app.role', true) = 'support'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'llm_call_metrics'
      and policyname = 'llm_call_metrics_deny_anon'
  ) then
    create policy llm_call_metrics_deny_anon on llm_call_metrics
      for all to anon using (false) with check (false);
    create policy llm_call_metrics_deny_authenticated on llm_call_metrics
      for all to authenticated using (false) with check (false);
  end if;
end $$;
