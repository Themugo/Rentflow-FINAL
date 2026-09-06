-- ============================================================
-- CALQULUS RMS Demo Seed Data
-- Run this in Supabase SQL Editor to create a full demo environment.
-- All demo users use password: Demo@2026
-- ============================================================
-- 
-- DEMO ACCOUNTS:
--   Manager/Agency:  demo.manager@calqulusrms.com     (/) 
--   Tenant 1:        demo.tenant1@calqulusrms.com      (/portal)
--   Tenant 2:        demo.tenant2@calqulusrms.com      (/portal)  
--   Orphan Tenant:   demo.tenant3@calqulusrms.com      (/portal) - unlinked
--   Landlord:        demo.landlord@calqulusrms.com     (/landlord/dashboard)
--   Agent/Submanager:demo.agent@calqulusrms.com        (/) - submanager
--   Service Provider:demo.provider@calqulusrms.com     (/services)
--
-- RESET: Run the reset block at the bottom to wipe and re-run
-- ============================================================

DO $$
DECLARE
  -- Manager
  v_manager_id    uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  -- Tenants
  v_tenant1_uid   uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_tenant2_uid   uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_tenant3_uid   uuid := '44444444-4444-4444-4444-444444444444'::uuid; -- orphan
  -- Landlord
  v_landlord_uid  uuid := '55555555-5555-5555-5555-555555555555'::uuid;
  -- Agent/submanager
  v_agent_uid     uuid := '66666666-6666-6666-6666-666666666666'::uuid;
  -- Service provider
  v_provider_uid  uuid := '77777777-7777-7777-7777-777777777777'::uuid;

  -- Properties
  v_prop1_id      uuid := 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa'::uuid;
  v_prop2_id      uuid := 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa'::uuid;
  v_prop3_id      uuid := 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa'::uuid;

  -- Units
  v_unit_a1       uuid := 'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb'::uuid;
  v_unit_a2       uuid := 'bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb'::uuid;
  v_unit_a3       uuid := 'bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb'::uuid;
  v_unit_b1       uuid := 'bbbbbbbb-0004-0004-0004-bbbbbbbbbbbb'::uuid;
  v_unit_b2       uuid := 'bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb'::uuid;
  v_unit_c1       uuid := 'bbbbbbbb-0006-0006-0006-bbbbbbbbbbbb'::uuid;
  v_unit_c2       uuid := 'bbbbbbbb-0007-0007-0007-bbbbbbbbbbbb'::uuid;

  -- Tenants (row IDs, not user IDs)
  v_ten1_id       uuid := 'cccccccc-0001-0001-0001-cccccccccccc'::uuid;
  v_ten2_id       uuid := 'cccccccc-0002-0002-0002-cccccccccccc'::uuid;
  v_ten3_id       uuid := 'cccccccc-0003-0003-0003-cccccccccccc'::uuid;
  v_ten4_id       uuid := 'cccccccc-0004-0004-0004-cccccccccccc'::uuid; -- unlinked unit

  -- Invoices
  v_inv1          uuid := 'dddddddd-0001-0001-0001-dddddddddddd'::uuid;
  v_inv2          uuid := 'dddddddd-0002-0002-0002-dddddddddddd'::uuid;
  v_inv3          uuid := 'dddddddd-0003-0003-0003-dddddddddddd'::uuid;
  v_inv4          uuid := 'dddddddd-0004-0004-0004-dddddddddddd'::uuid;
  v_inv5          uuid := 'dddddddd-0005-0005-0005-dddddddddddd'::uuid;
  v_inv6          uuid := 'dddddddd-0006-0006-0006-dddddddddddd'::uuid;

  -- Leases
  v_lease1        uuid := 'eeeeeeee-0001-0001-0001-eeeeeeeeeeee'::uuid;
  v_lease2        uuid := 'eeeeeeee-0002-0002-0002-eeeeeeeeeeee'::uuid;

  -- Maintenance
  v_maint1        uuid := 'ffffffff-0001-0001-0001-ffffffffffff'::uuid;
  v_maint2        uuid := 'ffffffff-0002-0002-0002-ffffffffffff'::uuid;
  v_maint3        uuid := 'ffffffff-0003-0003-0003-ffffffffffff'::uuid;

  -- Provider
  v_provider_row  uuid := '88888888-8888-8888-8888-888888888888'::uuid;

BEGIN

