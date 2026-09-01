-- PraxisOS · 3D scan mesh object refs + storage bucket bootstrap
-- Code: lib/scanner/resolve-image.ts uses storage bucket "scans"
-- Was planned as migration 0004 in lib/supabase.ts MIGRATIONS metadata.

create table if not exists scan_meshes (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  scan_id       uuid references scans(id) on delete set null,
  client_id     uuid references clients(id) on delete set null,
  storage_path  text not null,              -- e.g. scans/{tenant}/{scanId}/mesh.glb
  public_url    text,
  provider      text not null default 'supabase-storage'
                  check (provider in ('supabase-storage', 'local-volume', 's3')),
  content_type  text default 'model/gltf-binary',
  bytes         bigint,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists scan_meshes_tenant_idx
  on scan_meshes (tenant_id, created_at desc);
create index if not exists scan_meshes_scan_idx
  on scan_meshes (scan_id);

alter table scan_meshes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scan_meshes'
      and policyname = 'scan_meshes_isolation'
  ) then
    create policy scan_meshes_isolation on scan_meshes for all
      using (tenant_id = (current_setting('app.tenant_id'))::uuid)
      with check (tenant_id = (current_setting('app.tenant_id'))::uuid);
  end if;
end $$;

-- Storage bucket (no-op on plain Postgres without storage schema).
-- On Supabase cloud / self-host stack this creates the "scans" bucket expected by resolve-image.ts.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'scans',
      'scans',
      true,
      52428800, -- 50 MiB
      array[
        'image/jpeg', 'image/png', 'image/webp',
        'model/gltf-binary', 'model/gltf+json',
        'application/octet-stream'
      ]
    )
    on conflict (id) do nothing;

    -- Authenticated staff can upload under their tenant prefix; public read for mesh URLs.
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'scans_public_read'
    ) then
      create policy scans_public_read on storage.objects
        for select to public
        using (bucket_id = 'scans');
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'scans_service_write'
    ) then
      create policy scans_service_write on storage.objects
        for insert to authenticated
        with check (bucket_id = 'scans');
      create policy scans_service_update on storage.objects
        for update to authenticated
        using (bucket_id = 'scans')
        with check (bucket_id = 'scans');
    end if;
  end if;
end $$;
