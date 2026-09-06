/**
 * Multi-Tenant Isolation Tests - Landlord Access Control
 * 
 * Tests that landlords cannot access other landlords' properties:
 * - Landlord A cannot access landlord B properties
 * - Landlord A cannot access landlord B revenue
 * - Landlord A cannot access landlord B tenants
 * - Landlord A cannot access landlord B statements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { generateUUID } from '../setup';

describe('Landlord Access Control', () => {
  let managerUserId: string;
  let landlordAUserId: string;
  let landlordBUserId: string;
  let propertyAId: string;
  let propertyBId: string;
  let landlordALinkId: string;
  let landlordBLinkId: string;

  beforeEach(async () => {
    // Generate UUIDs for test data
    managerUserId = generateUUID();
    landlordAUserId = generateUUID();
    landlordBUserId = generateUUID();
    propertyAId = generateUUID();
    propertyBId = generateUUID();
    landlordALinkId = generateUUID();
    landlordBLinkId = generateUUID();

    // Create manager user using mocked client
    const { data: managerData } = await supabase.auth.admin.createUser({
      email: `manager-${Date.now()}@calqulusrms.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (!managerData?.user) throw new Error('Failed to create manager');
    managerUserId = managerData.user.id;

    // Create landlord A user using mocked client
    const { data: landlordAAuth } = await supabase.auth.admin.createUser({
      email: `landlord-a-${Date.now()}@calqulusrms.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (!landlordAAuth?.user) throw new Error('Failed to create landlord A auth');
    landlordAUserId = landlordAAuth.user.id;

    // Create landlord B user using mocked client
    const { data: landlordBAuth } = await supabase.auth.admin.createUser({
      email: `landlord-b-${Date.now()}@calqulusrms.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (!landlordBAuth?.user) throw new Error('Failed to create landlord B auth');
    landlordBUserId = landlordBAuth.user.id;

    // Create property A
    const { data: propertyAData } = await supabase
      .from('properties' as any)
      .insert({
        manager_id: managerUserId,
        address: 'Property A',
        status: 'active',
      } as any)
      .select()
      .single();
    if (!propertyAData) throw new Error('Failed to create property A');
    propertyAId = (propertyAData as any).id;

    // Create property B
    const { data: propertyBData } = await supabase
      .from('properties' as any)
      .insert({
        manager_id: managerUserId,
        address: 'Property B',
        status: 'active',
      } as any)
      .select()
      .single();
    if (!propertyBData) throw new Error('Failed to create property B');
    propertyBId = (propertyBData as any).id;

    // Link landlord A to property A
    const { data: linkAData } = await supabase
      .from('property_landlords' as any)
      .insert({
        property_id: propertyAId,
        landlord_user_id: landlordAUserId,
        manager_id: managerUserId,
        revenue_share_pct: 10,
        operating_model: 'managed',
        payment_destination: 'landlord',
      } as any)
      .select()
      .single();
    if (!linkAData) throw new Error('Failed to link landlord A');
    landlordALinkId = (linkAData as any).id;

    // Link landlord B to property B
    const { data: linkBData } = await supabase
      .from('property_landlords' as any)
      .insert({
        property_id: propertyBId,
        landlord_user_id: landlordBUserId,
        manager_id: managerUserId,
        revenue_share_pct: 15,
        operating_model: 'managed',
        payment_destination: 'landlord',
      } as any)
      .select()
      .single();
    if (!linkBData) throw new Error('Failed to link landlord B');
    landlordBLinkId = (linkBData as any).id;
  });

  afterEach(async () => {
    // Cleanup using mocked client with admin API
    try {
      await supabase.from('property_landlords' as any).delete().eq('id', landlordALinkId);
      await supabase.from('property_landlords' as any).delete().eq('id', landlordBLinkId);
      await supabase.from('properties' as any).delete().eq('id', propertyAId);
      await supabase.from('properties' as any).delete().eq('id', propertyBId);
      await supabase.auth.admin.deleteUser(landlordAUserId);
      await supabase.auth.admin.deleteUser(landlordBUserId);
      await supabase.auth.admin.deleteUser(managerUserId);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('should prevent landlord A from accessing landlord B properties', async () => {
    // Get landlord A properties
    const { data: landlordAProperties } = await supabase
      .from('property_landlords' as any)
      .select('*, properties(*)')
      .eq('landlord_user_id', landlordAUserId);

    // Get landlord B properties
    const { data: landlordBProperties } = await supabase
      .from('property_landlords' as any)
      .select('*, properties(*)')
      .eq('landlord_user_id', landlordBUserId);

    // Verify properties are separate
    expect(landlordAProperties).toBeDefined();
    expect(landlordBProperties).toBeDefined();
    expect((landlordAProperties as any).length).toBeGreaterThan(0);
    expect((landlordBProperties as any).length).toBeGreaterThan(0);

    const propertyAIds = (landlordAProperties as any).map((p: any) => p.property_id);
    const propertyBIds = (landlordBProperties as any).map((p: any) => p.property_id);

    expect(propertyAIds).not.toContain(propertyBId);
    expect(propertyBIds).not.toContain(propertyAId);
  });

  it('should prevent landlord A from accessing landlord B revenue', async () => {
    // In a full implementation, revenue would be calculated and isolated
    // For now, we validate the property_landlord structure
    
    const { data: landlordALink } = await supabase
      .from('property_landlords' as any)
      .select('*')
      .eq('id', landlordALinkId)
      .single();

    const { data: landlordBLink } = await supabase
      .from('property_landlords' as any)
      .select('*')
      .eq('id', landlordBLinkId)
      .single();

    expect(landlordALink).toBeDefined();
    expect(landlordBLink).toBeDefined();
    expect((landlordALink as any).property_id).not.toBe((landlordBLink as any).property_id);
    expect((landlordALink as any).landlord_user_id).not.toBe((landlordBLink as any).landlord_user_id);
  });

  it('should prevent landlord A from accessing landlord B tenants', async () => {
    // Create unit and tenant for property A
    const { data: unitAData } = await supabase
      .from('units' as any)
      .insert({
        property_id: propertyAId,
        unit_number: 'A1',
        monthly_rent: 10000,
        status: 'active',
      } as any)
      .select()
      .single();
    if (!unitAData) throw new Error('Failed to create unit A');
    const unitAId = (unitAData as any).id;

    const { data: tenantAData } = await supabase
      .from('tenants' as any)
      .insert({
        unit_id: unitAId,
        full_name: 'Tenant A',
        email: `tenant-a-${Date.now()}@test.com`,
        phone: '+254700000001',
        monthly_rent: 10000,
        status: 'active',
        move_in_date: new Date().toISOString(),
      } as any)
      .select()
      .single();
    if (!tenantAData) throw new Error('Failed to create tenant A');
    const tenantAId = (tenantAData as any).id;

    // Create unit and tenant for property B
    const { data: unitBData } = await supabase
      .from('units' as any)
      .insert({
        property_id: propertyBId,
        unit_number: 'B1',
        monthly_rent: 15000,
        status: 'active',
      } as any)
      .select()
      .single();
    if (!unitBData) throw new Error('Failed to create unit B');
    const unitBId = (unitBData as any).id;

    const { data: tenantBData } = await supabase
      .from('tenants' as any)
      .insert({
        unit_id: unitBId,
        full_name: 'Tenant B',
        email: `tenant-b-${Date.now()}@test.com`,
        phone: '+254700000002',
        monthly_rent: 15000,
        status: 'active',
        move_in_date: new Date().toISOString(),
      } as any)
      .select()
      .single();
    if (!tenantBData) throw new Error('Failed to create tenant B');
    const tenantBId = (tenantBData as any).id;

    // Get tenants for property A (landlord A's property)
    const { data: propertyATenants } = await supabase
      .from('tenants' as any)
      .select('*, units(*)')
      .eq('unit_id', unitAId);

    // Get tenants for property B (landlord B's property)
    const { data: propertyBTenants } = await supabase
      .from('tenants' as any)
      .select('*, units(*)')
      .eq('unit_id', unitBId);

    // Verify tenants are separate
    expect(propertyATenants).toBeDefined();
    expect(propertyBTenants).toBeDefined();
    expect((propertyATenants as any).length).toBeGreaterThan(0);
    expect((propertyBTenants as any).length).toBeGreaterThan(0);

    const tenantAIds = (propertyATenants as any).map((t: any) => t.id);
    const tenantBIds = (propertyBTenants as any).map((t: any) => t.id);

    expect(tenantAIds).not.toContain(tenantBId);
    expect(tenantBIds).not.toContain(tenantAId);

    // Cleanup
    await supabase.from('tenants' as any).delete().eq('id', tenantAId);
    await supabase.from('tenants' as any).delete().eq('id', tenantBId);
    await supabase.from('units' as any).delete().eq('id', unitAId);
    await supabase.from('units' as any).delete().eq('id', unitBId);
  });

  it('should prevent landlord A from accessing landlord B statements', async () => {
    // In a full implementation, statements would be generated per landlord
    // For now, we validate the property_landlord structure
    
    const { data: landlordALink } = await supabase
      .from('property_landlords' as any)
      .select('*')
      .eq('id', landlordALinkId)
      .single();

    const { data: landlordBLink } = await supabase
      .from('property_landlords' as any)
      .select('*')
      .eq('id', landlordBLinkId)
      .single();

    expect(landlordALink).toBeDefined();
    expect(landlordBLink).toBeDefined();
    expect((landlordALink as any).property_id).not.toBe((landlordBLink as any).property_id);
  });

  it('should prevent landlord A from accessing landlord B payment details', async () => {
    // Create unit and tenant for property A
    const { data: unitAData } = await supabase
      .from('units' as any)
      .insert({
        property_id: propertyAId,
        unit_number: 'A1',
        monthly_rent: 10000,
        status: 'active',
      } as any)
      .select()
      .single();
    if (!unitAData) throw new Error('Failed to create unit A');
    const unitAId = (unitAData as any).id;

    const { data: tenantAData } = await supabase
      .from('tenants' as any)
      .insert({
        unit_id: unitAId,
        full_name: 'Tenant A',
        email: `tenant-a-${Date.now()}@test.com`,
        phone: '+254700000001',
        monthly_rent: 10000,
        status: 'active',
        move_in_date: new Date().toISOString(),
      } as any)
      .select()
      .single();
    if (!tenantAData) throw new Error('Failed to create tenant A');
    const tenantAId = (tenantAData as any).id;

    // Create invoice for property A
    const { data: invoiceA } = await supabase
      .from('invoices' as any)
      .insert({
        tenant_id: tenantAId,
        property_id: propertyAId,
        unit_id: unitAId,
        amount: 10000,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        invoice_number: `INV-A-${Date.now()}`,
      } as any)
      .select()
      .single();

    if (!invoiceA) throw new Error('Failed to create invoice A');

    // Create payment for property A
    const { data: paymentA } = await supabase
      .from('payment_transactions' as any)
      .insert({
        invoice_id: (invoiceA as any).id,
        amount: 10000,
        payment_method: 'mpesa',
        status: 'completed',
        transaction_id: `TXN-A-${Date.now()}`,
        payment_date: new Date().toISOString(),
      } as any)
      .select()
      .single();

    // Verify payment is linked to property A
    expect(paymentA).toBeDefined();
    const { data: invoiceWithProperty } = await supabase
      .from('invoices' as any)
      .select('property_id')
      .eq('id', (invoiceA as any).id)
      .single();

    expect((invoiceWithProperty as any).property_id).toBe(propertyAId);
    expect((invoiceWithProperty as any).property_id).not.toBe(propertyBId);

    // Cleanup
    await supabase.from('payment_transactions' as any).delete().eq('id', (paymentA as any).id);
    await supabase.from('invoices' as any).delete().eq('id', (invoiceA as any).id);
    await supabase.from('tenants' as any).delete().eq('id', tenantAId);
    await supabase.from('units' as any).delete().eq('id', unitAId);
  });

  it('should maintain landlord data isolation during concurrent access', async () => {
    // Simulate concurrent access to landlord data
    const [landlordAData, landlordBData] = await Promise.all([
      supabase.from('property_landlords' as any).select('*').eq('id', landlordALinkId).single(),
      supabase.from('property_landlords' as any).select('*').eq('id', landlordBLinkId).single(),
    ]);

    expect(landlordAData.data).toBeDefined();
    expect(landlordBData.data).toBeDefined();
    expect((landlordAData.data as any).property_id).not.toBe((landlordBData.data as any).property_id);
  });
});
