import { describe, it, expect } from "vitest";
import { tenantSchema, isValidKenyanPhone } from "@/shared/lib/validations";

describe("isValidKenyanPhone", () => {
  it("accepts local, E.164 and bare-international 254 formats", () => {
    expect(isValidKenyanPhone("0712345678")).toBe(true);
    expect(isValidKenyanPhone("+254712345678")).toBe(true);
    expect(isValidKenyanPhone("254712345678")).toBe(true);
  });

  it("rejects malformed or unknown formats", () => {
    expect(isValidKenyanPhone("12345")).toBe(false);
    expect(isValidKenyanPhone("0712345")).toBe(false);
    expect(isValidKenyanPhone("07123456789")).toBe(false);
    expect(isValidKenyanPhone("+25412345678")).toBe(false);
    expect(isValidKenyanPhone("6123456789")).toBe(false);
    expect(isValidKenyanPhone("not-a-number")).toBe(false);
  });

  it("rejects the leading-zero form in international/E.164 numbers", () => {
    expect(isValidKenyanPhone("+2540712345678")).toBe(false);
    expect(isValidKenyanPhone("2540712345678")).toBe(false);
  });
});

describe("tenantSchema", () => {
  it("accepts valid tenant data", () => {
    const result = tenantSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      property_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = tenantSchema.safeParse({
      email: "john@example.com",
      property_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = tenantSchema.safeParse({
      name: "John",
      email: "not-an-email",
      property_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional phone in Kenyan format", () => {
    const result = tenantSchema.safeParse({
      name: "John",
      email: "john@example.com",
      phone: "0712345678",
      property_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid phone format", () => {
    const result = tenantSchema.safeParse({
      name: "John",
      email: "john@example.com",
      phone: "12345",
      property_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the bare-international 254 phone format used across the app", () => {
    const result = tenantSchema.safeParse({
      name: "John",
      email: "john@example.com",
      phone: "254712345678",
      property_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(true);
  });
});
