<#
.SYNOPSIS
    Seeds demo data into a Supabase project via the Management API.
.DESCRIPTION
    Inserts demo records into all application tables using auth.users email lookups.
    Requires SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF environment variables.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$SupabaseToken = $env:SUPABASE_ACCESS_TOKEN,

    [Parameter(Mandatory = $false)]
    [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

if (-not $SupabaseToken) {
    Write-Host "ERROR: -SupabaseToken not provided and SUPABASE_ACCESS_TOKEN is not set." -ForegroundColor Red
    exit 1
}
if (-not $ProjectRef) {
    Write-Host "ERROR: -ProjectRef not provided and SUPABASE_PROJECT_REF is not set." -ForegroundColor Red
    exit 1
}

function Run-Sql {
    param([string]$Sql)
    $body = @(@{ query = $Sql }) | ConvertTo-Json -Compress
    try {
        $response = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
            -Method POST `
            -Headers @{
                Authorization = "Bearer $SupabaseToken"
                "Content-Type" = "application/json"
            } `
            -Body $body `
            -TimeoutSec 120
        Write-Host "  OK" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
    }
}

Write-Host "=== CALQULUS RMS Demo Data Seed ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectRef"
Write-Host ""

# ============================================================
# 1. PROFILES
# ============================================================
Write-Host "[1/19] Inserting profiles..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.profiles (id, full_name, email, phone)
SELECT id, 'Demo Manager', email, '+254700000001'
FROM auth.users WHERE email = 'demo.manager@calqulusrms.com'
UNION ALL
SELECT id, 'Demo Landlord', email, '+254700000002'
FROM auth.users WHERE email = 'demo.landlord@calqulusrms.com'
UNION ALL
SELECT id, 'Demo Agent', email, '+254700000003'
FROM auth.users WHERE email = 'demo.agent@calqulusrms.com'
UNION ALL
SELECT id, 'Demo Tenant 1', email, '+254700000004'
FROM auth.users WHERE email = 'demo.tenant1@calqulusrms.com'
UNION ALL
SELECT id, 'Demo Tenant 2', email, '+254700000005'
FROM auth.users WHERE email = 'demo.tenant2@calqulusrms.com'
UNION ALL
SELECT id, 'Demo Tenant 3', email, '+254700000006'
FROM auth.users WHERE email = 'demo.tenant3@calqulusrms.com'
UNION ALL
SELECT id, 'Demo Provider', email, '+254700000007'
FROM auth.users WHERE email = 'demo.provider@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 2. USER ROLES
# ============================================================
Write-Host "[2/19] Inserting user_roles..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.user_roles (id, user_id, role)
SELECT 'aaaaaaa-bbbb-0001-0001-aaaaaaaaaaaa', id, 'manager'
FROM auth.users WHERE email = 'demo.manager@calqulusrms.com'
UNION ALL
SELECT 'aaaaaaa-bbbb-0002-0002-aaaaaaaaaaaa', id, 'landlord'
FROM auth.users WHERE email = 'demo.landlord@calqulusrms.com'
UNION ALL
SELECT 'aaaaaaa-bbbb-0003-0003-aaaaaaaaaaaa', id, 'submanager'
FROM auth.users WHERE email = 'demo.agent@calqulusrms.com'
UNION ALL
SELECT 'aaaaaaa-bbbb-0004-0004-aaaaaaaaaaaa', id, 'tenant'
FROM auth.users WHERE email = 'demo.tenant1@calqulusrms.com'
UNION ALL
SELECT 'aaaaaaa-bbbb-0005-0005-aaaaaaaaaaaa', id, 'tenant'
FROM auth.users WHERE email = 'demo.tenant2@calqulusrms.com'
UNION ALL
SELECT 'aaaaaaa-bbbb-0006-0006-aaaaaaaaaaaa', id, 'tenant'
FROM auth.users WHERE email = 'demo.tenant3@calqulusrms.com'
UNION ALL
SELECT 'aaaaaaa-bbbb-0007-0007-aaaaaaaaaaaa', id, 'tenant'
FROM auth.users WHERE email = 'demo.provider@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 3. AGENCIES
# ============================================================
Write-Host "[3/19] Inserting agencies..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.agencies (id, name, address, phone, email)
VALUES (
    '99999999-0001-0001-0001-999999999999',
    'CALQULUS RMS Demo Agency',
    '123 Demo Street, Nairobi',
    '+254700000100',
    'info@calqulusrmsdemo.com'
)
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 4. MANAGER PROFILES
# ============================================================
Write-Host "[4/19] Inserting manager_profiles..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.manager_profiles (id, user_id, agency_id, title, phone)
SELECT
    'aaaaaaaa-aaaa-0001-0001-aaaaaaaaaaaa',
    au.id,
    '99999999-0001-0001-0001-999999999999',
    'General Manager',
    '+254700000001'
FROM auth.users au
WHERE au.email = 'demo.manager@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 5. SUBMANAGER PERMISSIONS
# ============================================================
Write-Host "[5/19] Inserting submanager_permissions..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.submanager_permissions (id, submanager_user_id, manager_id, can_view_tenants, can_manage_maintenance, can_record_payments, restrict_to_assigned_properties)
SELECT
    'aaaaaaaa-cccc-0001-0001-aaaaaaaaaaaa',
    sub.id,
    mgr.id,
    true, true, true, false
FROM auth.users sub, auth.users mgr
WHERE sub.email = 'demo.agent@calqulusrms.com' AND mgr.email = 'demo.manager@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 6. PROPERTIES
# ============================================================
Write-Host "[6/19] Inserting properties..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.properties (id, name, address, city, county, manager_id, agency_id)
SELECT
    'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
    'Sunset Towers',
    '123 Sunset Boulevard',
    'Nairobi',
    'Nairobi County',
    au.id,
    '99999999-0001-0001-0001-999999999999'
FROM auth.users au WHERE au.email = 'demo.manager@calqulusrms.com'
UNION ALL
SELECT
    'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa',
    'Green Acres Estate',
    '456 Mombasa Road',
    'Mombasa',
    'Mombasa County',
    au.id,
    '99999999-0001-0001-0001-999999999999'
FROM auth.users au WHERE au.email = 'demo.manager@calqulusrms.com'
UNION ALL
SELECT
    'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa',
    'City Heights Apartments',
    '789 City Avenue',
    'Nairobi',
    'Nairobi County',
    au.id,
    '99999999-0001-0001-0001-999999999999'
FROM auth.users au WHERE au.email = 'demo.manager@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 7. UNITS
# ============================================================
Write-Host "[7/19] Inserting units..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.units (id, property_id, unit_number, bedrooms, bathrooms, rent_amount, deposit_amount, status)
VALUES
    ('bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', 'A101', 2, 1, 25000, 50000, 'available'),
    ('bbbbbbbb-0001-0002-0002-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', 'A102', 1, 1, 18000, 36000, 'available'),
    ('bbbbbbbb-0001-0003-0003-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', 'A103', 3, 2, 35000, 70000, 'available'),
    ('bbbbbbbb-0002-0001-0001-bbbbbbbbbbbb', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', 'B201', 2, 1, 22000, 44000, 'available'),
    ('bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', 'B202', 1, 1, 15000, 30000, 'available'),
    ('bbbbbbbb-0002-0003-0003-bbbbbbbbbbbb', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', 'B203', 2, 2, 28000, 56000, 'available'),
    ('bbbbbbbb-0003-0001-0001-bbbbbbbbbbbb', 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', 'C301', 1, 1, 20000, 40000, 'available'),
    ('bbbbbbbb-0003-0002-0002-bbbbbbbbbbbb', 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', 'C302', 2, 1, 27000, 54000, 'available'),
    ('bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb', 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', 'C303', 3, 2, 40000, 80000, 'available')
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 8. TENANTS
# ============================================================
Write-Host "[8/19] Inserting tenants..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.tenants (id, user_id, unit_id, lease_start, lease_end, rent_amount, deposit_paid, status)
SELECT
    'cccccccc-0001-0001-0001-cccccccccccc',
    au.id,
    'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb',
    '2025-01-01'::date,
    '2025-12-31'::date,
    25000,
    50000,
    'active'
FROM auth.users au WHERE au.email = 'demo.tenant1@calqulusrms.com'
UNION ALL
SELECT
    'cccccccc-0002-0002-0002-cccccccccccc',
    au.id,
    'bbbbbbbb-0002-0001-0001-bbbbbbbbbbbb',
    '2025-02-01'::date,
    '2026-01-31'::date,
    22000,
    44000,
    'active'
FROM auth.users au WHERE au.email = 'demo.tenant2@calqulusrms.com'
UNION ALL
SELECT
    'cccccccc-0003-0003-0003-cccccccccccc',
    au.id,
    'bbbbbbbb-0003-0001-0001-bbbbbbbbbbbb',
    '2025-03-01'::date,
    '2026-02-28'::date,
    20000,
    40000,
    'active'
FROM auth.users au WHERE au.email = 'demo.tenant3@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 9. LEASES
# ============================================================
Write-Host "[9/19] Inserting leases..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.leases (id, tenant_id, unit_id, start_date, end_date, rent_amount, deposit_amount, status)
VALUES
    (
        'eeeeeeee-0001-0001-0001-eeeeeeeeeeee',
        'cccccccc-0001-0001-0001-cccccccccccc',
        'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb',
        '2025-01-01'::date,
        '2025-12-31'::date,
        25000,
        50000,
        'active'
    ),
    (
        'eeeeeeee-0002-0002-0002-eeeeeeeeeeee',
        'cccccccc-0002-0002-0002-cccccccccccc',
        'bbbbbbbb-0002-0001-0001-bbbbbbbbbbbb',
        '2025-02-01'::date,
        '2026-01-31'::date,
        22000,
        44000,
        'active'
    )
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 10. INVOICES
# ============================================================
Write-Host "[10/19] Inserting invoices..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.invoices (id, tenant_id, lease_id, amount, due_date, status, period_start, period_end)
VALUES
    ('dddddddd-0001-0001-0001-dddddddddddd', 'cccccccc-0001-0001-0001-cccccccccccc', 'eeeeeeee-0001-0001-0001-eeeeeeeeeeee', 25000, '2025-01-01'::date, 'paid', '2025-01-01'::date, '2025-01-31'::date),
    ('dddddddd-0002-0002-0002-dddddddddddd', 'cccccccc-0001-0001-0001-cccccccccccc', 'eeeeeeee-0001-0001-0001-eeeeeeeeeeee', 25000, '2025-02-01'::date, 'pending', '2025-02-01'::date, '2025-02-28'::date),
    ('dddddddd-0003-0003-0003-dddddddddddd', 'cccccccc-0001-0001-0001-cccccccccccc', 'eeeeeeee-0001-0001-0001-eeeeeeeeeeee', 25000, '2025-03-01'::date, 'overdue', '2025-03-01'::date, '2025-03-31'::date),
    ('dddddddd-0004-0004-0004-dddddddddddd', 'cccccccc-0002-0002-0002-cccccccccccc', 'eeeeeeee-0002-0002-0002-eeeeeeeeeeee', 22000, '2025-02-01'::date, 'paid', '2025-02-01'::date, '2025-02-28'::date),
    ('dddddddd-0005-0005-0005-dddddddddddd', 'cccccccc-0002-0002-0002-cccccccccccc', 'eeeeeeee-0002-0002-0002-eeeeeeeeeeee', 22000, '2025-03-01'::date, 'pending', '2025-03-01'::date, '2025-03-31'::date),
    ('dddddddd-0006-0006-0006-dddddddddddd', 'cccccccc-0002-0002-0002-cccccccccccc', 'eeeeeeee-0002-0002-0002-eeeeeeeeeeee', 22000, '2025-04-01'::date, 'overdue', '2025-04-01'::date, '2025-04-30'::date)
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 11. MAINTENANCE REQUESTS
# ============================================================
Write-Host "[11/19] Inserting maintenance_requests..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.maintenance_requests (id, tenancy_id, property_name, tenant_name, tenant_email, unit_number, description, status, priority)
VALUES
    (
        'ffffffff-0001-0001-0001-ffffffffffff',
        'cccccccc-0001-0001-0001-cccccccccccc',
        'Sunset Towers',
        'Demo Tenant 1',
        'demo.tenant1@calqulusrms.com',
        'A101',
        'Leaking kitchen faucet',
        'pending',
        'medium'
    ),
    (
        'ffffffff-0002-0002-0002-ffffffffffff',
        'cccccccc-0002-0002-0002-cccccccccccc',
        'Green Acres Estate',
        'Demo Tenant 2',
        'demo.tenant2@calqulusrms.com',
        'B201',
        'Broken water heater',
        'in_progress',
        'high'
    )
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 12. MESSAGES
# ============================================================
Write-Host "[12/19] Inserting messages..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.messages (id, sender_id, receiver_id, subject, body, is_read)
SELECT
    '11111111-0001-0001-0001-111111111111',
    s.id, r.id,
    'Welcome to CALQULUS RMS',
    'Your tenancy has been created. Please review your lease details.',
    false
FROM auth.users s, auth.users r
WHERE s.email = 'demo.manager@calqulusrms.com' AND r.email = 'demo.tenant1@calqulusrms.com'
UNION ALL
SELECT
    '11111111-0002-0002-0002-111111111111',
    s.id, r.id,
    'Maintenance Request',
    'I have a leaking faucet in the kitchen that needs attention.',
    false
FROM auth.users s, auth.users r
WHERE s.email = 'demo.tenant1@calqulusrms.com' AND r.email = 'demo.manager@calqulusrms.com'
UNION ALL
SELECT
    '11111111-0003-0003-0003-111111111111',
    s.id, r.id,
    'Rent Reminder',
    'Your rent of KES 22,000 is due on 1st March 2025.',
    false
FROM auth.users s, auth.users r
WHERE s.email = 'demo.manager@calqulusrms.com' AND r.email = 'demo.tenant2@calqulusrms.com'
UNION ALL
SELECT
    '11111111-0004-0004-0004-111111111111',
    s.id, r.id,
    'Payment Confirmation',
    'I have made the payment via M-Pesa. Please confirm.',
    false
FROM auth.users s, auth.users r
WHERE s.email = 'demo.tenant2@calqulusrms.com' AND r.email = 'demo.manager@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 13. IN-APP NOTIFICATIONS
# ============================================================
Write-Host "[13/19] Inserting in_app_notifications..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.in_app_notifications (id, user_id, title, message, type, is_read)
SELECT
    '22222222-0001-0001-0001-222222222222',
    au.id,
    'New Tenant Registered',
    'Demo Tenant 1 has registered and been assigned to Sunset Towers.',
    'info',
    false
FROM auth.users au WHERE au.email = 'demo.manager@calqulusrms.com'
UNION ALL
SELECT
    '22222222-0002-0002-0002-222222222222',
    au.id,
    'Payment Received',
    'Your payment of KES 25,000 for January rent has been received.',
    'success',
    false
FROM auth.users au WHERE au.email = 'demo.tenant1@calqulusrms.com'
UNION ALL
SELECT
    '22222222-0003-0003-0003-222222222222',
    au.id,
    'Maintenance Update',
    'Your maintenance request for the water heater has been marked as in progress.',
    'warning',
    false
FROM auth.users au WHERE au.email = 'demo.tenant2@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 14. SERVICE PROVIDERS
# ============================================================
Write-Host "[14/19] Inserting service_providers..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.service_providers (id, user_id, company_name, phone, trade)
SELECT
    '33333333-0001-0001-0001-333333333333',
    au.id,
    'Quick Fix Services',
    '+254700000007',
    'Handyman'
FROM auth.users au WHERE au.email = 'demo.provider@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 15. PROVIDER SERVICES
# ============================================================
Write-Host "[15/19] Inserting provider_services..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.provider_services (id, provider_id, service_name, description, rate)
VALUES
    (
        '44444444-0001-0001-0001-444444444444',
        '33333333-0001-0001-0001-333333333333',
        'Plumbing',
        'General plumbing repairs and installations',
        2500
    ),
    (
        '44444444-0002-0002-0002-444444444444',
        '33333333-0001-0001-0001-333333333333',
        'Electrical',
        'Electrical repairs and installations',
        3000
    ),
    (
        '44444444-0003-0003-0003-444444444444',
        '33333333-0001-0001-0001-333333333333',
        'Painting',
        'Interior and exterior painting services',
        5000
    )
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 16. ORPHAN TENANT RECORDS
# ============================================================
Write-Host "[16/19] Inserting orphan_tenant_records..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.orphan_tenant_records (id, name, email, phone)
VALUES (
    '55555555-0001-0001-0001-555555555555',
    'John Doe',
    'john.doe@example.com',
    '+254700000010'
)
ON CONFLICT (id) DO NOTHING;
"@

# 17. ORPHAN PAYMENT ENTRIES

Write-Host "[17/19] Inserting orphan_payment_entries..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.orphan_payment_entries (id, amount, payment_date, description)
VALUES
    ('66666666-0001-0001-0001-666666666666', 15000, '2025-01-15'::date, 'Cash payment for rent'),
    ('66666666-0002-0002-0002-666666666666', 25000, '2025-02-10'::date, 'M-Pesa payment for rent'),
    ('66666666-0003-0003-0003-666666666666', 10000, '2025-03-05'::date, 'Partial payment')
ON CONFLICT (id) DO NOTHING;
"@


# 18. MANAGER MPESA SETTINGS

Write-Host "[18/19] Inserting manager_mpesa_settings..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.manager_mpesa_settings (id, manager_user_id, consumer_key, consumer_secret, passkey, shortcode, is_live)
SELECT
    '77777777-0001-0001-0001-777777777777',
    au.id,
    'ck_demo_key',
    'cs_demo_secret',
    'pk_demo_passkey',
    '174379',
    false
FROM auth.users au WHERE au.email = 'demo.manager@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

# ============================================================
# 19. MANAGER INVOICES
# ============================================================
Write-Host "[19/19] Inserting manager_invoices..." -ForegroundColor Yellow
Run-Sql -Sql @"
INSERT INTO public.manager_invoices (id, manager_user_id, amount, description, status)
SELECT
    '88888888-0001-0001-0001-888888888888',
    au.id,
    5000,
    'Monthly management fee - January 2025',
    'pending'
FROM auth.users au WHERE au.email = 'demo.manager@calqulusrms.com'
ON CONFLICT (id) DO NOTHING;
"@

Write-Host ""
Write-Host "=== Seed completed successfully! ===" -ForegroundColor Cyan
