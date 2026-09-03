-- 0007_consent_events.sql
-- Durable consent events (P0 plan §D.2). New grants are written as events;
-- legacy clients.consent_level remains a documented fallback until backfilled.
--
-- NOTE: plan originally numbered this 0006_consent_events, but 0005/0006 were
-- taken by mission_snapshots / prime_missions_relational in the live tree, so
-- this lands as 0007. Audit-log align migration lands as 0008.

create table if not exists consent_events (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  event_type       text not null
    check (event_type in (
      'granted', 'revoked', 'opt_out', 'superseded'
    )),
  purpose         text not null
    check (purpose in (
      'treatment', 'journal', 'photo_capture', 'ai_processing',
      'sms_transactional', 'sms_marketing', 'patient_guidance', 'research'
    )),
  consent_version  text not null,          -- e.g. "bypilar-onboarding-v1"
  channel          text not null           -- web_onboarding | clinic_desk | sms_link | api | import
    check (channel in ('web_onboarding','clinic_desk','sms_link','api','import')),
  evidence         jsonb not null default '{}',  -- checkbox set, ip, user_agent, staff_id — NO raw CPR
  effective_at     timestamptz not null default now(),
  revoked_at       timestamptz,
  actor_user_id    text,
  created_at       timestamptz not null default now()
);

create index if not exists consent_events_tenant_client_purpose_idx
  on consent_events (tenant_id, client_id, purpose, effective_at desc);

alter table consent_events enable row level security;

-- Same tenant-isolation policy pattern as 0001: tenants may only see their
-- own consent events. Service role bypasses RLS for writes from the app.
drop policy if exists "tenants select own consent_events" on consent_events;
create policy "tenants select own consent_events"
  on consent_events for select
  using (
    tenant_id in (
      select id from tenants where slug = coalesce(current_setting('app.tenant_slug', true), '')
    )
  );
