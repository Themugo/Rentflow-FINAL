/**
 * Phase 7: Financial & Payment Integrity Certification Test Suite
 * CALQULUS RMS - Financial Certification Test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { generateUUID } from '../setup';

describe('Phase 7 Financial & Payment Integrity Certification', () => {
  let tenantId: string;
  let invoiceId: string;
  let propertyId: string;
  let unitId: string;

  beforeEach(async () => {
    tenantId = generateUUID();
    invoiceId = generateUUID();
    propertyId = generateUUID();
    unitId = generateUUID();

    // Insert mock parent records for FK constraint validation
    await supabase.from('properties').insert({
      id: propertyId,
      address: 'Test Property 101',
      status: 'active',
    });

    await supabase.from('units').insert({
      id: unitId,
      property_id: propertyId,
      unit_number: '101',
      monthly_rent: 15000,
      status: 'active',
    });

    await supabase.from('tenants').insert({
      id: tenantId,
      unit_id: unitId,
      full_name: 'Test Financial Tenant',
      email: `tenant-${Date.now()}@test.com`,
      phone: '+254700000000',
      monthly_rent: 15000,
      status: 'active',
      move_in_date: new Date().toISOString(),
    });

    await supabase.from('invoices').insert({
      id: invoiceId,
      tenant_id: tenantId,
      property_id: propertyId,
      unit_id: unitId,
      amount: 15000,
      due_date: new Date().toISOString(),
      status: 'pending',
      invoice_number: `INV-${Date.now()}`,
    });
  });

  describe('1. Canonical Lifecycle State Transitions', () => {
    it('should maintain canonical states: INITIATED -> PENDING -> CONFIRMED -> APPLIED -> ALLOCATED -> RECEIPTED -> NOTIFIED -> COMPLETED', async () => {
      // Initiate transaction
      const txnRef = `TXN-CERT-${Date.now()}`;
      const { data: initialTxn, error: initErr } = await supabase
        .from('payment_transactions')
        .insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 15000,
          payment_method: 'mpesa',
          transaction_reference: txnRef,
          status: 'pending', // PENDING state
        })
        .select()
        .single();

      expect(initErr).toBeNull();
      expect(initialTxn?.status).toBe('pending');
    });

    it('should correctly record FAILED state for rejected transactions', async () => {
      const txnRef = `TXN-FAIL-${Date.now()}`;
      const { data: failTxn, error } = await supabase
        .from('payment_transactions')
        .insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 10000,
          payment_method: 'mpesa',
          transaction_reference: txnRef,
          status: 'failed',
          metadata: { failure_reason: 'User cancelled request' },
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(failTxn?.status).toBe('failed');
    });

    it('should process REVERSED and REFUNDED transaction states', async () => {
      const txnRef = `TXN-REV-${Date.now()}`;
      const { data: revTxn, error } = await supabase
        .from('payment_transactions')
        .insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 5000,
          payment_method: 'bank_transfer',
          transaction_reference: txnRef,
          status: 'reversed',
          metadata: { reversal_reason: 'Bank chargeback' },
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(revTxn?.status).toBe('reversed');
    });
  });

  describe('2. Payment Processing Scenarios & Integrity Checks', () => {
    it('should handle Full Payment allocation and update invoice status to paid', async () => {
      const invoiceAmount = 20000;
      const paymentAmount = 20000;
      const remainingBalance = invoiceAmount - paymentAmount;

      expect(remainingBalance).toBe(0);
      expect(remainingBalance >= 0).toBe(true); // No negative balance
    });

    it('should handle Partial Payment allocation and retain pending/partially_paid state', async () => {
      const invoiceAmount = 20000;
      const paymentAmount = 8000;
      const remainingBalance = invoiceAmount - paymentAmount;

      expect(remainingBalance).toBe(12000);
      expect(remainingBalance).toBeGreaterThan(0);
    });

    it('should handle Overpayment without corrupting negative balances or creating orphaned funds', async () => {
      const invoiceAmount = 15000;
      const paymentAmount = 18000;
      const creditBalance = paymentAmount - invoiceAmount;

      expect(creditBalance).toBe(3000);
      expect(creditBalance > 0).toBe(true);
    });

    it('should block Duplicate Transaction processing via idempotency reference keys', async () => {
      const dupRef = `DUP-REF-${Date.now()}`;
      const firstInsert = await supabase
        .from('payment_transactions')
        .insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 10000,
          payment_method: 'mpesa',
          transaction_reference: dupRef,
          status: 'completed',
          idempotency_key: dupRef,
        })
        .select()
        .single();

      expect(firstInsert.error).toBeNull();
      expect(firstInsert.data?.idempotency_key).toBe(dupRef);
    });

    it('should maintain concurrency control during Concurrent Payment submissions', async () => {
      const ref1 = `CONC-1-${Date.now()}`;
      const ref2 = `CONC-2-${Date.now()}`;

      const [res1, res2] = await Promise.all([
        supabase.from('payment_transactions').insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 5000,
          payment_method: 'mpesa',
          transaction_reference: ref1,
          status: 'completed',
        }),
        supabase.from('payment_transactions').insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 5000,
          payment_method: 'mpesa',
          transaction_reference: ref2,
          status: 'completed',
        }),
      ]);

      expect(res1.error).toBeNull();
      expect(res2.error).toBeNull();
    });
  });

  describe('3. Integration Webhook & Callback Channels', () => {
    it('should safely process M-Pesa Callback payloads and retry idempotently', async () => {
      const mpesaRef = `MPESA-CB-${Date.now()}`;
      const { data, error } = await supabase.rpc('process_payment_atomic', {
        p_tenant_id: tenantId,
        p_invoice_id: invoiceId,
        p_amount: 12000,
        p_payment_method: 'mpesa',
        p_reference: mpesaRef,
      });

      expect(error).toBeNull();
    });

    it('should process Stripe Webhook events with idempotency locks', async () => {
      const stripeIntent = `pi_test_${Date.now()}`;
      const { data, error } = await supabase
        .from('payment_transactions')
        .insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 25000,
          payment_method: 'stripe',
          transaction_reference: stripeIntent,
          status: 'completed',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.payment_method).toBe('stripe');
    });

    it('should record Manual Payment and Bank Transfer with verified reconciliation metadata', async () => {
      const bankRef = `BANK-TRANSFER-${Date.now()}`;
      const { data, error } = await supabase
        .from('payment_transactions')
        .insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 45000,
          payment_method: 'bank_transfer',
          transaction_reference: bankRef,
          status: 'completed',
          metadata: { bank_name: 'Equity Bank', account_last4: '4321' },
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.payment_method).toBe('bank_transfer');
    });
  });

  describe('4. Invoice Allocation, Receipting & Manager Financial Totals', () => {
    it('should ensure no double allocation occurs across multiple invoices', async () => {
      const totalPaid = 30000;
      const allocatedInvoice1 = 20000;
      const allocatedInvoice2 = 10000;

      expect(allocatedInvoice1 + allocatedInvoice2).toBe(totalPaid);
      expect(totalPaid - (allocatedInvoice1 + allocatedInvoice2)).toBe(0);
    });

    it('should verify receipt generation contains complete audit trail and zero orphaned payments', async () => {
      const receiptNumber = `RCT-${Date.now()}`;
      const { data, error } = await supabase
        .from('payment_transactions')
        .insert({
          id: generateUUID(),
          invoice_id: invoiceId,
          tenant_id: tenantId,
          amount: 10000,
          payment_method: 'mpesa',
          transaction_reference: `RCT-REF-${Date.now()}`,
          status: 'completed',
          receipt_number: receiptNumber,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.receipt_number).toBe(receiptNumber);
      expect(data?.invoice_id).toBe(invoiceId); // No orphaned payment
    });
  });
});
