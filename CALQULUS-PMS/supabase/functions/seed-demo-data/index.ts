/**
 * seed-demo-data/index.ts
 * 
 * SECURITY WARNING: This edge function creates demo/test data.
 * 
 * Access control:
 * - ONLY accepts requests with valid SERVICE_ROLE_KEY
 * - Demo secret header is ONLY accepted in non-production environments
 * - All other authentication methods have been disabled for security
 * 
 * Production deployments should NEVER have DEMO_SECRET set.
 */

import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { withSecurityHeaders } from "../_shared/security.ts";

import { requireEnv, getEnv } from "../_shared/env.ts";
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// Fixed UUIDs so data is predictable and resettable
const IDS = {
  manager:    "bbb3f48d-b5e1-4363-84c8-bf51cb1f39fb",
  tenant1:    "157df74f-2c05-4e17-8e58-9807b26d312a",
  tenant2:    "f1ddb0f3-1264-4a29-b251-35f5468d29dc",
  tenant3:    "730aa9cd-ffbb-4025-ae58-df45dc456064",
  landlord:   "1883ebd4-9ab3-4680-9fc1-3b605f6cec86",
  agent:      "c6a638a8-42f7-4cf3-bfe1-cf576aedfadd",
  provider:   "3667f077-011e-412e-be5e-a4f6159b6b88",

  prop1:      "aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa",
  prop2:      "aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa",
  prop3:      "aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa",

  unitA3:     "bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb",
  unitB1:     "bbbbbbbb-0004-0004-0004-bbbbbbbbbbbb",
  unitA1:     "bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb",

  ten1:       "cccccccc-0001-0001-0001-cccccccccccc",
  ten2:       "cccccccc-0002-0002-0002-cccccccccccc",
  ten3:       "cccccccc-0003-0003-0003-cccccccccccc",

  provider_row: "88888888-8888-8888-8888-888888888888",
};

const DEMO_USERS = [
  { id: IDS.manager,  email: "demo.manager@calqulusrms.com",  name: "James Kariuki",    role: "manager" },
  { id: IDS.tenant1,  email: "demo.tenant1@calqulusrms.com",  name: "Grace Wanjiku",    role: "tenant", tenantId: IDS.ten1 },
  { id: IDS.tenant2,  email: "demo.tenant2@calqulusrms.com",  name: "Brian Otieno",     role: "tenant", tenantId: IDS.ten2 },
  { id: IDS.tenant3,  email: "demo.tenant3@calqulusrms.com",  name: "Amina Hassan",     role: "tenant" },
  { id: IDS.landlord, email: "demo.landlord@calqulusrms.com", name: "Peter Mwangi",     role: "landlord" },
  { id: IDS.agent,    email: "demo.agent@calqulusrms.com",    name: "Fatuma Abubakar",  role: "submanager" },
  { id: IDS.provider, email: "demo.provider@calqulusrms.com", name: "Joseph Kamau",     role: "tenant" },
];

const DEMO_PASSWORD = "Demo@2026";

/**
 * SECURITY: Check if we're in a production environment.
 * Demo functionality should be disabled in production.
 */
