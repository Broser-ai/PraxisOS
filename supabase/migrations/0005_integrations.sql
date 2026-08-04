-- PraxisOS · SMS outbox + payment intents + MitID state (integration scaffolding)
-- Apply after 0004_swarm_state.sql when using Supabase.

create table if not exists message_outbox (
  id              text primary key,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  channel         text not null check (channel in ('nemsms', 'sms', 'email')),
  category        text not null,
  to_phone        text,
  to_email        text,
  recipient_name  text not null,
  booking_id      text,
  client_id       text,
  body            text not null,
  status          text not null,
  provider        text not null,
  provider_ref    text,
  error_code      text,
  cost_oere       int not null default 0,
  scheduled_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists message_outbox_tenant_sched_idx
  on message_outbox (tenant_id, status, scheduled_at);

create table if not exists payment_intents (
  id              text primary key,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  booking_id      text,
  amount_kr       numeric(10,2) not null,
  currency        text not null default 'DKK',
  method          text not null,
  status          text not null,
  mode            text not null,
  provider        text not null,
  provider_ref    text,
  mobilepay_phone text,
  return_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  authorized_at   timestamptz,
  captured_at     timestamptz
);

create index if not exists payment_intents_tenant_idx
  on payment_intents (tenant_id, created_at desc);

create table if not exists mitid_login_states (
  state           text primary key,
  nonce           text not null,
  mode            text not null check (mode in ('staff', 'patient')),
  return_to       text not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

alter table message_outbox enable row level security;
alter table payment_intents enable row level security;
alter table mitid_login_states enable row level security;