-- ── Auth users (Supabase stores these in auth.users) ──────────
-- NOTE: We cannot insert directly into auth.users via SQL safely.
-- Instead, use the Supabase Dashboard > Authentication > Users to create:
--   demo.manager@calqulusrms.com  / Demo@2026
--   demo.tenant1@calqulusrms.com  / Demo@2026
--   demo.tenant2@calqulusrms.com  / Demo@2026
--   demo.tenant3@calqulusrms.com  / Demo@2026
--   demo.landlord@calqulusrms.com / Demo@2026
--   demo.agent@calqulusrms.com    / Demo@2026
--   demo.provider@calqulusrms.com / Demo@2026
-- Then update the UUIDs at the top of this script with the actual IDs.
--
-- OR use the create_demo_users() function defined below.

-- ── Profiles ──────────────────────────────────────────────────
INSERT INTO public.profiles (id, full_name, email, phone) VALUES
  (v_manager_id,   'James Kariuki',   'demo.manager@calqulusrms.com',  '0712000001'),
  (v_tenant1_uid,  'Grace Wanjiku',   'demo.tenant1@calqulusrms.com',  '0712000002'),
  (v_tenant2_uid,  'Brian Otieno',    'demo.tenant2@calqulusrms.com',  '0712000003'),
  (v_tenant3_uid,  'Amina Hassan',    'demo.tenant3@calqulusrms.com',  '0712000004'),
  (v_landlord_uid, 'Peter Mwangi',    'demo.landlord@calqulusrms.com', '0712000005'),
  (v_agent_uid,    'Fatuma Abubakar', 'demo.agent@calqulusrms.com',    '0712000006'),
  (v_provider_uid, 'Kamau Electricals','demo.provider@calqulusrms.com','0712000007')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone;

-- ── User roles ─────────────────────────────────────────────────
INSERT INTO public.user_roles (user_id, role, approval_status, tenant_id) VALUES
  (v_manager_id,   'manager',    'approved', NULL),
  (v_tenant1_uid,  'tenant',     'approved', v_ten1_id),
  (v_tenant2_uid,  'tenant',     'approved', v_ten2_id),
  (v_tenant3_uid,  'tenant',     'approved', NULL),  -- orphan
  (v_landlord_uid, 'landlord',   'approved', NULL),
  (v_agent_uid,    'submanager', 'approved', NULL),
  (v_provider_uid, 'tenant',     'approved', NULL)   -- providers use tenant role + provider record
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  approval_status = EXCLUDED.approval_status,
  tenant_id = EXCLUDED.tenant_id;

-- ── Manager profile (Pro tier) ─────────────────────────────────
INSERT INTO public.manager_profiles (manager_user_id, status, subscription_tier, property_count, platform_rate)
VALUES (v_manager_id, 'approved', 'pro', 3, 600)
ON CONFLICT (manager_user_id) DO UPDATE SET
  status = 'approved', subscription_tier = 'pro', property_count = 3;

-- ── Agency ─────────────────────────────────────────────────────
INSERT INTO public.agencies (id, manager_id, name, email, phone, county, status, tier)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'::uuid,
  v_manager_id, 'Nairobi Realty Group', 'demo.manager@calqulusrms.com',
  '0712000001', 'Nairobi', 'active', 'standard'
) ON CONFLICT (manager_id) DO NOTHING;

-- ── Submanager permissions ─────────────────────────────────────
INSERT INTO public.submanager_permissions (
  submanager_user_id, manager_id,
  can_manage_tenants, can_manage_maintenance, can_record_payments,
  can_view_financials, restrict_to_assigned_properties
) VALUES (
  v_agent_uid, v_manager_id,
  true, true, false, true, false
) ON CONFLICT (submanager_user_id, manager_id) DO NOTHING;

-- ── Properties ────────────────────────────────────────────────
INSERT INTO public.properties (id, manager_id, name, address, units, occupied, revenue, status, property_type, category_key) VALUES
  (v_prop1_id, v_manager_id, 'Sunset Gardens',
   '14 Kiambu Road, Westlands, Nairobi', 4, 3, 45000, 'active', 'flat', 'residential_flat'),
  (v_prop2_id, v_manager_id, 'Valley View Bungalows',
   '7 Karen Road, Karen, Nairobi', 3, 2, 60000, 'active', 'bungalow', 'residential_bungalow'),
  (v_prop3_id, v_manager_id, 'Westlands Commercial Centre',
   '22 Waiyaki Way, Westlands, Nairobi', 4, 2, 80000, 'active', 'commercial', 'commercial_office')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, address = EXCLUDED.address,
  units = EXCLUDED.units, occupied = EXCLUDED.occupied, revenue = EXCLUDED.revenue;