function isProduction(): boolean {
  const env = (getEnv("ENVIRONMENT") || getEnv("NODE_ENV") || "").toLowerCase();
  if (env === "development" || env === "dev" || env === "local") return false;
  // Fail closed: unset or unknown environments cannot seed.
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  // SECURITY: Block all requests in production
  if (isProduction()) {
    const response = new Response(
      JSON.stringify({ error: "Demo data seeding is not available in production." }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
    return withSecurityHeaders(response, req);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { action } = await req.json().catch(() => ({ action: "seed" }));

  // ── SECURITY: Only accept service role key ─────────────────────────
  // All other authentication methods (webhost JWT, demo secret) are disabled
  // for security. This function should only be called by authorized scripts.
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceCall = authHeader === `Bearer ${SERVICE_KEY}`;

  // SECURITY: Require service role key for all operations
  if (!isServiceCall) {
    const response = new Response(
      JSON.stringify({ error: "Unauthorized: This function requires service role authentication." }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
    return withSecurityHeaders(response, req);
  }

  // Continue with the seeding logic...
  try {
    if (action === "reset") {
      await resetDemoData(supabase);
      const results = await seedDemoData(supabase);
      const response = Response.json({ ok: true, message: "Demo data reset complete", results }, { headers: getCorsHeaders(req) });
      return withSecurityHeaders(response, req);
    }

    const results = await seedDemoData(supabase);
    const response = Response.json({ ok: true, results }, { headers: getCorsHeaders(req) });
    return withSecurityHeaders(response, req);

  } catch (err: any) {
    console.error("Seed error:", err);
    const response = Response.json({ error: err.message }, { status: 500, headers: getCorsHeaders(req) });
    return withSecurityHeaders(response, req);
  }
});

async function resetDemoData(supabase: any) {
  // Delete in reverse dependency order
  const userIds = Object.values(IDS).filter((_, i) => i < 7); // first 7 are user IDs
  
  await supabase.from("orphan_payment_entries").delete().in("user_id", userIds);
  await supabase.from("orphan_tenant_records").delete().in("user_id", userIds);
  await supabase.from("provider_services").delete().eq("provider_id", IDS.provider_row);
  await supabase.from("service_providers").delete().eq("id", IDS.provider_row);
  await supabase.from("payment_transactions").delete().eq("manager_id", IDS.manager);
  await supabase.from("in_app_notifications").delete().eq("manager_id", IDS.manager);
  await supabase.from("messages").delete().eq("manager_id", IDS.manager);
  await supabase.from("maintenance_requests").delete().eq("manager_id", IDS.manager);
  await supabase.from("invoices").delete().eq("manager_id", IDS.manager);
  await supabase.from("leases").delete().in("tenant_id", [IDS.ten1, IDS.ten2, IDS.ten3]);
  await supabase.from("tenants").delete().eq("manager_id", IDS.manager);
  await supabase.from("units").delete().in("property_id", [IDS.prop1, IDS.prop2, IDS.prop3]);
  await supabase.from("properties").delete().in("id", [IDS.prop1, IDS.prop2, IDS.prop3]);
  await supabase.from("manager_invoices").delete().eq("manager_user_id", IDS.manager);
  await supabase.from("mpesa_settings").delete().eq("manager_id", IDS.manager);
  await supabase.from("manager_profiles").delete().eq("manager_user_id", IDS.manager);
  await supabase.from("user_roles").delete().in("user_id", userIds);
  await supabase.from("profiles").delete().in("id", userIds);

  // Delete auth users
  for (const uid of userIds) {
    await supabase.auth.admin.deleteUser(uid).catch(() => {});
  }
}

async function seedDemoData(supabase: any) {
  const log: string[] = [];

  // ── Create auth users ───────────────────────────────────────────
  for (const u of DEMO_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      user_id:        u.id,
      email:          u.email,
      password:       DEMO_PASSWORD,
      email_confirm:  true,
      user_metadata:  { full_name: u.name },
    });
    if (error && !error.message.includes("already exists")) {
      log.push(`⚠️ User ${u.email}: ${error.message}`);
    } else {
      log.push(`✓ User ${u.email}`);
    }
  }

  // ── Profiles ─────────────────────────────────────────────────────
  await supabase.from("profiles").upsert([
    { id: IDS.manager,  full_name: "James Kariuki",    email: "demo.manager@calqulusrms.com",  phone: "0712000001" },
    { id: IDS.tenant1,  full_name: "Grace Wanjiku",    email: "demo.tenant1@calqulusrms.com",  phone: "0712000002" },
    { id: IDS.tenant2,  full_name: "Brian Otieno",     email: "demo.tenant2@calqulusrms.com",  phone: "0712000003" },
    { id: IDS.tenant3,  full_name: "Amina Hassan",     email: "demo.tenant3@calqulusrms.com",  phone: "0712000004" },
    { id: IDS.landlord, full_name: "Peter Mwangi",     email: "demo.landlord@calqulusrms.com", phone: "0712000005" },
    { id: IDS.agent,    full_name: "Fatuma Abubakar",  email: "demo.agent@calqulusrms.com",    phone: "0712000006" },
    { id: IDS.provider, full_name: "Joseph Kamau",     email: "demo.provider@calqulusrms.com", phone: "0722123456" },
  ], { onConflict: "id" });
  log.push("✓ Profiles");

  // ── User roles ────────────────────────────────────────────────────
  await supabase.from("user_roles").upsert([
    { user_id: IDS.manager,  role: "manager",    approval_status: "approved", tenant_id: null },
    { user_id: IDS.tenant1,  role: "tenant",     approval_status: "approved", tenant_id: IDS.ten1 },
    { user_id: IDS.tenant2,  role: "tenant",     approval_status: "approved", tenant_id: IDS.ten2 },
    { user_id: IDS.tenant3,  role: "tenant",     approval_status: "approved", tenant_id: null },
    { user_id: IDS.landlord, role: "landlord",   approval_status: "approved", tenant_id: null },
    { user_id: IDS.agent,    role: "submanager", approval_status: "approved", tenant_id: null },
    { user_id: IDS.provider, role: "tenant",     approval_status: "approved", tenant_id: null },
  ], { onConflict: "user_id" });
  log.push("✓ User roles");

  // ── Manager profile + agency ─────────────────────────────────────
  await supabase.from("manager_profiles").upsert(
    { manager_user_id: IDS.manager, status: "approved", subscription_tier: "pro", property_count: 3, platform_rate: 600 },
    { onConflict: "manager_user_id" }
  );
  await supabase.from("agencies").upsert(
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-000000000001", manager_id: IDS.manager, name: "Nairobi Realty Group", email: "demo.manager@calqulusrms.com", phone: "0712000001", county: "Nairobi", status: "active", tier: "standard" },
    { onConflict: "manager_id" }
  );
  log.push("✓ Manager profile + agency");

  // ── Submanager permissions ────────────────────────────────────────
  await supabase.from("submanager_permissions").upsert(
    { submanager_user_id: IDS.agent, manager_id: IDS.manager, can_manage_maintenance: true, can_record_payments: false, can_view_financials: true, restrict_to_assigned_properties: false },
    { onConflict: "submanager_user_id,manager_id" }
  );
  log.push("✓ Submanager (agent) permissions");

  // ── Properties ────────────────────────────────────────────────────
  await supabase.from("properties").upsert([
    { id: IDS.prop1, manager_id: IDS.manager, name: "Sunset Gardens",           address: "14 Kiambu Road, Westlands, Nairobi",  units: 4, occupied: 3, revenue: 45000, status: "active", property_type: "flat",       category_key: "residential_flat" },
    { id: IDS.prop2, manager_id: IDS.manager, name: "Valley View Bungalows",    address: "7 Karen Road, Karen, Nairobi",        units: 3, occupied: 2, revenue: 63000, status: "active", property_type: "bungalow",   category_key: "residential_bungalow" },
    { id: IDS.prop3, manager_id: IDS.manager, name: "Westlands Office Complex", address: "22 Waiyaki Way, Westlands, Nairobi",  units: 4, occupied: 2, revenue: 95000, status: "active", property_type: "commercial", category_key: "commercial_office" },
  ], { onConflict: "id" });
  log.push("✓ Properties (3)");

  // ── Units ─────────────────────────────────────────────────────────
  // All units with clean unique IDs — no duplicates
  const UNIT_IDS = {
    a1: "bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb",
    a2: "bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb",
    a3: "bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb", // Grace's unit
    a4: "bbbbbbbb-0004-0004-0004-bbbbbbbbbbbb",
    b1: "bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb", // Brian's unit
    b2: "bbbbbbbb-0006-0006-0006-bbbbbbbbbbbb",
    b3: "bbbbbbbb-0007-0007-0007-bbbbbbbbbbbb",
    c1: "bbbbbbbb-0008-0008-0008-bbbbbbbbbbbb",
    c2: "bbbbbbbb-0009-0009-0009-bbbbbbbbbbbb",
  };
  await supabase.from("units").upsert([
    { id: UNIT_IDS.a1, property_id: IDS.prop1, unit_number: "A1", label: "Flat A1 – Ground Floor", unit_type: "one_bedroom",    floor_number: 0, monthly_rent: 12000, status: "occupied" },
    { id: UNIT_IDS.a2, property_id: IDS.prop1, unit_number: "A2", label: "Flat A2 – Ground Floor", unit_type: "two_bedroom",    floor_number: 0, monthly_rent: 15000, status: "occupied" },
    { id: UNIT_IDS.a3, property_id: IDS.prop1, unit_number: "A3", label: "Flat A3 – First Floor",  unit_type: "bedsitter",      floor_number: 1, monthly_rent:  8500, status: "occupied" },
    { id: UNIT_IDS.a4, property_id: IDS.prop1, unit_number: "A4", label: "Flat A4 – First Floor",  unit_type: "studio",         floor_number: 1, monthly_rent:  9500, status: "vacant"   },
    { id: UNIT_IDS.b1, property_id: IDS.prop2, unit_number: "B1", label: "Bungalow 1",             unit_type: "three_bedroom",  floor_number: 0, monthly_rent: 35000, status: "occupied" },
    { id: UNIT_IDS.b2, property_id: IDS.prop2, unit_number: "B2", label: "Bungalow 2",             unit_type: "two_bedroom",    floor_number: 0, monthly_rent: 28000, status: "occupied" },
    { id: UNIT_IDS.b3, property_id: IDS.prop2, unit_number: "B3", label: "Bungalow 3",             unit_type: "three_bedroom",  floor_number: 0, monthly_rent: 32000, status: "vacant"   },
    { id: UNIT_IDS.c1, property_id: IDS.prop3, unit_number: "C1", label: "Office Suite 1",         unit_type: "office",         floor_number: 0, monthly_rent: 45000, status: "occupied" },
    { id: UNIT_IDS.c2, property_id: IDS.prop3, unit_number: "C2", label: "Office Suite 2",         unit_type: "office",         floor_number: 1, monthly_rent: 50000, status: "occupied" },
  ], { onConflict: "id" });
  // Update IDS references to use correct unit IDs
  IDS.unitA1 = UNIT_IDS.a1;
  IDS.unitA3 = UNIT_IDS.a3;
  IDS.unitB1 = UNIT_IDS.b1;
  log.push("✓ Units (9)");

  // ── Tenants ───────────────────────────────────────────────────────
  await supabase.from("tenants").upsert([
    { id: IDS.ten1, manager_id: IDS.manager, name: "Grace Wanjiku",  email: "demo.tenant1@calqulusrms.com", phone: "0712000002", property: "Sunset Gardens",        unit: "A3", property_id: IDS.prop1, unit_id: "bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb", monthly_rent: 8500,  deposit_amount: 17000, deposit_balance: 17000, move_in_date: "2025-03-01", status: "active" },
    { id: IDS.ten2, manager_id: IDS.manager, name: "Brian Otieno",   email: "demo.tenant2@calqulusrms.com", phone: "0712000003", property: "Valley View Bungalows", unit: "B1", property_id: IDS.prop2, unit_id: "bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb", monthly_rent: 35000, deposit_amount: 70000, deposit_balance: 70000, move_in_date: "2024-09-15", status: "active" },
    { id: IDS.ten3, manager_id: IDS.manager, name: "Samuel Njoroge", email: "samuel.njoroge@email.com",  phone: "0712000099", property: "Sunset Gardens",        unit: "A1", property_id: IDS.prop1, unit_id: "bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb", monthly_rent: 12000, deposit_amount: 24000, deposit_balance: 24000, move_in_date: "2024-06-01", status: "active" },
  ], { onConflict: "id" });
  log.push("✓ Tenants (3)");

  // ── Invoices ──────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const twoMonths = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  await supabase.from("invoices").upsert([
    { id: "dddddddd-0001-0001-0001-dddddddddddd", manager_id: IDS.manager, tenant_id: IDS.ten1, invoice_number: "INV-DEMO-001", amount: 8500,  status: "paid",    due_date: twoMonths, paid_date: twoMonths, description: "February 2026 rent — Flat A3" },
    { id: "dddddddd-0002-0002-0002-dddddddddddd", manager_id: IDS.manager, tenant_id: IDS.ten1, invoice_number: "INV-DEMO-002", amount: 8500,  status: "overdue", due_date: lastMonth, paid_date: null,      description: "March 2026 rent — Flat A3" },
    { id: "dddddddd-0003-0003-0003-dddddddddddd", manager_id: IDS.manager, tenant_id: IDS.ten1, invoice_number: "INV-DEMO-003", amount: 8500,  status: "pending", due_date: today,     paid_date: null,      description: "April 2026 rent — Flat A3" },
    { id: "dddddddd-0004-0004-0004-dddddddddddd", manager_id: IDS.manager, tenant_id: IDS.ten2, invoice_number: "INV-DEMO-004", amount: 35000, status: "paid",    due_date: twoMonths, paid_date: twoMonths, description: "February 2026 rent — Bungalow B1" },
    { id: "dddddddd-0005-0005-0005-dddddddddddd", manager_id: IDS.manager, tenant_id: IDS.ten2, invoice_number: "INV-DEMO-005", amount: 35000, status: "paid",    due_date: lastMonth, paid_date: lastMonth, description: "March 2026 rent — Bungalow B1" },
    { id: "dddddddd-0006-0006-0006-dddddddddddd", manager_id: IDS.manager, tenant_id: IDS.ten2, invoice_number: "INV-DEMO-006", amount: 35000, status: "pending", due_date: nextMonth, paid_date: null,      description: "April 2026 rent — Bungalow B1" },
  ], { onConflict: "id" });
  log.push("✓ Invoices (6: 3 paid, 2 pending, 1 overdue)");

  // ── Leases ────────────────────────────────────────────────────────
  await supabase.from("leases").upsert([
    { id: "eeeeeeee-0001-0001-0001-eeeeeeeeeeee", tenant_id: IDS.ten1, property: "Sunset Gardens",        unit: "A3", property_id: IDS.prop1, unit_id: "bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb", monthly_rent: 8500, deposit: 17000, start_date: "2025-03-01", end_date: "2026-02-28", status: "active", terms: "Standard 12-month residential lease. Rent due 1st of each month. 2-month deposit paid." },
    { id: "eeeeeeee-0002-0002-0002-eeeeeeeeeeee", tenant_id: IDS.ten2, property: "Valley View Bungalows", unit: "B1", property_id: IDS.prop2, unit_id: "bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb", monthly_rent: 35000, deposit: 70000, start_date: "2024-09-15", end_date: "2025-09-14", status: "active", terms: "Premium bungalow lease. Includes water and estate maintenance. 2-month deposit paid." },
  ], { onConflict: "id" });
  log.push("✓ Leases (2)");

  // ── Maintenance requests ──────────────────────────────────────────
  await supabase.from("maintenance_requests").upsert([
    { id: "ffffffff-0001-0001-0001-ffffffffffff", manager_id: IDS.manager, property_id: IDS.prop1, property_name: "Sunset Gardens", unit_id: "bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb", unit_number: "A3", tenant_name: "Grace Wanjiku", tenant_email: "demo.tenant1@calqulusrms.com", title: "Leaking kitchen tap", description: "The kitchen tap has been dripping for 3 days, wasting water and making noise at night.", priority: "medium", status: "open", category: "plumbing", requested_date: new Date(Date.now() - 2 * 864e5).toISOString() },
    { id: "ffffffff-0002-0002-0002-ffffffffffff", manager_id: IDS.manager, property_id: IDS.prop1, property_name: "Sunset Gardens", unit_id: "bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb", unit_number: "A1", tenant_name: "Samuel Njoroge", tenant_email: "samuel.njoroge@email.com", title: "Broken bedroom window lock", description: "Window lock in the master bedroom is completely broken. Security risk.", priority: "high", status: "in_progress", category: "carpentry", requested_date: new Date(Date.now() - 5 * 864e5).toISOString(), assigned_to: "Kamau Electricals" },
    { id: "ffffffff-0003-0003-0003-ffffffffffff", manager_id: IDS.manager, property_id: IDS.prop2, property_name: "Valley View Bungalows", unit_id: "bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb", unit_number: "B1", tenant_name: "Brian Otieno", tenant_email: "demo.tenant2@calqulusrms.com", title: "Electricity trip — living room", description: "The MCB for the living room circuit trips every evening when multiple appliances are on. Happens around 7-9pm.", priority: "urgent", status: "open", category: "electrical", requested_date: new Date(Date.now() - 1 * 864e5).toISOString(), assigned_to: "Kamau Electrical Services", assigned_provider_id: IDS.provider_row },
  ], { onConflict: "id" });
  log.push("✓ Maintenance requests (3)");

  // ── Messages ──────────────────────────────────────────────────────
  // messages uses sender_id + sender_role + body (not sender_type + content)
  await supabase.from("messages").upsert([
    { manager_id: IDS.manager, tenant_id: IDS.ten1, sender_id: IDS.manager,  sender_role: "manager", recipient_id: IDS.tenant1, recipient_type: "tenant", body: "Hi Grace, this is a reminder that your March rent of KES 8,500 is now overdue. Please pay at your earliest convenience.", is_read: true,  created_at: new Date(Date.now() - 5 * 864e5).toISOString() },
    { manager_id: IDS.manager, tenant_id: IDS.ten1, sender_id: IDS.tenant1,  sender_role: "tenant",  recipient_id: IDS.manager,  recipient_type: "manager", body: "Hi James, I apologize for the delay. I will pay by end of this week via M-Pesa. Kindly send me the paybill details again.", is_read: true, created_at: new Date(Date.now() - 4 * 864e5).toISOString() },
    { manager_id: IDS.manager, tenant_id: IDS.ten1, sender_id: IDS.manager,  sender_role: "manager", recipient_id: IDS.tenant1,  recipient_type: "tenant", body: "Thank you Grace. Please use Paybill 522522, Account Number: A3. Receipt will be sent automatically once payment is received.", is_read: false, created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
    { manager_id: IDS.manager, tenant_id: IDS.ten2, sender_id: IDS.manager,  sender_role: "manager", recipient_id: IDS.tenant2,  recipient_type: "tenant", body: "Hi Brian, your April 2026 invoice of KES 35,000 has been generated and is due by 1st May. Thank you for always paying on time!", is_read: true, created_at: new Date(Date.now() - 1 * 864e5).toISOString() },
  ], { onConflict: "id" });
  log.push("✓ Messages (4)");

  // ── In-app notifications ──────────────────────────────────────────
  // in_app_notifications uses user_id (the auth user) not tenant row id
  await supabase.from("in_app_notifications").upsert([
    { user_id: IDS.tenant1,  manager_id: IDS.manager, type: "alert",   title: "⚠️ March rent overdue",      body: "Your March 2026 rent of KES 8,500 is overdue. Please pay immediately to avoid late fees.", is_read: false, action_url: "/portal", priority: "urgent" },
    { user_id: IDS.tenant2,  manager_id: IDS.manager, type: "payment", title: "New invoice: April 2026",    body: "Your April rent invoice of KES 35,000 has been generated. Due: 1st May 2026.",               is_read: true,  action_url: "/portal", priority: "normal" },
    { user_id: IDS.tenant1,  manager_id: IDS.manager, type: "maintenance", title: "Maintenance request update", body: "Your request 'Leaking kitchen tap' has been received. Our plumber will visit within 48hrs.", is_read: false, action_url: "/portal/maintenance", priority: "normal" },
  ], { onConflict: "id" });
  log.push("✓ Notifications (3)");

  // ── Service provider ──────────────────────────────────────────────
  await supabase.from("service_providers").upsert([
    { id: IDS.provider_row, user_id: IDS.provider, business_name: "Kamau Electrical Services", contact_name: "Joseph Kamau", phone: "0722123456", whatsapp: "0722123456", email: "kamau.electrical@gmail.com", county: "Nairobi", town: "Westlands", is_verified: true, rating_avg: 4.7, rating_count: 23, jobs_completed: 47, is_available: true, response_time_hrs: 4, bio: "Licensed electrician with 12 years experience. Specialise in residential wiring, solar and fault-finding. Available 7 days a week.", added_by_role: "self", status: "active" },
  ], { onConflict: "id" });

  await supabase.from("provider_services").upsert([
    { provider_id: IDS.provider_row, category_key: "electrical_general", rate_type: "per_job",    rate_min: 500,  rate_max: 3000, rate_notes: "Callout fee KES 500 + labour. Materials extra." },
    { provider_id: IDS.provider_row, category_key: "electrical_solar",   rate_type: "quote_only", rate_min: null, rate_max: null, rate_notes: "Site visit required before quoting." },
    { provider_id: IDS.provider_row, category_key: "electrical_cctv",    rate_type: "per_job",    rate_min: 8000, rate_max: 25000, rate_notes: "Includes basic 4-camera CCTV system installation." },
  ], { onConflict: "provider_id,category_key" });
  log.push("✓ Service provider (Kamau Electrical)");

  // ── Orphan tenant data (Amina) ────────────────────────────────────
  await supabase.from("orphan_tenant_records").upsert([
    { user_id: IDS.tenant3, property_name: "Ngara Apartments", unit_label: "Room 12", landlord_name: "Mr. Abdullah Omar", landlord_phone: "0711987654", county: "Nairobi", move_in_date: "2025-07-01", monthly_rent: 11000 },
  ], { onConflict: "user_id" });

  await supabase.from("orphan_payment_entries").upsert([
    { user_id: IDS.tenant3, payment_date: twoMonths, amount: 11000, payment_method: "mpesa",  reference: "PLA2F5K9XZ", description: "February 2026 rent" },
    { user_id: IDS.tenant3, payment_date: lastMonth, amount: 11000, payment_method: "mpesa",  reference: "QNB8G7M1RW", description: "March 2026 rent" },
    { user_id: IDS.tenant3, payment_date: today,     amount: 11000, payment_method: "cash",   reference: null,         description: "April 2026 rent — cash to caretaker" },
  ], { onConflict: "id" });
  log.push("✓ Orphan tenant data (Amina Hassan — 3 self-logged payments)");

  // ── M-Pesa settings ───────────────────────────────────────────────
  await supabase.from("mpesa_settings").upsert([
    { manager_id: IDS.manager, paybill_enabled: true, paybill_shortcode: "522522", paybill_account_reference: "RENT", till_enabled: false },
  ], { onConflict: "manager_id" });
  log.push("✓ M-Pesa settings (Paybill 522522)");

  // ── Platform invoice ──────────────────────────────────────────────
  await supabase.from("manager_invoices").upsert([
    { manager_user_id: IDS.manager, invoice_number: "PLAT-DEMO-2026-04", amount: 1800, status: "pending", due_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), invoice_type: "subscription", description: "Monthly platform fee — 3 properties × KES 600 (Pro tier)", property_count: 3, rate_per_property: 600 },
  ], { onConflict: "invoice_number" });
  log.push("✓ Platform subscription invoice (KES 1,800 pending)");

  return log;
}
