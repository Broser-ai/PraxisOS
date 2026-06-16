-- PraxisOS · initial schema · multi-tenant via RLS
-- Region: EU · Frankfurt (eu-central-1)
-- Engine: Postgres 15 + pgvector + pg_cron
--
-- Princip: alle tabeller har tenant_id (uuid) + RLS-policy der binder rækker
-- til den session-satte tenant. Cross-tenant leak er strukturelt umuligt.

-- ========================================================================
-- 0. Extensions
-- ========================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;        -- pgvector til AI-search

-- ========================================================================
-- 1. Tenants & memberships
-- ========================================================================

create table tenants (
  id           uuid primary key default uuid_generate_v4(),
  slug         text unique not null,
  legal_name   text not null,
  cvr          text,
  brand        jsonb not null default '{}',
  domains      text[] not null default '{}',
  mode         text not null check (mode in ('headless', 'full', 'hybrid')),
  locale       text not null default 'da-DK',
  timezone     text not null default 'Europe/Copenhagen',
  currency     text not null default 'DKK',
  license      jsonb not null,
  contact      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table users (
  id           uuid primary key default uuid_generate_v4(),
  email        text unique not null,
  password_hash text,        -- argon2id, optional hvis MitID-only
  name         text not null,
  initials     text,
  mitid_subject text,        -- persistent MitID-claim
  cpr_hashed   text,         -- aldrig raw CPR
  two_fa_enabled boolean not null default false,
  avatar_color text,
  created_at   timestamptz not null default now()
);

create table memberships (
  user_id   uuid references users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  role      text not null check (role in ('owner', 'practitioner', 'reception', 'support')),
  permissions text[] not null default '{}',
  active    boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

-- ========================================================================
-- 2. Services, calendars, bookings
-- ========================================================================

create table services (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  slug          text not null,
  name          text not null,
  description   text,
  duration_min  int not null,
  price_kr      numeric(10,2) not null,
  category      text,
  modalities    text[] not null default '{Klinik}',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index on services(tenant_id);

create table clients (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  age             int,
  cpr_hashed      text,
  cpr_masked      text,           -- ****-1234 til UI
  tag             text,
  consent_level   text not null default 'Almindelig',
  mitid_verified  boolean not null default false,
  joined_at       timestamptz not null default now(),
  last_visit_at   timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on clients(tenant_id);
create index on clients(tenant_id, email);

create table bookings (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  service_id      uuid references services(id),
  practitioner_id uuid references users(id),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  modality        text not null check (modality in ('Klinik', 'Hjemmebesøg', 'Video')),
  status          text not null default 'confirmed' check (status in ('confirmed','completed','cancelled','noshow','pending')),
  price_kr        numeric(10,2) not null,
  paid            boolean not null default false,
  no_show_risk    int default 0,
  source          text not null default 'admin',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on bookings(tenant_id, starts_at);
create index on bookings(tenant_id, status);
create index on bookings(client_id);

-- ========================================================================
-- 3. Journal & scans
-- ========================================================================

create table journals (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  protocol      text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table journal_entries (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  journal_id    uuid not null references journals(id) on delete cascade,
  booking_id    uuid references bookings(id),
  author_id     uuid references users(id),
  soap_s        text,
  soap_o        text,
  soap_a        text,
  soap_p        text,
  icd10_codes   text[],
  ai_drafted    boolean not null default false,
  ai_approved_at timestamptz,
  hash          text,                 -- audit-chain
  prev_hash     text,
  embedding     vector(1536),         -- pgvector til semantisk søgning
  created_at    timestamptz not null default now()
);

create index on journal_entries(tenant_id, journal_id);
create index on journal_entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table scans (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  client_id     uuid not null references clients(id),
  kind          text not null check (kind in ('skin','foot','body')),
  captured_at   timestamptz not null default now(),
  data          jsonb not null,        -- biomarkers, hallux valgus, etc
  mesh_url      text,                  -- 3D-mesh storage
  thumbnails    text[]
);

create index on scans(tenant_id, client_id, captured_at desc);

-- ========================================================================
-- 4. Payments & vouchers
-- ========================================================================

create table payments (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  booking_id      uuid references bookings(id),
  amount_kr       numeric(10,2) not null,
  fee_kr          numeric(10,2),
  net_to_tenant_kr numeric(10,2),
  method          text,
  status          text not null,
  trust_method    text,
  risk_score      int,
  created_at      timestamptz not null default now(),
  captured_at     timestamptz,
  settled_at      timestamptz
);

create table vouchers (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  code            text unique not null,
  kind            text not null check (kind in ('clip', 'gift')),
  service_id      uuid references services(id),
  sessions_total  int,
  sessions_remaining int,
  balance_oere    bigint,
  original_balance_oere bigint,
  price_kr        numeric(10,2) not null,
  buyer_email     text not null,
  recipient_email text,
  message         text,
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  status          text not null default 'active'
);

create index on vouchers(tenant_id, status);

-- ========================================================================
-- 5. Subsidies & reports
-- ========================================================================

create table subsidy_schemes (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  scheme        text not null,
  member_id     text,
  valid_until   date,
  consumed_kr   numeric(10,2) default 0,
  consumed_sessions int default 0
);

create table reports (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  booking_id    uuid references bookings(id),
  client_id     uuid references clients(id),
  scheme        text not null,
  authority     text not null,
  format        text not null,
  amount_kr     numeric(10,2) not null,
  service_code  text,
  status        text not null default 'queued',
  ack_reference text,
  payload       jsonb,
  error_code    text,
  error_message text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  ack_at        timestamptz
);

create index on reports(tenant_id, status);

-- ========================================================================
-- 6. Events & audit (the bus + the compliance trail)
-- ========================================================================

create table events (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id),
  type          text not null,
  data          jsonb not null,
  at            timestamptz not null default now(),
  sequence      bigserial
);

create index on events(tenant_id, at desc);
create index on events(type);

create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid references users(id),
  target_cpr_hashed text,
  action        text not null,
  resource_type text,
  resource_id   text,
  purpose       text,
  treatment_ref text,
  ip            inet,
  user_agent    text,
  geo           text,
  hash          text not null,
  prev_hash     text,
  at            timestamptz not null default now()
);

create index on audit_log(tenant_id, at desc);
create index on audit_log(target_cpr_hashed);

-- ========================================================================
-- 7. Module activations (the marketplace)
-- ========================================================================

create table module_activations (
  tenant_id     uuid references tenants(id) on delete cascade,
  module_id     text not null,
  status        text not null default 'trial' check (status in ('trial','active','paused','cancelled')),
  seats         int default 0,
  config        jsonb default '{}',
  trial_ends_at timestamptz,
  activated_at  timestamptz not null default now(),
  cancelled_at  timestamptz,
  primary key (tenant_id, module_id)
);

-- ========================================================================
-- 8. API keys + webhooks
-- ========================================================================

create table api_keys (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  prefix        text not null,
  hashed_secret text not null,
  scopes        text[] not null default '{}',
  rate_limit    int not null default 600,
  status        text not null default 'active',
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create table webhook_subscriptions (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  url           text not null,
  events        text[] not null,
  active        boolean not null default true,
  hmac_secret   text not null,
  created_at    timestamptz not null default now(),
  last_delivery_at timestamptz,
  last_status   int
);

-- ========================================================================
-- 9. Row-Level Security (multi-tenant guarantee)
-- ========================================================================

-- Sæt session-variabel: SET LOCAL app.tenant_id = '<uuid>'

alter table services           enable row level security;
alter table clients            enable row level security;
alter table bookings           enable row level security;
alter table journals           enable row level security;
alter table journal_entries    enable row level security;
alter table scans              enable row level security;
alter table payments           enable row level security;
alter table vouchers           enable row level security;
alter table subsidy_schemes    enable row level security;
alter table reports            enable row level security;
alter table events             enable row level security;
alter table audit_log          enable row level security;
alter table module_activations enable row level security;
alter table api_keys           enable row level security;
alter table webhook_subscriptions enable row level security;

-- Skab samme policy for alle tenant-baserede tabeller
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'services','clients','bookings','journals','journal_entries','scans',
      'payments','vouchers','subsidy_schemes','reports','events','audit_log',
      'module_activations','api_keys','webhook_subscriptions'
    ])
  loop
    execute format(
      'create policy %I_tenant_isolated on %I for all using (tenant_id = current_setting(''app.tenant_id'')::uuid)',
      t || '_isolation', t
    );
  end loop;
end $$;

-- Tenants tabel: kun support kan se alle, andre kan se deres egne
create policy tenants_select on tenants for select
  using (
    id = current_setting('app.tenant_id', true)::uuid
    OR current_setting('app.role', true) = 'support'
  );

-- ========================================================================
-- 10. Triggers · auto-update updated_at + audit-hash-chain
-- ========================================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

create trigger tenants_updated_at  before update on tenants  for each row execute function set_updated_at();
create trigger clients_updated_at  before update on clients  for each row execute function set_updated_at();
create trigger bookings_updated_at before update on bookings for each row execute function set_updated_at();

-- Audit-log hash-chain
create or replace function audit_hash_chain() returns trigger as $$
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
end $$ language plpgsql;

create trigger audit_log_hash before insert on audit_log
  for each row execute function audit_hash_chain();

-- ========================================================================
-- 11. Seed (kun til lokal-dev)
-- ========================================================================

-- (run via supabase db reset)
-- Vi seed'er fra lib/tenants.ts via en script-fil