-- ── Units ──────────────────────────────────────────────────────
INSERT INTO public.units (id, property_id, unit_number, label, unit_type, floor_number, monthly_rent, status) VALUES
  (v_unit_a1, v_prop1_id, 'A1', 'Flat A1 – Ground Floor', 'one_bedroom',   0, 12000, 'occupied'),
  (v_unit_a2, v_prop1_id, 'A2', 'Flat A2 – Ground Floor', 'two_bedroom',   0, 15000, 'occupied'),
  (v_unit_a3, v_prop1_id, 'A3', 'Flat A3 – First Floor',  'bedsitter',     1,  8500, 'occupied'),
  (v_unit_a1, v_prop1_id, 'A4', 'Flat A4 – First Floor',  'studio',        1,  9500, 'vacant'),

  (v_unit_b1, v_prop2_id, 'B1', 'Bungalow 1',             'three_bedroom', 0, 35000, 'occupied'),
  (v_unit_b2, v_prop2_id, 'B2', 'Bungalow 2',             'two_bedroom',   0, 28000, 'occupied'),
  (v_unit_b2, v_prop2_id, 'B3', 'Bungalow 3',             'three_bedroom', 0, 32000, 'vacant'),

  (v_unit_c1, v_prop3_id, 'C1', 'Office Suite 1',         'office',        0, 45000, 'occupied'),
  (v_unit_c2, v_prop3_id, 'C2', 'Office Suite 2',         'office',        1, 50000, 'occupied'),
  (v_unit_c2, v_prop3_id, 'C3', 'Retail Shop A',          'shop',          0, 30000, 'vacant'),
  (v_unit_c2, v_prop3_id, 'C4', 'Retail Shop B',          'shop',          0, 30000, 'vacant')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label, status = EXCLUDED.status, monthly_rent = EXCLUDED.monthly_rent;

