-- PraxisOS · foot-scanner module
-- Ejerskab: modules/foot-scanner (Python engine) + prototype (Next.js UI)
--
-- Tabeller er præfikset foot_scan_ · alle bærer tenant_id og er RLS-bundet.
-- Store binærer (mesh.ply, orthotic.stl) ligger IKKE i Postgres — de er i
-- Supabase Storage bucket `foot-scan-artefacts` med path
-- {tenant_slug}/{session_id}/{name}.
--
-- Krav: 0001_initial_schema.sql skal være anvendt først.

-- ========================================================================
-- Sessions
-- ========================================================================

create table foot_scan_sessions (
  id               text primary key,                       -- fs_xxxxxxxxxxxx
  tenant_id        uuid not null references tenants(id) on delete cascade,
  tenant_slug      text not null,                          -- denormaliseret til hurtig join med Python engine
  client_id        text not null,                          -- ekstern klient-referencenøgle
  side             text not null check (side in ('L', 'R')),
  source           text not null check (source in ('phone_video', 'phone_photos', 'structured_light', 'laser', 'pressure_mat')),
  marker_type      text not null default 'a4',
  status           text not null default 'capturing' check (status in ('capturing', 'reconstructing', 'analyzing', 'ready', 'failed')),
  operator_user_id uuid references users(id),
  engine_host      text,                                    -- fx 'foot-scanner-1.eu-central-1'
  engine_version   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  frame_count      int not null default 0,
  mesh_uri         text,                                   -- supabase-storage://foot-scan-artefacts/...
  preview_uri      text,
  report_uri       text
);

create index on foot_scan_sessions (tenant_id, client_id);
create index on foot_scan_sessions (tenant_id, status);
create index on foot_scan_sessions (created_at desc);

-- ========================================================================
-- Frames (metadata; billeder er i Storage)
-- ========================================================================

create table foot_scan_frames (
  session_id  text not null references foot_scan_sessions(id) on delete cascade,
  idx         int not null,
  ts_ms       int not null,
  width       int not null,
  height      int not null,
  focal_px    numeric,
  imu_qw      numeric,
  imu_qx      numeric,
  imu_qy      numeric,
  imu_qz      numeric,
  quality     numeric,
  storage_uri text not null,                              -- supabase-storage://foot-scan-artefacts/{tenant}/{session}/frames/frame_0000.jpg
  primary key (session_id, idx)
);

-- ========================================================================
-- Reconstructions
-- ========================================================================

create table foot_scan_reconstructions (
  session_id     text primary key references foot_scan_sessions(id) on delete cascade,
  engine         text not null,
  duration_ms    int not null,
  vertex_count   int not null,
  face_count     int not null,
  watertight     boolean not null,
  volume_ml      numeric,
  surface_area_cm2 numeric,
  bbox_mm        numeric[3] not null,
  mm_per_px      numeric not null,
  marker_confidence numeric not null,
  marker_method  text not null,
  warnings       text[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- ========================================================================
-- Biomechanical reports
-- ========================================================================

create table foot_scan_reports (
  session_id           text primary key references foot_scan_sessions(id) on delete cascade,
  side                 text not null,
  arch_type            text not null check (arch_type in ('high', 'normal', 'low', 'flat')),
  arch_index           numeric not null,
  hallux_valgus_deg    numeric not null,
  navicular_drop_mm    numeric not null,
  forefoot_width_mm    numeric not null,
  heel_width_mm        numeric not null,
  foot_length_mm       numeric not null,
  ball_girth_mm        numeric not null,
  clinical_summary     text not null,
  recommendations      text[] not null default '{}',
  icd10_suggestions    text[] not null default '{}',
  metrics_json         jsonb not null,                    -- fuld list of BiomechMetric
  pressure_zones_json  jsonb not null default '[]',
  generated_at         timestamptz not null default now()
);

create index on foot_scan_reports (arch_type);
create index on foot_scan_reports (hallux_valgus_deg);

-- ========================================================================
-- Orthotic artefacts
-- ========================================================================

create table foot_scan_orthotics (
  id             uuid primary key default uuid_generate_v4(),
  session_id     text not null references foot_scan_sessions(id) on delete cascade,
  spec_json      jsonb not null,
  stl_uri        text not null,
  scad_uri       text not null,
  manufacturing_notes text,
  estimated_print_hours numeric,
  created_at     timestamptz not null default now()
);

create index on foot_scan_orthotics (session_id, created_at desc);

-- ========================================================================
-- Row Level Security
-- ========================================================================

alter table foot_scan_sessions        enable row level security;
alter table foot_scan_frames          enable row level security;
alter table foot_scan_reconstructions enable row level security;
alter table foot_scan_reports         enable row level security;
alter table foot_scan_orthotics       enable row level security;

-- Adgang gennem den session-satte tenant_id (samme mønster som 0001).
-- Vi antager en set_config('praxis.tenant_id', '<uuid>', true) helper som
-- resten af skemaet allerede bruger.

create policy tenant_isolation on foot_scan_sessions
  using (tenant_id = current_setting('praxis.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('praxis.tenant_id', true)::uuid);

create policy tenant_isolation on foot_scan_frames
  using (exists (select 1 from foot_scan_sessions s
                 where s.id = foot_scan_frames.session_id
                   and s.tenant_id = current_setting('praxis.tenant_id', true)::uuid));

create policy tenant_isolation on foot_scan_reconstructions
  using (exists (select 1 from foot_scan_sessions s
                 where s.id = foot_scan_reconstructions.session_id
                   and s.tenant_id = current_setting('praxis.tenant_id', true)::uuid));

create policy tenant_isolation on foot_scan_reports
  using (exists (select 1 from foot_scan_sessions s
                 where s.id = foot_scan_reports.session_id
                   and s.tenant_id = current_setting('praxis.tenant_id', true)::uuid));

create policy tenant_isolation on foot_scan_orthotics
  using (exists (select 1 from foot_scan_sessions s
                 where s.id = foot_scan_orthotics.session_id
                   and s.tenant_id = current_setting('praxis.tenant_id', true)::uuid));

-- ========================================================================
-- Audit trigger — link ind i eksisterende audit_events tabel
-- ========================================================================

create or replace function foot_scan_audit() returns trigger as $$
begin
  insert into audit_events (tenant_id, actor_user_id, action, resource, resource_id, payload)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    coalesce(new.operator_user_id, old.operator_user_id),
    TG_OP,
    'foot_scan_session',
    coalesce(new.id, old.id),
    row_to_json(new)::jsonb
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger foot_scan_sessions_audit
  after insert or update or delete on foot_scan_sessions
  for each row execute function foot_scan_audit();
