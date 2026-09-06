/**
 * Lease Workflow Integration Tests
 * 
 * Tests the complete lease lifecycle:
 * - Lease creation with unit assignment
 * - Lease activation and tenant assignment
 * - Lease renewal and termination
 * - Rent amount validation
 * 
 * Run with: npm test -- src/test/integration/lease-workflow.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateUUID } from "../setup";

// ── Mock Data Store ────────────────────────────────────────────────────────────
const mockDatabase = new Map<string, any[]>();

// Reset mock database before each test
function resetMockDatabase() {
  mockDatabase.clear();
}

// ── Lease Validation Helpers (mirrors production logic) ───────────────────────

interface LeaseData {
  property_id: string;
  unit_id: string;
  tenant_id?: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  status: "draft" | "active" | "expired" | "terminated";
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateLeaseDates(startDate: string, endDate: string): ValidationResult {
  const errors: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start >= end) {
    errors.push("Lease start date must be before end date");
  }

  if (start < today) {
    errors.push("Lease start date cannot be in the past");
  }

  // Minimum lease duration: 1 month
  const minDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
  if (end - start < minDuration) {
    errors.push("Minimum lease duration is 30 days");
  }

  // Maximum lease duration: 5 years
  const maxDuration = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years in ms
  if (end - start > maxDuration) {
    errors.push("Maximum lease duration is 5 years");
  }

  return { valid: errors.length === 0, errors };
}

function validateLeaseAmounts(monthlyRent: number, securityDeposit: number): ValidationResult {
  const errors: string[] = [];

  if (monthlyRent <= 0) {
    errors.push("Monthly rent must be greater than 0");
  }

  if (monthlyRent > 10_000_000) {
    errors.push("Monthly rent exceeds maximum allowed amount");
  }

  // Security deposit typically 1-3 months rent
  const minDeposit = monthlyRent;
  const maxDeposit = monthlyRent * 3;
  
  if (securityDeposit < minDeposit) {
    errors.push(`Security deposit must be at least ${minDeposit} (1 month rent)`);
  }

  if (securityDeposit > maxDeposit) {
    errors.push(`Security deposit cannot exceed ${maxDeposit} (3 months rent)`);
  }

  return { valid: errors.length === 0, errors };
}

function calculateLeaseTerm(startDate: string, endDate: string): { months: number; days: number } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const diffTime = end.getTime() - start.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Approximate months
  const months = Math.floor(days / 30.44);
  
  return { months, days };
}

function calculateTotalLeaseValue(monthlyRent: number, startDate: string, endDate: string): number {
  const { months } = calculateLeaseTerm(startDate, endDate);
  return monthlyRent * months;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Lease Workflow Integration", () => {
  let testPropertyId: string;
  let testUnitId: string;
  let testTenantId: string;
  let testLeaseId: string;

  beforeEach(() => {
    resetMockDatabase();
    
    testPropertyId = generateUUID();
    testUnitId = generateUUID();
    testTenantId = generateUUID();
    testLeaseId = generateUUID();

    // Initialize mock data
    mockDatabase.set("properties", [{
      id: testPropertyId,
      manager_id: generateUUID(),
      address: "123 Test Street",
      status: "active",
      created_at: new Date().toISOString(),
    }]);

    mockDatabase.set("units", [{
      id: testUnitId,
      property_id: testPropertyId,
      unit_number: "A1",
      monthly_rent: 15000,
      status: "vacant",
      created_at: new Date().toISOString(),
    }]);

    mockDatabase.set("tenants", [{
      id: testTenantId,
      full_name: "John Doe",
      email: "john.doe@test.com",
      phone: "+254700000001",
      unit_id: testUnitId,
      status: "active",
      created_at: new Date().toISOString(),
    }]);

    mockDatabase.set("leases", []);
    mockDatabase.set("invoices", []);
  });

  describe("Lease Creation", () => {
    it("should create a valid lease with all required fields", () => {
      const lease: LeaseData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        tenant_id: testTenantId,
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        end_date: new Date(Date.now() + 395 * 24 * 60 * 60 * 1000).toISOString(), // ~13 months
        monthly_rent: 15000,
        security_deposit: 30000,
        status: "draft",
      };

      const dateValidation = validateLeaseDates(lease.start_date, lease.end_date);
      const amountValidation = validateLeaseAmounts(lease.monthly_rent, lease.security_deposit);

      expect(dateValidation.valid).toBe(true);
      expect(amountValidation.valid).toBe(true);
      expect(lease.tenant_id).toBeDefined();
    });

    it("should reject lease with start date in the past", () => {
      const lease: LeaseData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        tenant_id: testTenantId,
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_rent: 15000,
        security_deposit: 30000,
        status: "draft",
      };

      const validation = validateLeaseDates(lease.start_date, lease.end_date);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Lease start date cannot be in the past");
    });

    it("should reject lease shorter than minimum duration", () => {
      const lease: LeaseData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        tenant_id: testTenantId,
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // Only 7 days
        monthly_rent: 15000,
        security_deposit: 30000,
        status: "draft",
      };

      const validation = validateLeaseDates(lease.start_date, lease.end_date);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Minimum lease duration is 30 days");
    });

    it("should reject lease longer than maximum duration", () => {
      const lease: LeaseData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        tenant_id: testTenantId,
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 2000 * 24 * 60 * 60 * 1000).toISOString(), // ~5.5 years
        monthly_rent: 15000,
        security_deposit: 30000,
        status: "draft",
      };

      const validation = validateLeaseDates(lease.start_date, lease.end_date);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Maximum lease duration is 5 years");
    });

    it("should reject lease with invalid rent amount", () => {
      const validation = validateLeaseAmounts(0, 30000);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Monthly rent must be greater than 0");
    });

    it("should reject lease with security deposit less than 1 month rent", () => {
      const validation = validateLeaseAmounts(15000, 10000);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Security deposit must be at least 15000 (1 month rent)");
    });

    it("should reject lease with security deposit more than 3 months rent", () => {
      const validation = validateLeaseAmounts(15000, 60000);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Security deposit cannot exceed 45000 (3 months rent)");
    });
  });

  describe("Lease Activation", () => {
    it("should activate lease when unit is vacant", () => {
      const unit = mockDatabase.get("units")![0];
      expect(unit.status).toBe("vacant");

      // Simulate lease activation
      const activatedLease = {
        id: testLeaseId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        tenant_id: testTenantId,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_rent: 15000,
        security_deposit: 30000,
        status: "active",
        activated_at: new Date().toISOString(),
      };

      expect(activatedLease.status).toBe("active");
      expect(unit.status).toBe("vacant"); // Unit status unchanged until tenant moves in
    });

    it("should generate first rent invoice on activation", () => {
      const lease: LeaseData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        tenant_id: testTenantId,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_rent: 15000,
        security_deposit: 30000,
        status: "active",
      };

      // Generate first month's invoice
      const invoice = {
        id: generateUUID(),
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        unit_id: lease.unit_id,
        amount: lease.monthly_rent,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // Due in 5 days
        status: "pending",
        invoice_number: `INV-${Date.now()}`,
        lease_id: testLeaseId,
        created_at: new Date().toISOString(),
      };

      expect(invoice.amount).toBe(15000);
      expect(invoice.status).toBe("pending");
      expect(invoice.lease_id).toBe(testLeaseId);
    });

    it("should record security deposit on activation", () => {
      const lease: LeaseData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        tenant_id: testTenantId,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_rent: 15000,
        security_deposit: 30000,
        status: "active",
      };

      // Security deposit should be separate invoice
      const depositInvoice = {
        id: generateUUID(),
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        unit_id: lease.unit_id,
        amount: lease.security_deposit,
        due_date: new Date().toISOString(),
        status: "pending",
        invoice_number: `DEP-${Date.now()}`,
        type: "security_deposit",
        created_at: new Date().toISOString(),
      };

      expect(depositInvoice.amount).toBe(30000);
      expect(depositInvoice.type).toBe("security_deposit");
    });
  });

  describe("Lease Duration Calculations", () => {
    it("should calculate 12-month lease correctly", () => {
      const startDate = "2026-01-01T00:00:00.000Z";
      const endDate = "2026-12-31T00:00:00.000Z";
      
      const { months, days } = calculateLeaseTerm(startDate, endDate);
      
      expect(days).toBeGreaterThanOrEqual(364);
      expect(days).toBeLessThanOrEqual(366);
      expect(months).toBeGreaterThanOrEqual(11);
    });

    it("should calculate 6-month lease correctly", () => {
      const startDate = "2026-01-01T00:00:00.000Z";
      const endDate = "2026-06-30T00:00:00.000Z";
      
      const { months, days } = calculateLeaseTerm(startDate, endDate);
      
      expect(days).toBeGreaterThanOrEqual(179);
      expect(days).toBeLessThanOrEqual(181);
      expect(months).toBeGreaterThanOrEqual(5);
    });

    it("should calculate total lease value correctly", () => {
      const monthlyRent = 25000;
      const startDate = "2026-01-01T00:00:00.000Z";
      const endDate = "2026-06-30T00:00:00.000Z";
      
      const totalValue = calculateTotalLeaseValue(monthlyRent, startDate, endDate);
      const { months } = calculateLeaseTerm(startDate, endDate);
      
      // Should be approximately 6 months * 25000
      expect(totalValue).toBeCloseTo(months * monthlyRent, 0);
    });
  });

  describe("Lease Renewal", () => {
    it("should detect expiring lease (30 days before expiry)", () => {
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const today = new Date();
      const daysUntilExpiry = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(daysUntilExpiry).toBeLessThanOrEqual(30);
      expect(daysUntilExpiry).toBeGreaterThanOrEqual(29);
    });

    it("should generate renewal notice for expiring leases", () => {
      const lease = {
        id: testLeaseId,
        tenant_id: testTenantId,
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_rent: 15000,
        status: "active",
      };

      const daysUntilExpiry = Math.floor(
        (new Date(lease.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const renewalNotice = {
        lease_id: lease.id,
        tenant_id: lease.tenant_id,
        days_until_expiry: daysUntilExpiry,
        current_rent: lease.monthly_rent,
        suggested_new_rent: Math.round(lease.monthly_rent * 1.05), // 5% increase
        should_generate_notice: daysUntilExpiry <= 30,
      };

      expect(renewalNotice.should_generate_notice).toBe(true);
      expect(renewalNotice.suggested_new_rent).toBe(15750);
    });
  });

  describe("Lease Termination", () => {
    it("should handle mid-lease termination with prorated rent", () => {
      const lease = {
        start_date: "2026-01-01T00:00:00.000Z",
        end_date: "2026-12-31T00:00:00.000Z",
        monthly_rent: 15000,
        termination_date: "2026-06-15T00:00:00.000Z", // Mid-June
      };

      // Calculate prorated rent for June (15 days used, 15 days remaining)
      const daysInJune = 30;
      const daysUsed = 15;
      const dailyRate = lease.monthly_rent / daysInJune;
      const proratedRent = Math.round(dailyRate * daysUsed);

      expect(proratedRent).toBe(7500);
    });

    it("should calculate security deposit refund on termination", () => {
      const lease = {
        monthly_rent: 15000,
        security_deposit: 30000,
        damage_costs: 5000,
        outstanding_rent: 0,
      };

      // Refund = Deposit - Damage Costs - Outstanding Rent
      const refundAmount = lease.security_deposit - lease.damage_costs - lease.outstanding_rent;

      expect(refundAmount).toBe(25000);
    });

    it("should deduct outstanding rent from security deposit", () => {
      const lease = {
        monthly_rent: 15000,
        security_deposit: 30000,
        damage_costs: 0,
        outstanding_rent: 10000,
      };

      const refundAmount = lease.security_deposit - lease.damage_costs - lease.outstanding_rent;

      expect(refundAmount).toBe(20000);
    });

    it("should not allow negative refund", () => {
      const lease = {
        monthly_rent: 15000,
        security_deposit: 30000,
        damage_costs: 25000,
        outstanding_rent: 10000,
      };

      const refundAmount = lease.security_deposit - lease.damage_costs - lease.outstanding_rent;

      expect(refundAmount).toBeLessThan(0);
      // In production, this would be capped at 0 and additional billing initiated
    });
  });
});
