import { describe, it, expect } from "vitest";
import { toUserFacingError } from "@/shared/lib/errorLogger";

describe("toUserFacingError", () => {
  it("returns a safe fallback for PostgREST/SQL constraint errors", () => {
    expect(
      toUserFacingError(
        new Error('insert or update on table "invoices" violates foreign key constraint'),
        "Could not save invoice",
      ),
    ).toBe("Could not save invoice");
  });

  it("returns a safe fallback for RLS denials", () => {
    expect(
      toUserFacingError(new Error("new row violates row-level security policy"), "Not allowed"),
    ).toBe("Not allowed");
  });

  it("passes through a short operational message", () => {
    expect(toUserFacingError(new Error("Enter a valid amount"), "Failed")).toBe("Enter a valid amount");
  });

  it("hides PostgREST codes", () => {
    expect(toUserFacingError(new Error("PGRST116: JSON object requested"), "Could not load data")).toBe(
      "Could not load data",
    );
  });

  it("hides JWT and network failures", () => {
    expect(toUserFacingError(new Error("JWT expired"), "Please try again")).toBe("Please try again");
    expect(toUserFacingError(new Error("TypeError: Failed to fetch"), "Please try again")).toBe(
      "Please try again",
    );
  });

  it("hides stack-trace fragments", () => {
    expect(
      toUserFacingError(new Error("TypeError: x is null\n    at loadDashboard (app.js:12)"), "Something went wrong"),
    ).toBe("Something went wrong");
  });
});
