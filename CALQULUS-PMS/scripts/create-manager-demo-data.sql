
-- Demo Data for Manager Account
-- Manager: demo.manager@calqulusrms.com (ID: 4cbb0a75-a9d8-4aef-8a64-9c99245eab64)


-- Fixed UUIDs for demo data
DO $$
DECLARE
  v_manager_id uuid := '4cbb0a75-a9d8-4aef-8a64-9c99245eab64';
  v_tenant_user_id uuid := 'e35ce0a1-cb30-4212-9a85-57729264cf45';
  
  -- Property IDs
  v_prop1_id uuid := 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa';
  v_prop2_id uuid := 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa';
  
  -- Unit IDs
  v_unit_a1 uuid := 'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb';
  v_unit_a2 uuid := 'bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb';
  v_unit_b1 uuid := 'bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb';
  
  -- Tenant row ID
  v_tenant_id uuid := 'cccccccc-0001-0001-0001-cccccccccccc';
  
  -- Invoice IDs
  v_inv1 uuid := 'dddddddd-0001-0001-0001-dddddddddddd';
  v_inv2 uuid := 'dddddddd-0002-0002-0002-dddddddddddd';
  
  -- Lease ID
  v_lease_id uuid := 'eeeeeeee-0001-0001-0001-eeeeeeeeeeee';

BEGIN
  -- ── Properties ────────────────────────────────────────────────
  INSERT INTO public.properties (id, manager_id, name, address, units, occupied, revenue, status, property_type, category_key, created_at, updated_at) VALUES
    (v_prop1_id, v_manager_id, 'Sunset Gardens', '14 Kiambu Road, Westlands, Nairobi', 2, 1, 27000, 'active', 'flat', 'residential_flat', NOW(), NOW()),
    (v_prop2_id, v_manager_id, 'Valley View Bungalows', '7 Karen Road, Karen, Nairobi', 1, 0, 0, 'active', 'bungalow', 'residential_bungalow', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, address = EXCLUDED.address, updated_at = NOW();
  
  RAISE NOTICE '✓ Properties created (2)';
  
  -- ── Units ──────────────────────────────────────────────────────
  INSERT INTO public.units (id, property_id, unit_number, label, unit_type, floor_number, monthly_rent, status, created_at, updated_at) VALUES
    (v_unit_a1, v_prop1_id, 'A1', 'Flat A1 – Ground Floor', 'one_bedroom', 0, 15000, 'occupied', NOW(), NOW()),
    (v_unit_a2, v_prop1_id, 'A2', 'Flat A2 – Ground Floor', 'two_bedroom', 0, 20000, 'vacant', NOW(), NOW()),
    (v_unit_b1, v_prop2_id, 'B1', 'Bungalow 1', 'three_bedroom', 0, 35000, 'vacant', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label, status = EXCLUDED.status, monthly_rent = EXCLUDED.monthly_rent, updated_at = NOW();
  
  RAISE NOTICE '✓ Units created (3)';
  
  -- ── Tenant ────────────────────────────────────────────────────
  INSERT INTO public.tenants (
    id, manager_id, name, email, phone, property, unit, property_id, unit_id,
    monthly_rent, deposit_amount, deposit_balance, move_in_date, status, created_at, updated_at
  ) VALUES
    (v_tenant_id, v_manager_id, 'Demo Tenant 1', 'demo.tenant1@calqulusrms.com', '0712000002',
     'Sunset Gardens', 'A1', v_prop1_id, v_unit_a1,
     15000, 30000, 30000, '2025-03-01', 'active', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, monthly_rent = EXCLUDED.monthly_rent, status = EXCLUDED.status, updated_at = NOW();
  
  RAISE NOTICE '✓ Tenant created';
  
  -- ── Link tenant to user_roles ───────────────────────────────────
  UPDATE public.user_roles 
  SET tenant_id = v_tenant_id 
  WHERE user_id = v_tenant_user_id AND role = 'tenant';
  
  RAISE NOTICE '✓ Tenant linked to user role';
  
  -- ── Lease ─────────────────────────────────────────────────────
  INSERT INTO public.leases (
    id, tenant_id, property, unit, property_id, unit_id,
    monthly_rent, deposit, start_date, end_date, status, terms, created_at, updated_at
  ) VALUES
    (v_lease_id, v_tenant_id, 'Sunset Gardens', 'A1', v_prop1_id, v_unit_a1,
     15000, 30000, '2025-03-01', '2026-02-28', 'active',
     'Standard residential lease. Rent due 1st of each month. 2 months deposit paid.', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
  
  RAISE NOTICE '✓ Lease created';
  
  -- ── Invoices ──────────────────────────────────────────────────
  INSERT INTO public.invoices (id, manager_id, tenant_id, invoice_number, amount, status, due_date, paid_date, description, created_at, updated_at) VALUES
    (v_inv1, v_manager_id, v_tenant_id, 'INV-2026-05-001', 15000, 'paid', '2025-05-01', '2025-05-03', 'May 2025 rent — Flat A1', NOW(), NOW()),
    (v_inv2, v_manager_id, v_tenant_id, 'INV-2026-06-001', 15000, 'pending', '2025-06-01', NULL, 'June 2025 rent — Flat A1', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, paid_date = EXCLUDED.paid_date, updated_at = NOW();
  
  RAISE NOTICE '✓ Invoices created (2)';
  
  -- ── Payment Transaction ─────────────────────────────────────────
  INSERT INTO public.payment_transactions (
    manager_id, tenant_id, invoice_id, amount, payment_method, payment_date, reference, status, created_at, updated_at
  ) VALUES
    (v_manager_id, v_tenant_id, v_inv1, 15000, 'mpesa_stk', '2025-05-03', 'MPESA123456', 'completed', NOW(), NOW())
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '✓ Payment transaction created';
  
  -- ── Maintenance Request ───────────────────────────────────────
  INSERT INTO public.maintenance_requests (
    id, manager_id, property_id, unit_id, tenant_id,
    title, description, priority, status, category, requested_date, created_at, updated_at
  ) VALUES
    (gen_random_uuid(), v_manager_id, v_prop1_id, v_unit_a1, v_tenant_id,
     'Leaking kitchen tap', 'The kitchen tap has been dripping for 2 days.', 'medium', 'open', 'plumbing', NOW() - INTERVAL '2 days', NOW(), NOW())
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '✓ Maintenance request created';
  
  -- ── Update Manager Profile Stats ───────────────────────────────
  UPDATE public.manager_profiles
  SET property_count = 2,
      unit_count = 3,
      tenant_count = 1,
      updated_at = NOW()
  WHERE manager_user_id = v_manager_id;
  
  RAISE NOTICE '✓ Manager profile stats updated';
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Demo data created successfully for manager account!';
  RAISE NOTICE 'Manager: demo.manager@calqulusrms.com';
  RAISE NOTICE 'Properties: 2 (Sunset Gardens, Valley View Bungalows)';
  RAISE NOTICE 'Units: 3 (2 occupied, 1 vacant)';
  RAISE NOTICE 'Tenant: 1 (Demo Tenant 1 in Flat A1)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';

END $$;
