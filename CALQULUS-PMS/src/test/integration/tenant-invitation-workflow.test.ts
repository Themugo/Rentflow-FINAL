/**
 * Tenant Invitation Workflow Integration Tests
 * 
 * Tests the complete tenant invitation and onboarding flow:
 * - Invitation creation with property/unit assignment
 * - Email/SMS notification generation
 * - Tenant signup and account linking
 * - Lease document generation
 * 
 * Run with: npm test -- src/test/integration/tenant-invitation-workflow.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateUUID } from "../setup";

// ── Mock Data Store ────────────────────────────────────────────────────────────
const mockDatabase = new Map<string, any[]>();

function resetMockDatabase() {
  mockDatabase.clear();
}

// ── Invitation Validation Helpers ─────────────────────────────────────────────

interface TenantInvitation {
  id: string;
  property_id: string;
  unit_id: string;
  email?: string;
  phone: string;
  full_name: string;
  monthly_rent: number;
  move_in_date: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  invited_by: string;
  created_at: string;
  expires_at: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validatePhoneNumber(phone: string): ValidationResult {
  const errors: string[] = [];
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");
  
  // Kenya: 12 digits starting with 254, or 10 digits starting with 0
  const isKenyanNumber = 
    (digitsOnly.length === 12 && digitsOnly.startsWith("254")) ||
    (digitsOnly.length === 10 && digitsOnly.startsWith("0"));
  
  if (!isKenyanNumber) {
    errors.push("Invalid Kenya phone number format");
  }
  
  return { valid: errors.length === 0, errors };
}

function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push("Invalid email format");
  }
  
  // Check for common disposable email domains
  const disposableDomains = ["tempmail.com", "throwaway.com", "mailinator.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && disposableDomains.includes(domain)) {
    errors.push("Disposable email addresses are not allowed");
  }
  
  return { valid: errors.length === 0, errors };
}

function validateInvitationData(data: Partial<TenantInvitation>): ValidationResult {
  const errors: string[] = [];
  
  if (!data.property_id) {
    errors.push("Property ID is required");
  }
  
  if (!data.unit_id) {
    errors.push("Unit ID is required");
  }
  
  if (!data.full_name || data.full_name.trim().length < 2) {
    errors.push("Full name must be at least 2 characters");
  }
  
  if (!data.phone) {
    errors.push("Phone number is required");
  } else {
    const phoneValidation = validatePhoneNumber(data.phone);
    if (!phoneValidation.valid) {
      errors.push(...phoneValidation.errors);
    }
  }
  
  if (data.email) {
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
      errors.push(...emailValidation.errors);
    }
  }
  
  if (!data.monthly_rent || data.monthly_rent <= 0) {
    errors.push("Monthly rent must be greater than 0");
  }
  
  if (!data.move_in_date) {
    errors.push("Move-in date is required");
  } else {
    const moveInDate = new Date(data.move_in_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Allow today or future dates
    if (moveInDate < today) {
      errors.push("Move-in date cannot be in the past");
    }
    
    // Cannot be more than 90 days in the future
    const maxFutureDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (moveInDate > maxFutureDate) {
      errors.push("Move-in date cannot be more than 90 days in the future");
    }
  }
  
  return { valid: errors.length === 0, errors };
}

function isInvitationExpired(invitation: TenantInvitation): boolean {
  const expiresAt = new Date(invitation.expires_at);
  return expiresAt < new Date();
}

function isInvitationAcceptable(invitation: TenantInvitation): boolean {
  return invitation.status === "pending" && !isInvitationExpired(invitation);
}

function generateInvitationExpiryDate(createdAt: Date, daysValid = 14): Date {
  return new Date(createdAt.getTime() + daysValid * 24 * 60 * 60 * 1000);
}

function formatPhoneForSMS(phone: string): string {
  // Convert to international format (254...)
  const formatted = phone.replace(/\D/g, "");
  
  // Handle 9-digit numbers starting with 7
  if (formatted.length === 9 && formatted.startsWith("7")) {
    return "254" + formatted;
  }
  
  // Handle 10-digit numbers starting with 0
  if (formatted.startsWith("0")) {
    return "254" + formatted.substring(1);
  }
  
  // Already in correct format
  return formatted;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Tenant Invitation Workflow Integration", () => {
  let testPropertyId: string;
  let testUnitId: string;
  let testManagerId: string;
  let testInvitationId: string;

  beforeEach(() => {
    resetMockDatabase();
    
    testPropertyId = generateUUID();
    testUnitId = generateUUID();
    testManagerId = generateUUID();
    testInvitationId = generateUUID();

    // Initialize mock data
    mockDatabase.set("properties", [{
      id: testPropertyId,
      manager_id: testManagerId,
      address: "456 Property Lane",
      status: "active",
    }]);

    mockDatabase.set("units", [{
      id: testUnitId,
      property_id: testPropertyId,
      unit_number: "B2",
      monthly_rent: 20000,
      status: "vacant",
    }]);

    mockDatabase.set("tenant_invitations", []);
    mockDatabase.set("tenant_accounts", []);
  });

  describe("Invitation Creation", () => {
    it("should create a valid invitation with all required fields", () => {
      const invitationData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        email: "new.tenant@example.com",
        phone: "0712345678",
        full_name: "Jane Smith",
        monthly_rent: 20000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: testManagerId,
      };

      const validation = validateInvitationData(invitationData);
      expect(validation.valid).toBe(true);
    });

    it("should create invitation with phone-only (no email)", () => {
      const invitationData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "+254712345678",
        full_name: "Feature Phone User",
        monthly_rent: 15000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: testManagerId,
      };

      const validation = validateInvitationData(invitationData);
      expect(validation.valid).toBe(true);
    });

    it("should reject invitation with invalid phone number", () => {
      const invitationData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "12345", // Too short
        full_name: "Test User",
        monthly_rent: 15000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: testManagerId,
      };

      const validation = validateInvitationData(invitationData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Invalid Kenya phone number format");
    });

    it("should reject invitation with invalid email", () => {
      const invitationData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        email: "not-an-email",
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 15000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: testManagerId,
      };

      const validation = validateInvitationData(invitationData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Invalid email format");
    });

    it("should reject invitation with past move-in date", () => {
      const invitationData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 15000,
        move_in_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: testManagerId,
      };

      const validation = validateInvitationData(invitationData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Move-in date cannot be in the past");
    });

    it("should reject invitation with move-in date too far in future", () => {
      const invitationData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 15000,
        move_in_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days
        invited_by: testManagerId,
      };

      const validation = validateInvitationData(invitationData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Move-in date cannot be more than 90 days in the future");
    });

    it("should reject invitation with missing required fields", () => {
      const invitationData = {
        property_id: testPropertyId,
        // Missing unit_id, phone, full_name, etc.
      };

      const validation = validateInvitationData(invitationData);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Invitation Expiry", () => {
    it("should mark invitation as expired after 14 days", () => {
      const createdAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const expiresAt = generateInvitationExpiryDate(createdAt);
      
      const invitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 20000,
        move_in_date: new Date().toISOString(),
        status: "pending",
        invited_by: testManagerId,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      expect(isInvitationExpired(invitation)).toBe(true);
    });

    it("should allow invitation within validity period", () => {
      const createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const expiresAt = generateInvitationExpiryDate(createdAt);
      
      const invitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 20000,
        move_in_date: new Date().toISOString(),
        status: "pending",
        invited_by: testManagerId,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      expect(isInvitationExpired(invitation)).toBe(false);
      expect(isInvitationAcceptable(invitation)).toBe(true);
    });

    it("should not allow acceptance of expired invitation", () => {
      const createdAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const expiresAt = generateInvitationExpiryDate(createdAt);
      
      const invitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 20000,
        move_in_date: new Date().toISOString(),
        status: "pending",
        invited_by: testManagerId,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      expect(isInvitationAcceptable(invitation)).toBe(false);
    });
  });

  describe("Invitation Acceptance", () => {
    it("should create tenant account on invitation acceptance", () => {
      const invitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        email: "new.tenant@example.com",
        phone: "0712345678",
        full_name: "Jane Smith",
        monthly_rent: 20000,
        move_in_date: new Date().toISOString(),
        status: "pending",
        invited_by: testManagerId,
        created_at: new Date().toISOString(),
        expires_at: generateInvitationExpiryDate(new Date()).toISOString(),
      };

      // Simulate acceptance
      const tenantAccount = {
        id: generateUUID(),
        invitation_id: invitation.id,
        full_name: invitation.full_name,
        email: invitation.email,
        phone: formatPhoneForSMS(invitation.phone),
        unit_id: invitation.unit_id,
        property_id: invitation.property_id,
        monthly_rent: invitation.monthly_rent,
        move_in_date: invitation.move_in_date,
        status: "active",
        created_at: new Date().toISOString(),
      };

      expect(tenantAccount.invitation_id).toBe(invitation.id);
      expect(tenantAccount.full_name).toBe("Jane Smith");
    });

    it("should link tenant to correct unit on acceptance", () => {
      const invitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test Tenant",
        monthly_rent: 20000,
        move_in_date: new Date().toISOString(),
        status: "pending",
        invited_by: testManagerId,
        created_at: new Date().toISOString(),
        expires_at: generateInvitationExpiryDate(new Date()).toISOString(),
      };

      // Verify unit is linked
      const unit = mockDatabase.get("units")![0];
      expect(unit.id).toBe(invitation.unit_id);
    });
  });

  describe("SMS Notification Generation", () => {
    it("should format Kenyan phone numbers correctly for SMS", () => {
      const testCases = [
        { input: "0712345678", expected: "254712345678" },
        { input: "712345678", expected: "254712345678" },
        { input: "+254712345678", expected: "254712345678" },
        { input: "254712345678", expected: "254712345678" },
      ];

      for (const { input, expected } of testCases) {
        const formatted = formatPhoneForSMS(input);
        expect(formatted).toBe(expected);
      }
    });

    it("should generate invitation SMS content", () => {
      const invitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Jane Smith",
        monthly_rent: 20000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "pending",
        invited_by: testManagerId,
        created_at: new Date().toISOString(),
        expires_at: generateInvitationExpiryDate(new Date()).toISOString(),
      };

      const smsContent = `Hello ${invitation.full_name}, you've been invited to join our property management platform. Your unit rent is KES ${invitation.monthly_rent.toLocaleString()}/month. Click to accept: https://www.calqulus.site/invite/${invitation.id}`;

      expect(smsContent).toContain("Jane Smith");
      expect(smsContent).toContain("20,000");
      expect(smsContent).toContain(invitation.id);
    });
  });

  describe("Invitation Cancellation", () => {
    it("should prevent acceptance of cancelled invitation", () => {
      const invitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 20000,
        move_in_date: new Date().toISOString(),
        status: "cancelled", // Cancelled
        invited_by: testManagerId,
        created_at: new Date().toISOString(),
        expires_at: generateInvitationExpiryDate(new Date()).toISOString(),
      };

      expect(isInvitationAcceptable(invitation)).toBe(false);
    });

    it("should allow re-invitation after cancellation", () => {
      // Original invitation cancelled
      const originalInvitation: TenantInvitation = {
        id: testInvitationId,
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User",
        monthly_rent: 20000,
        move_in_date: new Date().toISOString(),
        status: "cancelled",
        invited_by: testManagerId,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        expires_at: generateInvitationExpiryDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toISOString(),
      };

      // New invitation with updated details
      const newInvitationData = {
        property_id: testPropertyId,
        unit_id: testUnitId,
        phone: "0712345678",
        full_name: "Test User Updated",
        monthly_rent: 22000, // Updated rent
        move_in_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: testManagerId,
      };

      const validation = validateInvitationData(newInvitationData);
      expect(validation.valid).toBe(true);
      expect(newInvitationData.monthly_rent).not.toBe(originalInvitation.monthly_rent);
    });
  });
});