-- ── Tenants ────────────────────────────────────────────────────
INSERT INTO public.tenants (
  id, manager_id, name, email, phone, property, unit, property_id, unit_id,
  monthly_rent, deposit_amount, deposit_balance, move_in_date, status
) VALUES
  (v_ten1_id, v_manager_id, 'Grace Wanjiku', 'demo.tenant1@calqulusrms.com', '0712000002',
   'Sunset Gardens', 'A3', v_prop1_id, v_unit_a3,
   8500, 17000, 17000, '2025-03-01', 'active'),

  (v_ten2_id, v_manager_id, 'Brian Otieno', 'demo.tenant2@calqulusrms.com', '0712000003',
   'Valley View Bungalows', 'B1', v_prop2_id, v_unit_b1,
   35000, 70000, 70000, '2024-09-15', 'active'),

  -- Tenant in prop1 A1 (no auth user - occupant without portal access yet)
  (v_ten3_id, v_manager_id, 'Samuel Njoroge', 'samuel.njoroge@email.com', '0712000099',
   'Sunset Gardens', 'A1', v_prop1_id, v_unit_a1,
   12000, 24000, 24000, '2024-06-01', 'active'),

  -- Tenant in prop2 B2
  (v_ten4_id, v_manager_id, 'Zainab Osei', 'zainab.osei@email.com', '0712000098',
   'Valley View Bungalows', 'B2', v_prop2_id, v_unit_b2,
   28000, 56000, 56000, '2025-01-10', 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, monthly_rent = EXCLUDED.monthly_rent, status = EXCLUDED.status;

-- ── Leases ─────────────────────────────────────────────────────
INSERT INTO public.leases (
  id, tenant_id, property, unit, property_id, unit_id,
  monthly_rent, deposit, start_date, end_date, status, terms
) VALUES
  (v_lease1, v_ten1_id, 'Sunset Gardens', 'A3', v_prop1_id, v_unit_a3,
   8500, 17000, '2025-03-01', '2026-02-28', 'active',
   'Standard residential lease. Rent due 1st of each month. 2 months deposit paid.'),
  (v_lease2, v_ten2_id, 'Valley View Bungalows', 'B1', v_prop2_id, v_unit_b1,
   35000, 70000, '2024-09-15', '2025-09-14', 'active',
   'Standard residential lease. Tenant responsible for utilities. Garden maintenance included.')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- ── Invoices ── mix of paid, pending, overdue ──────────────────
-- Grace (tenant1) - overdue March, paid Feb, pending April
INSERT INTO public.invoices (id, manager_id, tenant_id, invoice_number, amount, status, due_date, paid_date, description) VALUES
  (v_inv1, v_manager_id, v_ten1_id, 'INV-DEMO-001', 8500, 'paid',   '2026-02-01', '2026-02-03', 'February 2026 rent — Flat A3'),
  (v_inv2, v_manager_id, v_ten1_id, 'INV-DEMO-002', 8500, 'overdue','2026-03-01', NULL,         'March 2026 rent — Flat A3'),
  (v_inv3, v_manager_id, v_ten1_id, 'INV-DEMO-003', 8500, 'pending','2026-04-01', NULL,         'April 2026 rent — Flat A3'),
-- Brian (tenant2) - all paid, one pending
  (v_inv4, v_manager_id, v_ten2_id, 'INV-DEMO-004', 35000,'paid',   '2026-02-01', '2026-01-31', 'February 2026 rent — Bungalow B1'),
  (v_inv5, v_manager_id, v_ten2_id, 'INV-DEMO-005', 35000,'paid',   '2026-03-01', '2026-03-02', 'March 2026 rent — Bungalow B1'),
  (v_inv6, v_manager_id, v_ten2_id, 'INV-DEMO-006', 35000,'pending','2026-04-01', NULL,         'April 2026 rent — Bungalow B1')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, paid_date = EXCLUDED.paid_date;

-- ── Payment transactions ── 3 successful payments ─────────────
INSERT INTO public.payment_transactions (
  manager_id, tenant_id, invoice_id, amount, payment_method, payment_date, reference, status
) VALUES
  (v_manager_id, v_ten1_id, v_inv1, 8500,  'mpesa_stk', '2026-02-03', 'QAB3F5X7YZ', 'completed'),
  (v_manager_id, v_ten2_id, v_inv4, 35000, 'mpesa_stk', '2026-01-31', 'RCK9G1M2WP', 'completed'),
  (v_manager_id, v_ten2_id, v_inv5, 35000, 'bank_transfer','2026-03-02','REF/KCB/2026/88142', 'completed')
ON CONFLICT DO NOTHING;

-- ── Maintenance requests ───────────────────────────────────────
INSERT INTO public.maintenance_requests (
  id, manager_id, property_id, unit_id, tenant_id,
  title, description, priority, status, category, requested_date
) VALUES
  (v_maint1, v_manager_id, v_prop1_id, v_unit_a3, v_ten1_id,
   'Leaking kitchen tap', 'The kitchen tap has been dripping for 3 days, wasting water.',
   'medium', 'open', 'plumbing', NOW() - INTERVAL '2 days'),

  (v_maint2, v_manager_id, v_prop1_id, v_unit_a1, v_ten3_id,
   'Broken bedroom window lock', 'Window lock in the master bedroom is broken, security concern.',
   'high', 'in_progress', 'carpentry', NOW() - INTERVAL '5 days'),

  (v_maint3, v_manager_id, v_prop2_id, v_unit_b1, v_ten2_id,
   'Electricity trip in living room', 'MCB trips every evening when appliances are on.',
   'urgent', 'open', 'electrical', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- ── Messages ── manager → tenant1 conversation ─────────────────
INSERT INTO public.messages (
  manager_id, tenant_id, sender_type, content, is_read, created_at
) VALUES
  (v_manager_id, v_ten1_id, 'manager',
   'Hi Grace, this is a reminder that your March rent of KES 8,500 is now overdue. Please pay at your earliest convenience.',
   true, NOW() - INTERVAL '5 days'),
  (v_manager_id, v_ten1_id, 'tenant',
   'Hi James, I apologize for the delay. I will pay by end of this week via M-Pesa.',
   true, NOW() - INTERVAL '4 days'),
  (v_manager_id, v_ten1_id, 'manager',
   'Thank you Grace. Please use Paybill 522522, Account: A3. Let me know once done.',
   false, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ── In-app notifications ───────────────────────────────────────
INSERT INTO public.in_app_notifications (
  manager_id, tenant_id, type, title, message, is_read
) VALUES
  (v_manager_id, v_ten1_id, 'invoice_overdue',
   'Rent overdue',
   'Your March 2026 rent of KES 8,500 is overdue. Please pay immediately.',
   false),
  (v_manager_id, v_ten2_id, 'invoice_generated',
   'New invoice',
   'Your April 2026 rent invoice of KES 35,000 has been generated.',
   false)
ON CONFLICT DO NOTHING;

-- ── Service provider profile ───────────────────────────────────
INSERT INTO public.service_providers (
  id, user_id, business_name, contact_name, phone, whatsapp, email,
  county, town, is_verified, rating_avg, rating_count, jobs_completed,
  is_available, response_time_hrs, bio, added_by_role, status
) VALUES (
  v_provider_row, v_provider_uid,
  'Kamau Electrical Services', 'Joseph Kamau', '0722123456', '0722123456',
  'kamau.electrical@gmail.com', 'Nairobi', 'Westlands',
  true, 4.7, 23, 47, true, 4,
  'Licensed electrician with 12 years experience. Specialise in residential wiring, solar installations and fault-finding. Available 7 days.',
  'self', 'active'
) ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name, rating_avg = EXCLUDED.rating_avg;

INSERT INTO public.provider_services (
  provider_id, category_key, rate_type, rate_min, rate_max, rate_notes
) VALUES
  (v_provider_row, 'electrical_general', 'per_job', 500, 3000, 'Callout fee KES 500, labour extra'),
  (v_provider_row, 'electrical_solar',   'quote_only', NULL, NULL, 'Site visit required for quote'),
  (v_provider_row, 'electrical_cctv',    'per_job', 8000, 25000, 'Includes basic 4-camera kit installation')
ON CONFLICT (provider_id, category_key) DO UPDATE SET
  rate_min = EXCLUDED.rate_min, rate_max = EXCLUDED.rate_max;

-- Assign provider to maintenance request 3
UPDATE public.maintenance_requests
SET assigned_to = 'Kamau Electrical Services', assigned_provider_id = v_provider_row
WHERE id = v_maint3;

-- ── Orphan tenant record (demo.tenant3 / Amina Hassan) ────────
INSERT INTO public.orphan_tenant_records (
  user_id, property_name, unit_label, landlord_name, landlord_phone,
  county, move_in_date, monthly_rent
) VALUES (
  v_tenant3_uid, 'Ngara Apartments', 'Room 12',
  'Mr. Abdullah Omar', '0711987654', 'Nairobi', '2025-07-01', 11000
) ON CONFLICT DO NOTHING;

INSERT INTO public.orphan_payment_entries (
  user_id, payment_date, amount, payment_method, reference, description
) VALUES
  (v_tenant3_uid, '2026-02-01', 11000, 'mpesa', 'PLA2F5K9XZ', 'February 2026 rent'),
  (v_tenant3_uid, '2026-03-03', 11000, 'mpesa', 'QNB8G7M1RW', 'March 2026 rent'),
  (v_tenant3_uid, '2026-04-02', 11000, 'cash',  NULL,          'April 2026 rent — cash to caretaker')
ON CONFLICT DO NOTHING;

-- ── Landlord properties ────────────────────────────────────────
-- Link the two main properties to the demo landlord
INSERT INTO public.properties (id, manager_id, name, address, units, occupied, revenue, status, property_type)
VALUES (
  'aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa'::uuid,
  v_manager_id, 'Mwangi House', '3 Parklands Road, Parklands, Nairobi',
  6, 5, 90000, 'active', 'flat'
) ON CONFLICT (id) DO NOTHING;

-- Landlord invitation / link to their properties
INSERT INTO public.landlord_invitations (
  manager_id, landlord_email, property_ids, status, created_at
) VALUES (
  v_manager_id, 'demo.landlord@calqulusrms.com',
  ARRAY[v_prop1_id::text, v_prop2_id::text], 'accepted', NOW() - INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- ── M-Pesa settings ────────────────────────────────────────────
INSERT INTO public.mpesa_settings (
  manager_id, paybill_enabled, paybill_shortcode, paybill_account_reference,
  till_enabled, till_shortcode
) VALUES (
  v_manager_id, true, '522522', 'RENT', false, NULL
) ON CONFLICT (manager_id) DO UPDATE SET
  paybill_enabled = true, paybill_shortcode = '522522';

-- ── Manager invoice (subscription) ───────────────────────────
INSERT INTO public.manager_invoices (
  manager_user_id, invoice_number, amount, status, due_date, invoice_type,
  description, property_count, rate_per_property
) VALUES (
  v_manager_id, 'PLAT-2026-04-11111111', 1800, 'pending',
  (NOW() + INTERVAL '7 days')::date, 'subscription',
  'Monthly platform fee — 3 properties × KES 600 (Pro tier)', 3, 600
) ON CONFLICT DO NOTHING;

RAISE NOTICE 'Demo data seeded successfully.';
RAISE NOTICE 'Demo accounts (all password: Demo@2026):';
RAISE NOTICE '  Manager/Agency:   demo.manager@calqulusrms.com  → /';
RAISE NOTICE '  Tenant 1 (Grace): demo.tenant1@calqulusrms.com  → /portal';
RAISE NOTICE '  Tenant 2 (Brian): demo.tenant2@calqulusrms.com  → /portal';
RAISE NOTICE '  Orphan (Amina):   demo.tenant3@calqulusrms.com  → /portal';
RAISE NOTICE '  Landlord:         demo.landlord@calqulusrms.com → /landlord/dashboard';
RAISE NOTICE '  Agent:            demo.agent@calqulusrms.com    → /';

END $$;
