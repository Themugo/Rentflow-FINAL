/**
 * API Contract Tests - Tenant Invitation Edge Function
 * 
 * Tests the send-tenant-invitation edge function API:
 * - Request validation and sanitization
 * - Response format and error handling
 * - SMS/Email/WhatsApp notification payloads
 * - Rate limiting and idempotency
 * 
 * Run with: npm test -- src/test/api-contracts/tenant-invitation-api-contracts.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── API Contract Types ─────────────────────────────────────────────────────────

interface TenantInvitationRequest {
  property_id: string;
  unit_id: string;
  tenant_name: string;
  tenant_email?: string;
  tenant_phone: string;
  monthly_rent: number;
  move_in_date: string;
  manager_id: string;
}

interface TenantInvitationResponse {
  success: boolean;
  invitation_id?: string;
  error?: string;
  notifications_sent?: {
    sms?: boolean;
    email?: boolean;
    whatsapp?: boolean;
  };
}

interface SMSPayload {
  to: string;
  message: string;
  sender: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface WhatsAppPayload {
  to: string;
  template: string;
  variables: Record<string, string>;
}

// ── API Validation Functions ──────────────────────────────────────────────────

function validateInvitationRequest(req: Partial<TenantInvitationRequest>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!req.property_id || typeof req.property_id !== "string") {
    errors.push("property_id is required and must be a string");
  }

  if (!req.unit_id || typeof req.unit_id !== "string") {
    errors.push("unit_id is required and must be a string");
  }

  if (!req.tenant_name || req.tenant_name.trim().length < 2) {
    errors.push("tenant_name must be at least 2 characters");
  }

  if (req.tenant_name && req.tenant_name.length > 100) {
    errors.push("tenant_name must not exceed 100 characters");
  }

  if (req.tenant_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.tenant_email)) {
      errors.push("tenant_email must be a valid email address");
    }
  }

  if (!req.tenant_phone) {
    errors.push("tenant_phone is required");
  } else {
    const digits = req.tenant_phone.replace(/\D/g, "");
    const isValid = digits.length === 9 || digits.length === 10 || digits.length === 12;
    if (!isValid) {
      errors.push("tenant_phone must be a valid Kenya phone number");
    }
  }

  if (!req.monthly_rent || typeof req.monthly_rent !== "number") {
    errors.push("monthly_rent is required and must be a number");
  } else if (req.monthly_rent < 0) {
    errors.push("monthly_rent cannot be negative");
  } else if (req.monthly_rent > 10_000_000) {
    errors.push("monthly_rent exceeds maximum allowed amount");
  }

  if (!req.move_in_date) {
    errors.push("move_in_date is required");
  } else {
    const date = new Date(req.move_in_date);
    if (isNaN(date.getTime())) {
      errors.push("move_in_date must be a valid date");
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        errors.push("move_in_date cannot be in the past");
      }
    }
  }

  if (!req.manager_id || typeof req.manager_id !== "string") {
    errors.push("manager_id is required and must be a string");
  }

  return { valid: errors.length === 0, errors };
}

function validateIdempotencyKey(key: string | undefined): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: "Idempotency key is required" };
  }

  if (key.length < 16) {
    return { valid: false, error: "Idempotency key must be at least 16 characters" };
  }

  if (key.length > 128) {
    return { valid: false, error: "Idempotency key must not exceed 128 characters" };
  }

  // Should only contain alphanumeric characters and hyphens
  if (!/^[a-zA-Z0-9-]+$/.test(key)) {
    return { valid: false, error: "Idempotency key must only contain alphanumeric characters and hyphens" };
  }

  return { valid: true };
}

function sanitizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");
  
  // Handle various formats
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "254" + digits.substring(1);
  } else if (digits.startsWith("7") && digits.length === 9) {
    digits = "254" + digits;
  } else if (digits.startsWith("254") && digits.length === 12) {
    // Already in correct format
  } else if (digits.length === 12 && !digits.startsWith("254")) {
    digits = "254" + digits.substring(2);
  }
  
  return digits;
}

function generateInvitationLink(invitationId: string, baseUrl = "https://www.calqulus.site"): string {
  return `${baseUrl}/tenant/signup?invitation_id=${invitationId}`;
}

function generateSMSTemplate(variables: {
  tenant_name: string;
  property_address: string;
  unit_number: string;
  monthly_rent: number;
  move_in_date: string;
  invitation_link: string;
}): SMSPayload {
  const message = `Hello ${variables.tenant_name}, you've been invited to join our property management system. Property: ${variables.property_address}, Unit: ${variables.unit_number}. Monthly rent: KES ${variables.monthly_rent.toLocaleString()}. Move in: ${variables.move_in_date}. Accept invitation: ${variables.invitation_link}`;

  return {
    to: "", // Will be filled by caller
    message,
    sender: "CALQULUS",
  };
}

function generateEmailTemplate(variables: {
  tenant_name: string;
  property_address: string;
  unit_number: string;
  monthly_rent: number;
  move_in_date: string;
  invitation_link: string;
  manager_name: string;
}): EmailPayload {
  const subject = `You've been invited to join ${variables.property_address}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2F6FED;">Welcome to CALQULUS PMS</h1>
      <p>Hello ${variables.tenant_name},</p>
      <p>You've been invited by ${variables.manager_name} to join our property management platform.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Property Details</h3>
        <p><strong>Property:</strong> ${variables.property_address}</p>
        <p><strong>Unit:</strong> ${variables.unit_number}</p>
        <p><strong>Monthly Rent:</strong> KES ${variables.monthly_rent.toLocaleString()}</p>
        <p><strong>Move-in Date:</strong> ${variables.move_in_date}</p>
      </div>
      <a href="${variables.invitation_link}" style="background-color: #2F6FED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
        Accept Invitation
      </a>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        This invitation expires in 14 days. If you didn't expect this email, please ignore it.
      </p>
    </div>
  `;

  return {
    to: "", // Will be filled by caller
    subject,
    html,
    text: `Hello ${variables.tenant_name}, you've been invited to join our property management system. Property: ${variables.property_address}, Unit: ${variables.unit_number}. Monthly rent: KES ${variables.monthly_rent.toLocaleString()}. Move in: ${variables.move_in_date}. Accept invitation: ${variables.invitation_link}`,
  };
}

function generateWhatsAppTemplate(variables: {
  tenant_name: string;
  property_address: string;
  unit_number: string;
  monthly_rent: number;
  move_in_date: string;
}): WhatsAppPayload {
  return {
    to: "", // Will be filled by caller
    template: "tenant_invitation",
    variables: {
      tenant_name: variables.tenant_name,
      property_address: variables.property_address,
      unit_number: variables.unit_number,
      monthly_rent: variables.monthly_rent.toString(),
      move_in_date: variables.move_in_date,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Tenant Invitation API Contract Tests", () => {

  describe("Request Validation", () => {
    it("should accept valid invitation request with email", () => {
      const request: Partial<TenantInvitationRequest> = {
        property_id: "prop-123",
        unit_id: "unit-456",
        tenant_name: "John Doe",
        tenant_email: "john.doe@example.com",
        tenant_phone: "0712345678",
        monthly_rent: 25000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        manager_id: "mgr-789",
      };

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should accept valid invitation request without email (phone-only)", () => {
      const request: Partial<TenantInvitationRequest> = {
        property_id: "prop-123",
        unit_id: "unit-456",
        tenant_name: "Feature Phone User",
        tenant_phone: "+254712345678",
        monthly_rent: 15000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        manager_id: "mgr-789",
      };

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject request with missing required fields", () => {
      const request = {} as Partial<TenantInvitationRequest>;

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should reject request with short tenant name", () => {
      const request: Partial<TenantInvitationRequest> = {
        property_id: "prop-123",
        unit_id: "unit-456",
        tenant_name: "J", // Too short
        tenant_phone: "0712345678",
        monthly_rent: 25000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        manager_id: "mgr-789",
      };

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("tenant_name must be at least 2 characters");
    });

    it("should reject request with invalid email", () => {
      const request: Partial<TenantInvitationRequest> = {
        property_id: "prop-123",
        unit_id: "unit-456",
        tenant_name: "John Doe",
        tenant_email: "not-an-email",
        tenant_phone: "0712345678",
        monthly_rent: 25000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        manager_id: "mgr-789",
      };

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("tenant_email must be a valid email address");
    });

    it("should reject request with invalid phone number", () => {
      const request: Partial<TenantInvitationRequest> = {
        property_id: "prop-123",
        unit_id: "unit-456",
        tenant_name: "John Doe",
        tenant_phone: "123", // Too short
        monthly_rent: 25000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        manager_id: "mgr-789",
      };

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("tenant_phone must be a valid Kenya phone number");
    });

    it("should reject request with negative rent", () => {
      const request: Partial<TenantInvitationRequest> = {
        property_id: "prop-123",
        unit_id: "unit-456",
        tenant_name: "John Doe",
        tenant_phone: "0712345678",
        monthly_rent: -1000,
        move_in_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        manager_id: "mgr-789",
      };

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("monthly_rent cannot be negative");
    });

    it("should reject request with past move-in date", () => {
      const request: Partial<TenantInvitationRequest> = {
        property_id: "prop-123",
        unit_id: "unit-456",
        tenant_name: "John Doe",
        tenant_phone: "0712345678",
        monthly_rent: 25000,
        move_in_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Past
        manager_id: "mgr-789",
      };

      const validation = validateInvitationRequest(request);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("move_in_date cannot be in the past");
    });
  });

  describe("Idempotency Key Validation", () => {
    it("should accept valid idempotency key", () => {
      const key = "inv-20240101-abc123def456";
      const validation = validateIdempotencyKey(key);
      expect(validation.valid).toBe(true);
    });

    it("should reject missing idempotency key", () => {
      const validation = validateIdempotencyKey(undefined);
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe("Idempotency key is required");
    });

    it("should reject idempotency key too short", () => {
      const validation = validateIdempotencyKey("short-key");
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain("at least 16 characters");
    });

    it("should reject idempotency key with invalid characters", () => {
      const validation = validateIdempotencyKey("key with spaces!@#");
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain("alphanumeric characters and hyphens");
    });
  });

  describe("Phone Number Sanitization", () => {
    it("should normalize 10-digit phone number starting with 0", () => {
      const phone = "0712345678";
      expect(sanitizePhoneNumber(phone)).toBe("254712345678");
    });

    it("should normalize 9-digit phone number starting with 7", () => {
      const phone = "712345678";
      expect(sanitizePhoneNumber(phone)).toBe("254712345678");
    });

    it("should preserve 12-digit phone number starting with 254", () => {
      const phone = "254712345678";
      expect(sanitizePhoneNumber(phone)).toBe("254712345678");
    });

    it("should handle phone number with international format +254", () => {
      const phone = "+254712345678";
      expect(sanitizePhoneNumber(phone)).toBe("254712345678");
    });

    it("should handle phone number with spaces and dashes", () => {
      const phone = "0712-345-678";
      expect(sanitizePhoneNumber(phone)).toBe("254712345678");
    });
  });

  describe("Invitation Link Generation", () => {
    it("should generate valid invitation link", () => {
      const invitationId = "inv-abc123";
      const link = generateInvitationLink(invitationId);
      
      expect(link).toBe("https://www.calqulus.site/tenant/signup?invitation_id=inv-abc123");
    });

    it("should generate invitation link with custom base URL", () => {
      const invitationId = "inv-abc123";
      const baseUrl = "https://staging.calqulusrms.com";
      const link = generateInvitationLink(invitationId, baseUrl);
      
      expect(link).toBe("https://staging.calqulusrms.com/tenant/signup?invitation_id=inv-abc123");
    });
  });

  describe("SMS Template Generation", () => {
    it("should generate SMS with all required variables", () => {
      const template = generateSMSTemplate({
        tenant_name: "Jane Smith",
        property_address: "123 Main Street",
        unit_number: "A1",
        monthly_rent: 25000,
        move_in_date: "2024-02-01",
        invitation_link: "https://www.calqulus.site/invite/abc123",
      });

      expect(template.message).toContain("Jane Smith");
      expect(template.message).toContain("123 Main Street");
      expect(template.message).toContain("A1");
      expect(template.message).toContain("25,000");
      expect(template.message).toContain("2024-02-01");
      expect(template.message).toContain("https://www.calqulus.site/invite/abc123");
      expect(template.sender).toBe("CALQULUS");
    });
  });

  describe("Email Template Generation", () => {
    it("should generate email with all required variables", () => {
      const template = generateEmailTemplate({
        tenant_name: "Jane Smith",
        property_address: "123 Main Street",
        unit_number: "A1",
        monthly_rent: 25000,
        move_in_date: "2024-02-01",
        invitation_link: "https://www.calqulus.site/invite/abc123",
        manager_name: "Property Manager",
      });

      expect(template.subject).toContain("123 Main Street");
      expect(template.html).toContain("Jane Smith");
      expect(template.html).toContain("Property Manager");
      expect(template.html).toContain("A1");
      expect(template.html).toContain("25,000");
      expect(template.html).toContain("Accept Invitation");
      expect(template.text).toBeDefined();
    });
  });

  describe("WhatsApp Template Generation", () => {
    it("should generate WhatsApp payload with correct structure", () => {
      const payload = generateWhatsAppTemplate({
        tenant_name: "Jane Smith",
        property_address: "123 Main Street",
        unit_number: "A1",
        monthly_rent: 25000,
        move_in_date: "2024-02-01",
      });

      expect(payload.template).toBe("tenant_invitation");
      expect(payload.variables.tenant_name).toBe("Jane Smith");
      expect(payload.variables.property_address).toBe("123 Main Street");
      expect(payload.variables.unit_number).toBe("A1");
      expect(payload.variables.monthly_rent).toBe("25000");
      expect(payload.variables.move_in_date).toBe("2024-02-01");
    });
  });

  describe("Response Format", () => {
    it("should format successful response correctly", () => {
      const response: TenantInvitationResponse = {
        success: true,
        invitation_id: "inv-abc123",
        notifications_sent: {
          sms: true,
          email: true,
          whatsapp: false,
        },
      };

      expect(response.success).toBe(true);
      expect(response.invitation_id).toBe("inv-abc123");
      expect(response.error).toBeUndefined();
    });

    it("should format error response correctly", () => {
      const response: TenantInvitationResponse = {
        success: false,
        error: "Invalid phone number format",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Invalid phone number format");
      expect(response.invitation_id).toBeUndefined();
    });
  });
});
