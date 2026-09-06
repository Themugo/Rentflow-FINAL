import { z } from 'zod';

/**
 * Kenyan phone number validation.
 *
 * Accepts the forms used across the app (07…, +254… and 254… international):
 *   - 0712345678        (local, 0 prefix)
 *   - +254712345678     (E.164, with +)
 *   - 254712345678      (international, no +)
 * The `+` and `0` prefixes are not interchangeable — callers should treat them
 * as distinct inputs rather than silently rewriting them.
 */
export const KENYAN_PHONE_PATTERN = /^(07\d{8}|\+254\d{9}|254\d{9})$/;

export function isValidKenyanPhone(phone: string): boolean {
  return KENYAN_PHONE_PATTERN.test(phone);
}

// Tenant validation schema
export const tenantSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters")
    .trim(),
  phone: z.string()
    .max(20, "Phone must be less than 20 characters")
    .refine((val) => {
      if (!val || val === "") return true;
      // Kenyan format: 07XXXXXXXX, +254XXXXXXXXX or 254XXXXXXXXX
      return isValidKenyanPhone(val);
    }, "Enter a valid Kenyan phone number (07XXXXXXXX or 254XXXXXXXXX)")
    .optional()
    .or(z.literal("")),
  property_id: z.string().uuid("Property is required — tenants must be assigned to a property"),
  unit: z.string().max(20, "Unit must be less than 20 characters").optional().or(z.literal("")),
  move_in_date: z.string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Please enter a valid date")
    .optional()
    .or(z.literal("")),
  status: z.enum(["active", "pending", "inactive"]).optional(),
});

// Maintenance request validation schema
export const maintenanceRequestSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z.string()
    .min(1, "Description is required")
    .max(2000, "Description must be less than 2000 characters")
    .trim(),
  property_name: z.string()
    .min(1, "Property name is required")
    .max(100, "Property name must be less than 100 characters")
    .trim(),
  unit_number: z.string()
    .max(20, "Unit number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  tenant_name: z.string()
    .min(1, "Your name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  tenant_email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters")
    .trim(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

// Lease validation schema
export const leaseSchema = z.object({
  tenant_id: z.string().uuid("Please select a tenant"),
  property_id: z.string().uuid("Please select a property"),
  unit: z.string()
    .min(1, "Unit is required")
    .max(20, "Unit must be less than 20 characters")
    .trim(),
  start_date: z.string()
    .min(1, "Start date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date"),
  end_date: z.string()
    .min(1, "End date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date"),
  monthly_rent: z.string()
    .min(1, "Monthly rent is required")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 1000000;
    }, "Please enter a valid rent amount (1-1,000,000)"),
  deposit: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 10000000;
    }, "Please enter a valid deposit amount")
    .optional()
    .or(z.literal("")),
  terms: z.string().max(5000, "Terms must be less than 5000 characters").optional().or(z.literal("")),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["end_date"],
});

// Invoice validation schema - supports either lease_id OR tenant_id
export const invoiceSchema = z.object({
  lease_id: z.string().optional().or(z.literal("")),
  tenant_id: z.string().optional().or(z.literal("")),
  amount: z.string()
    .min(1, "Amount is required")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 10000000;
    }, "Please enter a valid amount (1-10,000,000)"),
  due_date: z.string()
    .min(1, "Due date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date"),
  description: z.string().max(500, "Description must be less than 500 characters").optional().or(z.literal("")),
});

// Property validation schema
export const propertySchema = z.object({
  name: z.string()
    .min(1, "Property name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  address: z.string()
    .min(1, "Address is required")
    .max(300, "Address must be less than 300 characters")
    .trim(),
  units: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseInt(val);
      return !isNaN(num) && num >= 0 && num <= 10000;
    }, "Please enter a valid number of units (0-10,000)")
    .optional()
    .or(z.literal("")),
  image_url: z.string()
    .max(500, "URL must be less than 500 characters")
    .refine((val) => {
      if (!val) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, "Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

// Helper to format validation errors for toast
export function formatValidationErrors(error: z.ZodError): string {
  return error.issues.map(e => e.message).join(". ");
}

// Password validation schema - strong password requirements
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be less than 72 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character (!@#$%^&*)");

// Auth validation schemas
export const signupSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: passwordSchema,
  fullName: z.string()
    .min(1, "Full name is required")
    .max(100, "Name must be less than 100 characters"),
});

export type TenantInput = z.infer<typeof tenantSchema>;
export type MaintenanceRequestInput = z.infer<typeof maintenanceRequestSchema>;
export type LeaseInput = z.infer<typeof leaseSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
export type SignupInput = z.infer<typeof signupSchema>;
