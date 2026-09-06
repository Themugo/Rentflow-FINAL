/**
 * _shared/validation.ts
 *
 * Input validation utilities for CALQULUS PMS edge functions.
 *
 * Provides standardized validation logic across all functions,
 * eliminating code duplication and ensuring consistent input checking.
 *
 * Usage:
 *   import { validateEmail, validatePhone, validateRequired } from "../_shared/validation.ts";
 *
 *   const email = validateEmail(req.body.email);
 *   if (!email.valid) return errorResponse(email.error, 400);
 */

import { ValidationError } from "./errors.ts";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: any;
}

/**
 * Validate email format.
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true, value: email.toLowerCase().trim() };
}

/**
 * Validate phone number (Kenyan format).
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== "string") {
    return { valid: false, error: "Phone number is required" };
  }

  // Remove spaces and special characters
  const cleaned = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

  // Check if it's a valid Kenyan number (starts with 254 or 07)
  if (cleaned.startsWith("254") && cleaned.length === 12) {
    return { valid: true, value: cleaned };
  }

  if (cleaned.startsWith("07") && cleaned.length === 10) {
    return { valid: true, value: "254" + cleaned.substring(1) };
  }

  if (cleaned.startsWith("01") && cleaned.length === 10) {
    return { valid: true, value: "254" + cleaned.substring(1) };
  }

  return { valid: false, error: "Invalid phone number format. Use format 254XXXXXXXXX or 07XXXXXXXXX" };
}

/**
 * Validate required field.
 */
export function validateRequired(value: any, fieldName: string = "Field"): ValidationResult {
  if (value === null || value === undefined || value === "") {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true, value };
}

/**
 * Validate numeric value.
 */
export function validateNumber(value: any, fieldName: string = "Number"): ValidationResult {
  const required = validateRequired(value, fieldName);
  if (!required.valid) return required;

  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  return { valid: true, value: num };
}

/**
 * Validate positive number.
 */
export function validatePositiveNumber(value: any, fieldName: string = "Number"): ValidationResult {
  const numResult = validateNumber(value, fieldName);
  if (!numResult.valid) return numResult;

  if (numResult.value <= 0) {
    return { valid: false, error: `${fieldName} must be greater than 0` };
  }

  return numResult;
}

/**
 * Validate UUID format.
 */
export function validateUUID(uuid: string): ValidationResult {
  if (!uuid || typeof uuid !== "string") {
    return { valid: false, error: "UUID is required" };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: "Invalid UUID format" };
  }

  return { valid: true, value: uuid.toLowerCase() };
}

/**
 * Validate date string.
 */
export function validateDate(date: string): ValidationResult {
  if (!date || typeof date !== "string") {
    return { valid: false, error: "Date is required" };
  }

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  return { valid: true, value: parsed.toISOString() };
}

/**
 * Validate enum value.
 */
export function validateEnum(value: any, allowedValues: string[], fieldName: string = "Field"): ValidationResult {
  const required = validateRequired(value, fieldName);
  if (!required.valid) return required;

  if (!allowedValues.includes(String(value))) {
    return { valid: false, error: `${fieldName} must be one of: ${allowedValues.join(", ")}` };
  }

  return { valid: true, value: String(value) };
}

/**
 * Validate object with schema.
 */
export function validateObject(data: any, schema: Record<string, (value: any) => ValidationResult>): ValidationResult {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Data must be an object" };
  }

  const errors: string[] = [];
  const validated: Record<string, any> = {};

  for (const [field, validator] of Object.entries(schema)) {
    const result = validator(data[field]);
    if (!result.valid) {
      errors.push(result.error || `Invalid ${field}`);
    } else {
      validated[field] = result.value;
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join(", ") };
  }

  return { valid: true, value: validated };
}

/**
 * Validate array of items.
 */
export function validateArray(items: any, validator: (item: any) => ValidationResult): ValidationResult {
  if (!Array.isArray(items)) {
    return { valid: false, error: "Must be an array" };
  }

  const validated: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const result = validator(items[i]);
    if (!result.valid) {
      errors.push(`Item ${i}: ${result.error}`);
    } else {
      validated.push(result.value);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join(", ") };
  }

  return { valid: true, value: validated };
}

/**
 * Validate string length.
 */
export function validateStringLength(value: string, min: number, max: number, fieldName: string = "Field"): ValidationResult {
  const required = validateRequired(value, fieldName);
  if (!required.valid) return required;

  if (value.length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters` };
  }

  if (value.length > max) {
    return { valid: false, error: `${fieldName} must be at most ${max} characters` };
  }

  return { valid: true, value };
}

/**
 * Sanitize string input.
 */
export function sanitizeString(value: string): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[<>]/g, "");
}
