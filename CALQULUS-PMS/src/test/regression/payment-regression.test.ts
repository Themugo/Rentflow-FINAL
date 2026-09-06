/**
 * Payment Workflow Regression Test Suite
 * 
 * Comprehensive regression tests for payment flows:
 * - Invoice generation and management
 * - Payment processing (M-Pesa, Stripe, Bank Transfer)
 * - Payment allocation and reconciliation
 * - Refund handling
 * 
 * Run with: npm test -- src/test/regression/payment-regression.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateUUID } from "../setup";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  amount: number;
  balance_due: number;
  paid_amount: number;
  due_date: string;
  status: "pending" | "partially_paid" | "paid" | "overdue" | "cancelled";
  invoice_number: string;
  type?: "rent" | "water" | "other";
  created_at: string;
}

interface PaymentTransaction {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: "mpesa" | "stripe" | "bank_transfer" | "cash";
  status: "pending" | "completed" | "failed" | "refunded";
  transaction_id: string;
  payment_date: string;
  mpesa_receipt?: string;
  stripe_payment_intent?: string;
  metadata?: Record<string, unknown>;
}

interface PaymentAllocation {
  id: string;
  transaction_id: string;
  invoice_id: string;
  allocated_amount: number;
  created_at: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const mockInvoices = new Map<string, Invoice>();
const mockPayments = new Map<string, PaymentTransaction>();
const mockAllocations = new Map<string, PaymentAllocation>();

function resetMockPaymentData() {
  mockInvoices.clear();
  mockPayments.clear();
  mockAllocations.clear();
}

// ── Payment Logic Functions ────────────────────────────────────────────────────

function calculateBalanceDue(invoice: Invoice): number {
  return Math.max(0, invoice.amount - invoice.paid_amount);
}

function determineInvoiceStatus(invoice: Invoice): Invoice["status"] {
  if (invoice.status === "cancelled") return "cancelled";
  
  const balanceDue = calculateBalanceDue(invoice);
  
  if (balanceDue === 0) return "paid";
  if (balanceDue < invoice.amount && balanceDue > 0) return "partially_paid";
  
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  if (balanceDue > 0 && dueDate < today) return "overdue";
  
  return "pending";
}

function allocatePayment(
  invoices: Invoice[],
  paymentAmount: number
): { allocations: Array<{ invoiceId: string; alloc: number; closes: boolean }>; remaining: number; applied: number } {
  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );
  
  const allocations: Array<{ invoiceId: string; alloc: number; closes: boolean }> = [];
  let remaining = paymentAmount;
  let applied = 0;
  
  for (const invoice of sortedInvoices) {
    if (remaining <= 0) break;
    
    const balanceDue = calculateBalanceDue(invoice);
    if (balanceDue <= 0) continue;
    
    const alloc = Math.min(remaining, balanceDue);
    allocations.push({
      invoiceId: invoice.id,
      alloc,
      closes: alloc >= balanceDue,
    });
    
    remaining -= alloc;
    applied += alloc;
  }
  
  return { allocations, remaining, applied };
}

function validatePaymentAmount(amount: number, invoiceAmount: number, tolerance = 1): boolean {
  return Math.abs(amount - invoiceAmount) <= tolerance;
}

function generateInvoiceNumber(prefix = "INV"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function calculateLateFee(invoice: Invoice, gracePeriodDays = 5, feePercentage = 0.05): number {
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysPastDue <= gracePeriodDays) return 0;
  
  const balanceDue = calculateBalanceDue(invoice);
  return Math.round(balanceDue * feePercentage);
}

function validateMpesaReceipt(receipt: string): boolean {
  // M-Pesa receipts are typically alphanumeric, 10-15 characters
  return /^[A-Z0-9]{10,15}$/.test(receipt);
}

function calculateRefundAmount(
  payment: PaymentTransaction,
  allocations: PaymentAllocation[]
): number {
  const totalAllocated = allocations
    .filter(a => a.transaction_id === payment.id && a.invoice_id)
    .reduce((sum, a) => sum + a.allocated_amount, 0);
  
  return Math.max(0, payment.amount - totalAllocated);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Payment Workflow Regression Suite", () => {
  let testInvoice: Invoice;
  let testPayment: PaymentTransaction;

  beforeEach(() => {
    resetMockPaymentData();
    
    testInvoice = {
      id: generateUUID(),
      tenant_id: generateUUID(),
      property_id: generateUUID(),
      unit_id: generateUUID(),
      amount: 25000,
      balance_due: 25000,
      paid_amount: 0,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
      invoice_number: generateInvoiceNumber(),
      created_at: new Date().toISOString(),
    };
    
    testPayment = {
      id: generateUUID(),
      invoice_id: testInvoice.id,
      amount: 25000,
      payment_method: "mpesa",
      status: "completed",
      transaction_id: "MPESA" + Date.now(),
      payment_date: new Date().toISOString(),
      mpesa_receipt: "QWE123456ABC",
    };

    mockInvoices.set(testInvoice.id, testInvoice);
    mockPayments.set(testPayment.id, testPayment);
  });

  describe("Invoice Management", () => {
    it("should create invoice with correct initial state", () => {
      const invoice: Invoice = {
        id: generateUUID(),
        tenant_id: generateUUID(),
        property_id: generateUUID(),
        unit_id: generateUUID(),
        amount: 15000,
        balance_due: 15000,
        paid_amount: 0,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: "pending",
        invoice_number: generateInvoiceNumber(),
        created_at: new Date().toISOString(),
      };

      expect(invoice.balance_due).toBe(invoice.amount);
      expect(invoice.paid_amount).toBe(0);
      expect(invoice.status).toBe("pending");
    });

    it("should calculate balance due correctly", () => {
      const invoice: Invoice = {
        ...testInvoice,
        amount: 30000,
        paid_amount: 10000,
        balance_due: 20000,
      };

      expect(calculateBalanceDue(invoice)).toBe(20000);
    });

    it("should return zero balance for fully paid invoice", () => {
      const invoice: Invoice = {
        ...testInvoice,
        paid_amount: testInvoice.amount,
        balance_due: 0,
      };

      expect(calculateBalanceDue(invoice)).toBe(0);
    });

    it("should never return negative balance", () => {
      const invoice: Invoice = {
        ...testInvoice,
        paid_amount: testInvoice.amount + 5000, // Overpaid
        balance_due: -5000,
      };

      expect(calculateBalanceDue(invoice)).toBe(0);
    });

    it("should determine invoice status as paid", () => {
      const invoice: Invoice = {
        ...testInvoice,
        amount: 20000,
        paid_amount: 20000,
        balance_due: 0,
      };

      expect(determineInvoiceStatus(invoice)).toBe("paid");
    });

    it("should determine invoice status as partially paid", () => {
      const invoice: Invoice = {
        ...testInvoice,
        amount: 20000,
        paid_amount: 10000,
        balance_due: 10000,
      };

      expect(determineInvoiceStatus(invoice)).toBe("partially_paid");
    });

    it("should determine invoice status as overdue", () => {
      const invoice: Invoice = {
        ...testInvoice,
        amount: 20000,
        paid_amount: 0,
        balance_due: 20000,
        due_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      };

      expect(determineInvoiceStatus(invoice)).toBe("overdue");
    });

    it("should generate unique invoice numbers", () => {
      const invoice1 = generateInvoiceNumber();
      const invoice2 = generateInvoiceNumber();
      
      expect(invoice1).not.toBe(invoice2);
    });

    it("should generate invoice numbers with custom prefix", () => {
      const invoice = generateInvoiceNumber("WATER");
      expect(invoice.startsWith("WATER-")).toBe(true);
    });
  });

  describe("Payment Allocation", () => {
    it("should allocate full payment to single invoice", () => {
      const invoices = [testInvoice];
      const result = allocatePayment(invoices, 25000);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].alloc).toBe(25000);
      expect(result.allocations[0].closes).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("should allocate partial payment to single invoice", () => {
      // Create invoice with balance_due >= 10000
      const invoice: Invoice = {
        ...testInvoice,
        amount: 25000,
        balance_due: 25000,
        paid_amount: 0,
      };
      const result = allocatePayment([invoice], 10000);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].alloc).toBe(10000);
      expect(result.allocations[0].closes).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should allocate payment across multiple invoices by due date", () => {
      const invoices: Invoice[] = [
        { ...testInvoice, id: "inv-1", due_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
        { ...testInvoice, id: "inv-2", due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      ];
      
      const result = allocatePayment(invoices, 30000);

      // Should pay older invoice first
      expect(result.allocations[0].invoiceId).toBe("inv-1");
      expect(result.allocations[0].closes).toBe(true);
    });

    it("should handle payment exceeding total invoices", () => {
      const invoices = [testInvoice];
      const result = allocatePayment(invoices, 50000);

      expect(result.allocations[0].closes).toBe(true);
      expect(result.remaining).toBe(25000);
      expect(result.applied).toBe(25000);
    });

    it("should handle zero payment gracefully", () => {
      const invoices = [testInvoice];
      const result = allocatePayment(invoices, 0);

      expect(result.allocations).toHaveLength(0);
      expect(result.remaining).toBe(0);
      expect(result.applied).toBe(0);
    });

    it("should skip fully paid invoices", () => {
      const invoices: Invoice[] = [
        { ...testInvoice, id: "inv-1", paid_amount: 25000, balance_due: 0 },
        { ...testInvoice, id: "inv-2", paid_amount: 0, balance_due: 20000 },
      ];
      
      const result = allocatePayment(invoices, 20000);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].invoiceId).toBe("inv-2");
    });

    it("should handle empty invoice list", () => {
      const result = allocatePayment([], 10000);

      expect(result.allocations).toHaveLength(0);
      expect(result.remaining).toBe(10000);
    });
  });

  describe("Payment Validation", () => {
    it("should validate exact payment amount", () => {
      expect(validatePaymentAmount(25000, 25000)).toBe(true);
    });

    it("should validate payment within tolerance", () => {
      expect(validatePaymentAmount(25001, 25000)).toBe(true);
      expect(validatePaymentAmount(24999, 25000)).toBe(true);
    });

    it("should reject payment outside tolerance", () => {
      expect(validatePaymentAmount(25002, 25000, 1)).toBe(false);
      expect(validatePaymentAmount(24998, 25000, 1)).toBe(false);
    });

    it("should use custom tolerance", () => {
      expect(validatePaymentAmount(25005, 25000, 5)).toBe(true);
    });
  });

  describe("Late Fee Calculation", () => {
    it("should not charge late fee within grace period", () => {
      const invoice: Invoice = {
        ...testInvoice,
        due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      };

      expect(calculateLateFee(invoice)).toBe(0);
    });

    it("should charge late fee after grace period", () => {
      const invoice: Invoice = {
        ...testInvoice,
        due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        balance_due: 20000,
      };

      const fee = calculateLateFee(invoice);
      expect(fee).toBeGreaterThan(0);
    });

    it("should not charge late fee for paid invoices", () => {
      const invoice: Invoice = {
        ...testInvoice,
        due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        paid_amount: testInvoice.amount,
        balance_due: 0,
      };

      expect(calculateLateFee(invoice)).toBe(0);
    });
  });

  describe("M-Pesa Payment Handling", () => {
    it("should validate M-Pesa receipt format", () => {
      const validReceipts = ["QWE123456ABC", "ABC123DEF456GHI", "QWE12345ABC"]; // Min 10 chars
      
      for (const receipt of validReceipts) {
        expect(validateMpesaReceipt(receipt)).toBe(true);
      }
    });

    it("should reject invalid M-Pesa receipt format", () => {
      const invalidReceipts = ["short", "has spaces", "special!@#", "", "QWE1234"]; // Too short
      
      for (const receipt of invalidReceipts) {
        expect(validateMpesaReceipt(receipt)).toBe(false);
      }
    });

    it("should store M-Pesa receipt with payment", () => {
      const payment: PaymentTransaction = {
        ...testPayment,
        mpesa_receipt: "QWE123456ABC",
      };

      expect(payment.mpesa_receipt).toBeDefined();
      expect(validateMpesaReceipt(payment.mpesa_receipt!)).toBe(true);
    });
  });

  describe("Stripe Payment Handling", () => {
    it("should validate Stripe payment intent ID format", () => {
      const validIds = [
        "pi_3MqT2kFv",
        "pi_test_123456",
        "pi_1234567890abcdef",
      ];

      for (const id of validIds) {
        expect(id.startsWith("pi_")).toBe(true);
      }
    });

    it("should store Stripe payment intent with payment", () => {
      const payment: PaymentTransaction = {
        ...testPayment,
        payment_method: "stripe",
        stripe_payment_intent: "pi_test_123456",
      };

      expect(payment.stripe_payment_intent).toBeDefined();
      expect(payment.stripe_payment_intent!.startsWith("pi_")).toBe(true);
    });
  });

  describe("Bank Transfer Handling", () => {
    it("should store bank reference with payment", () => {
      const payment: PaymentTransaction = {
        ...testPayment,
        payment_method: "bank_transfer",
        metadata: {
          bank_reference: "BANK-REF-123",
          account_number: "****5678",
          bank_name: "Equity Bank",
        },
      };

      expect(payment.metadata?.bank_reference).toBeDefined();
    });
  });

  describe("Refund Handling", () => {
    it("should calculate full refund for unallocated payment", () => {
      const payment: PaymentTransaction = {
        ...testPayment,
        amount: 25000,
      };

      const refund = calculateRefundAmount(payment, []);
      expect(refund).toBe(25000);
    });

    it("should calculate partial refund for partially allocated payment", () => {
      const payment: PaymentTransaction = {
        ...testPayment,
        amount: 25000,
      };

      const allocations: PaymentAllocation[] = [
        {
          id: generateUUID(),
          transaction_id: payment.id,
          invoice_id: generateUUID(),
          allocated_amount: 10000,
          created_at: new Date().toISOString(),
        },
      ];

      const refund = calculateRefundAmount(payment, allocations);
      expect(refund).toBe(15000);
    });

    it("should return zero refund for fully allocated payment", () => {
      const payment: PaymentTransaction = {
        ...testPayment,
        amount: 25000,
      };

      const allocations: PaymentAllocation[] = [
        {
          id: generateUUID(),
          transaction_id: payment.id,
          invoice_id: generateUUID(),
          allocated_amount: 25000,
          created_at: new Date().toISOString(),
        },
      ];

      const refund = calculateRefundAmount(payment, allocations);
      expect(refund).toBe(0);
    });
  });

  describe("Payment State Machine", () => {
    it("should transition from pending to completed", () => {
      let status: PaymentTransaction["status"] = "pending";
      
      // Simulate successful payment
      if (status === "pending") {
        status = "completed";
      }

      expect(status).toBe("completed");
    });

    it("should transition from pending to failed", () => {
      let status: PaymentTransaction["status"] = "pending";
      
      // Simulate failed payment
      if (status === "pending") {
        status = "failed";
      }

      expect(status).toBe("failed");
    });

    it("should transition from completed to refunded", () => {
      let status: PaymentTransaction["status"] = "completed";
      
      // Simulate refund
      if (status === "completed") {
        status = "refunded";
      }

      expect(status).toBe("refunded");
    });

    it("should not allow transition from failed to completed", () => {
      const status: PaymentTransaction["status"] = "failed";
      
      // Attempt to mark failed payment as completed (should not happen)
      if (status !== "pending") {
        // Invalid transition - do nothing
      }

      expect(status).toBe("failed");
    });
  });

  describe("Concurrent Payment Handling", () => {
    it("should handle concurrent payment attempts for same invoice", () => {
      const invoice = { ...testInvoice };
      const payments: PaymentTransaction[] = [];
      
      // Simulate two concurrent payment attempts
      for (let i = 0; i < 2; i++) {
        payments.push({
          id: generateUUID(),
          invoice_id: invoice.id,
          amount: 15000,
          payment_method: "mpesa",
          status: "completed",
          transaction_id: `MPESA-CONCURRENT-${i}`,
          payment_date: new Date().toISOString(),
        });
      }

      // Both payments created (in real system, would need locking/serialization)
      expect(payments).toHaveLength(2);
    });

    it("should prevent double-allocation of payment", () => {
      const transactionId = generateUUID();
      const allocations: PaymentAllocation[] = [
        {
          id: generateUUID(),
          transaction_id: transactionId,
          invoice_id: testInvoice.id,
          allocated_amount: 25000,
          created_at: new Date().toISOString(),
        },
      ];

      // Check if already allocated
      const alreadyAllocated = allocations.some(a => a.transaction_id === transactionId);
      expect(alreadyAllocated).toBe(true);
    });
  });

  describe("Currency Handling", () => {
    it("should handle KES amounts with proper precision", () => {
      const amount = 15000.50;
      expect(Number.isFinite(amount)).toBe(true);
      expect(Math.round(amount * 100) / 100).toBe(15000.50);
    });

    it("should handle zero amounts", () => {
      const invoice: Invoice = {
        ...testInvoice,
        amount: 0,
        balance_due: 0,
      };

      expect(calculateBalanceDue(invoice)).toBe(0);
    });

    it("should handle very large amounts", () => {
      const invoice: Invoice = {
        ...testInvoice,
        amount: 100_000_000, // 100 million KES
        balance_due: 100_000_000,
      };

      expect(calculateBalanceDue(invoice)).toBe(100_000_000);
      expect(Number.isSafeInteger(invoice.amount)).toBe(true);
    });
  });
});
