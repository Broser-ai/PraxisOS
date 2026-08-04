-- PraxisOS · seed demo tenants/users/services/clients
-- Safe to re-run: uses fixed UUIDs + ON CONFLICT where possible.

-- Fixed IDs for deterministic local/prod bootstrap
-- bypilar: 11111111-1111-1111-1111-111111111111
-- nordlys: 22222222-2222-2222-2222-222222222222

insert into tenants (id, slug, legal_name, cvr, brand, domains, mode, locale, timezone, currency, license, contact)
values
(
  '11111111-1111-1111-1111-111111111111',
  'bypilar',
  'by Pilar',
  '43947079',
  '{"name":"by Pilar","tagline":"Negle- og fodpleje · Aarhus","primary":"#1b1a17","accent":"#8a6a3d"}'::jsonb,
  array['bypilar.dk','booking.bypilar.dk','bypilar.praxis.app'],
  'hybrid',
  'da-DK',
  'Europe/Copenhagen',
  'DKK',
  '{"plan":"Trial · alt inkluderet · gratis","status":"trial","seats":5,"unlimited":true}'::jsonb,
  '{"address":"Aarhus, Danmark","phone":"+45 93 95 20 41","email":"hej@bypilar.dk","cvr":"43947079"}'::jsonb
),
(
  '22222222-2222-2222-2222-222222222222',
  'nordlys',
  'Nordlys Klinik ApS',
  '12345678',
  '{"name":"Nordlys Klinik","tagline":"Hud · æstetik","primary":"#1b1a17","accent":"#2f4a7c"}'::jsonb,
  array['nordlys.praxis.app'],
  'full',
  'da-DK',
  'Europe/Copenhagen',
  'DKK',
  '{"plan":"Aesthetic Pro","status":"active","seats":4}'::jsonb,
  '{"address":"København K, Danmark","phone":"+45 70 70 12 34","email":"klinik@nordlys.dk","cvr":"12345678"}'::jsonb
)
on conflict (slug) do nothing;

-- Demo users — password hashes are placeholders.
-- Run `node scripts/seed-demo-passwords.mjs` after migrate to set scrypt hashes for password "demo".
insert into users (id, email, password_hash, name, initials, two_fa_enabled, avatar_color)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pilar@bypilar.dk', null, 'Pilar Mortensen', 'PM', true, '#8a6a3d'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'sofie@bypilar.dk', null, 'Dr. Sofie Krarup', 'SK', true, '#2f4a7c'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'nadia@nordlys.dk', null, 'Nadia Berg', 'NB', false, '#2f4a7c'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'emil@support.praxis.app', null, 'Emil Support', 'ES', true, '#1b1a17')
on conflict (email) do nothing;

insert into memberships (user_id, tenant_id, role, permissions, active)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', array['admin','bookings','journal','billing','marketing','api'], true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'practitioner', array['bookings','journal'], true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'practitioner', array['bookings','journal'], true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'owner', array['admin','bookings','journal','billing','marketing','api'], true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'support', array['admin','bookings','journal','billing','marketing','api','support'], true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'support', array['admin','bookings','journal','billing','marketing','api','support'], true)
on conflict do nothing;

insert into services (tenant_id, slug, name, description, duration_min, price_kr, category, modalities)
values
  ('11111111-1111-1111-1111-111111111111', 'gel-mani', 'Gel manicure', 'Klassisk gel-manicure', 45, 395, 'Negle', array['Klinik']),
  ('11111111-1111-1111-1111-111111111111', 'nail-art', 'Nail art', 'Personligt design', 60, 545, 'Negle', array['Klinik']),
  ('11111111-1111-1111-1111-111111111111', 'fod-med', 'Medicinsk fodpleje', 'Hård hud, ligtorne, nedgroede negle', 45, 495, 'Fod', array['Klinik','Hjemmebesøg']),
  ('11111111-1111-1111-1111-111111111111', 'fod-lux', 'Luksus fodpleje', 'Fuld behandling', 75, 745, 'Fod', array['Klinik','Hjemmebesøg']),
  ('11111111-1111-1111-1111-111111111111', 'fod-scan', 'Fod-scan · Physical AI', '3D-topologi + analyse', 30, 595, 'Fod-scan', array['Klinik'])
on conflict (tenant_id, slug) do nothing;
