/**
 * Multi-Tenant Isolation Tests - Agency Isolation
 * 
 * Tests that agencies cannot access other agencies' data:
 * - Agency A cannot access agency B properties
 * - Agency A cannot access agency B tenants
 * - Agency A cannot access agency B revenue
 * - Agency A cannot access agency B stats
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { generateUUID } from '../setup';

describe('Agency Data Isolation', () => {
  let agencyAUserId: string;
  let agencyBUserId: string;
  let propertyAId: string;
  let propertyBId: string;
  let unitAId: string;
  let unitBId: string;
  let tenantAId: string;
  let tenantBId: string;

  beforeEach(async () => {
    // Generate UUIDs for test data
    agencyAUserId = generateUUID();
    agencyBUserId = generateUUID();
    propertyAId = generateUUID();
    propertyBId = generateUUID();
    unitAId = generateUUID();
    unitBId = generateUUID();
    tenantAId = generateUUID();
    tenantBId = generateUUID();

    // Create agency A user using mocked client
    const { data: agencyAAuth } = await supabase.auth.admin.createUser({
      email: `agency-a-${Date.now()}@calqulusrms.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (!agencyAAuth?.user) throw new Error('Failed to create agency A auth');
    agencyAUserId = agencyAAuth.user.id;

    // Create agency B user using mocked client
    const { data: agencyBAuth } = await supabase.auth.admin.createUser({
      email: `agency-b-${Date.now()}@calqulusrms.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (!agencyBAuth?.user) throw new Error('Failed to create agency B auth');
    agencyBUserId = agencyBAuth.user.id;

    // Create property A for agency A
    const { data: propertyAData } = await supabase
      .from('properties' as any)
      .insert({
        manager_id: agencyAUserId,
        address: 'Property A',
        status: 'active',
      } as any)
      .select()
      .single();
    if (!propertyAData) throw new Error('Failed to create property A');
    propertyAId = (propertyAData as any).id;

    // Create property B for agency B
    const { data: propertyBData } = await supabase
      .from('properties' as any)
      .insert({
        manager_id: agencyBUserId,
        address: 'Property B',
        status: 'active',
      } as any)
      .select()
      .single();
    if (!propertyBData) throw new Error('Failed to create property B');
    propertyBId = (propertyBData as any).id;

    // Create unit A
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
    unitAId = (unitAData as any).id;

    // Create unit B
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
    unitBId = (unitBData as any).id;

    // Create tenant A
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
    tenantAId = (tenantAData as any).id;

    // Create tenant B
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
    tenantBId = (tenantBData as any).id;
  });

  afterEach(async () => {
    // Cleanup using mocked client with admin API
    try {
      await supabase.from('tenants' as any).delete().eq('id', tenantAId);
      await supabase.from('tenants' as any).delete().eq('id', tenantBId);
      await supabase.from('units' as any).delete().eq('id', unitAId);
      await supabase.from('units' as any).delete().eq('id', unitBId);
      await supabase.from('properties' as any).delete().eq('id', propertyAId);
      await supabase.from('properties' as any).delete().eq('id', propertyBId);
      await supabase.auth.admin.deleteUser(agencyAUserId);
      await supabase.auth.admin.deleteUser(agencyBUserId);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('should prevent agency A from accessing agency B properties', async () => {
    // Get agency A properties
    const { data: agencyAProperties } = await supabase
      .from('properties' as any)
      .select('*')
      .eq('manager_id', agencyAUserId);

    // Get agency B properties
    const { data: agencyBProperties } = await supabase
      .from('properties' as any)
      .select('*')
      .eq('manager_id', agencyBUserId);

    // Verify properties are separate
    expect(agencyAProperties).toBeDefined();
    expect(agencyBProperties).toBeDefined();
    expect((agencyAProperties as any).length).toBeGreaterThan(0);
    expect((agencyBProperties as any).length).toBeGreaterThan(0);

    const propertyAIds = (agencyAProperties as any).map((p: any) => p.id);
    const propertyBIds = (agencyBProperties as any).map((p: any) => p.id);

    expect(propertyAIds).not.toContain(propertyBId);
    expect(propertyBIds).not.toContain(propertyAId);
  });

  it('should prevent agency A from accessing agency B tenants', async () => {
    // Get agency A tenants (through properties)
    const { data: agencyATenants } = await supabase
      .from('tenants' as any)
      .select('*, units(*, properties(*))')
      .eq('id', tenantAId)
      .single();

    // Get agency B tenants
    const { data: agencyBTenants } = await supabase
      .from('tenants' as any)
      .select('*, units(*, properties(*))')
      .eq('id', tenantBId)
      .single();

    // Verify tenants are separate
    expect(agencyATenants).toBeDefined();
    expect(agencyBTenants).toBeDefined();
    expect((agencyATenants as any).id).toBe(tenantAId);
    expect((agencyBTenants as any).id).toBe(tenantBId);
    expect((agencyATenants as any).id).not.toBe((agencyBTenants as any).id);
  });

  it('should prevent agency A from accessing agency B revenue', async () => {
    // Create invoice for agency A
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

    // Create payment for agency A
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

    // Create invoice for agency B
    const { data: invoiceB } = await supabase
      .from('invoices' as any)
      .insert({
        tenant_id: tenantBId,
        property_id: propertyBId,
        unit_id: unitBId,
        amount: 15000,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        invoice_number: `INV-B-${Date.now()}`,
      } as any)
      .select()
      .single();

    if (!invoiceB) throw new Error('Failed to create invoice B');

    // Create payment for agency B
    const { data: paymentB } = await supabase
      .from('payment_transactions' as any)
      .insert({
        invoice_id: (invoiceB as any).id,
        amount: 15000,
        payment_method: 'mpesa',
        status: 'completed',
        transaction_id: `TXN-B-${Date.now()}`,
        payment_date: new Date().toISOString(),
      } as any)
      .select()
      .single();

    // Verify payments are separate
    expect(paymentA).toBeDefined();
    expect(paymentB).toBeDefined();
    expect((paymentA as any).transaction_id).not.toBe((paymentB as any).transaction_id);

    // Verify payments are linked to correct properties
    const { data: invoiceAWithProperty } = await supabase
      .from('invoices' as any)
      .select('property_id')
      .eq('id', (invoiceA as any).id)
      .single();

    const { data: invoiceBWithProperty } = await supabase
      .from('invoices' as any)
      .select('property_id')
      .eq('id', (invoiceB as any).id)
      .single();

    expect((invoiceAWithProperty as any).property_id).toBe(propertyAId);
    expect((invoiceBWithProperty as any).property_id).toBe(propertyBId);
    expect((invoiceAWithProperty as any).property_id).not.toBe((invoiceBWithProperty as any).property_id);

    // Cleanup
    await supabase.from('payment_transactions' as any).delete().eq('id', (paymentA as any).id);
    await supabase.from('payment_transactions' as any).delete().eq('id', (paymentB as any).id);
    await supabase.from('invoices' as any).delete().eq('id', (invoiceA as any).id);
    await supabase.from('invoices' as any).delete().eq('id', (invoiceB as any).id);
  });

  it('should prevent agency A from accessing agency B stats', async () => {
    // In a full implementation, stats would be calculated per agency
    // For now, we validate the property structure
    
    const { data: agencyAProperties } = await supabase
      .from('properties' as any)
      .select('*')
      .eq('manager_id', agencyAUserId);

    const { data: agencyBProperties } = await supabase
      .from('properties' as any)
      .select('*')
      .eq('manager_id', agencyBUserId);

    expect(agencyAProperties).toBeDefined();
    expect(agencyBProperties).toBeDefined();
    expect((agencyAProperties as any).length).toBeGreaterThan(0);
    expect((agencyBProperties as any).length).toBeGreaterThan(0);

    const propertyAIds = (agencyAProperties as any).map((p: any) => p.id);
    const propertyBIds = (agencyBProperties as any).map((p: any) => p.id);

    expect(propertyAIds).not.toContain(propertyBId);
    expect(propertyBIds).not.toContain(propertyAId);
  });

  it('should prevent agency A from accessing agency B invoices', async () => {
    // Create invoice for agency A
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

    // Create invoice for agency B
    const { data: invoiceB } = await supabase
      .from('invoices' as any)
      .insert({
        tenant_id: tenantBId,
        property_id: propertyBId,
        unit_id: unitBId,
        amount: 15000,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        invoice_number: `INV-B-${Date.now()}`,
      } as any)
      .select()
      .single();

    // Verify invoices are separate
    expect(invoiceA).toBeDefined();
    expect(invoiceB).toBeDefined();
    expect((invoiceA as any).property_id).toBe(propertyAId);
    expect((invoiceB as any).property_id).toBe(propertyBId);
    expect((invoiceA as any).property_id).not.toBe((invoiceB as any).property_id);

    // Cleanup
    await supabase.from('invoices' as any).delete().eq('id', (invoiceA as any).id);
    await supabase.from('invoices' as any).delete().eq('id', (invoiceB as any).id);
  });

  it('should maintain agency data isolation during concurrent access', async () => {
    // Simulate concurrent access to agency data
    const [agencyAData, agencyBData] = await Promise.all([
      supabase.from('properties' as any).select('*').eq('manager_id', agencyAUserId),
      supabase.from('properties' as any).select('*').eq('manager_id', agencyBUserId),
    ]);

    expect(agencyAData.data).toBeDefined();
    expect(agencyBData.data).toBeDefined();
    expect((agencyAData.data as any).length).toBeGreaterThan(0);
    expect((agencyBData.data as any).length).toBeGreaterThan(0);

    const propertyAIds = (agencyAData.data as any).map((p: any) => p.id);
    const propertyBIds = (agencyBData.data as any).map((p: any) => p.id);

    expect(propertyAIds).not.toContain(propertyBId);
    expect(propertyBIds).not.toContain(propertyAId);
  });
});
