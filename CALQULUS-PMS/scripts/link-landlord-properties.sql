-- ============================================================
-- Link Demo Landlord to Properties for Dashboard Stability
-- Landlord: demo.landlord@calqulusrms.com (ID: 98f9b718-e226-41bc-b211-30de4c90b2b8)
-- ============================================================

DO $$
DECLARE
  v_landlord_id uuid := '98f9b718-e226-41bc-b211-30de4c90b2b8';
  v_manager_id uuid := '4cbb0a75-a9d8-4aef-8a64-9c99245eab64';
  
  -- Property IDs from the demo data
  v_prop1_id uuid := 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa';
  v_prop2_id uuid := 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa';

BEGIN
  -- Link landlord to Sunset Gardens (50% revenue share)
  INSERT INTO public.property_landlords (
    property_id, 
    landlord_user_id, 
    manager_id, 
    revenue_share_pct, 
    operating_model, 
    payment_destination, 
    assigned_at
  ) VALUES (
    v_prop1_id, 
    v_landlord_id, 
    v_manager_id, 
    50, 
    'revenue_share', 
    'landlord_account', 
    NOW()
  ) ON CONFLICT (property_id, landlord_user_id) DO UPDATE SET
    revenue_share_pct = EXCLUDED.revenue_share_pct,
    manager_id = EXCLUDED.manager_id,
    assigned_at = NOW();
  
  -- Link landlord to Valley View Bungalows (60% revenue share)
  INSERT INTO public.property_landlords (
    property_id, 
    landlord_user_id, 
    manager_id, 
    revenue_share_pct, 
    operating_model, 
    payment_destination, 
    assigned_at
  ) VALUES (
    v_prop2_id, 
    v_landlord_id, 
    v_manager_id, 
    60, 
    'revenue_share', 
    'landlord_account', 
    NOW()
  ) ON CONFLICT (property_id, landlord_user_id) DO UPDATE SET
    revenue_share_pct = EXCLUDED.revenue_share_pct,
    manager_id = EXCLUDED.manager_id,
    assigned_at = NOW();
  
  RAISE NOTICE '✓ Demo landlord linked to 2 properties';
  RAISE NOTICE '✓ Sunset Gardens: 50% revenue share';
  RAISE NOTICE '✓ Valley View Bungalows: 60% revenue share';
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Landlord dashboard should now be stable with property data';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';

END $$;
