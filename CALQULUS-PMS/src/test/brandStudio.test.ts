import { describe, expect, it } from "vitest";
import { canEditOrgBrand } from "@/core/brand/authorize";
import {
  containsCssInjection,
  sanitizeBrandUrl,
  sanitizeCustomDomain,
  sanitizeOptionalHex,
  sanitizePlainText,
} from "@/core/brand/sanitizeBrandInput";
import { orgBrandDraftToOverlay, sanitizeOrgBrandDraft, emptyOrgBrandDraft } from "@/core/brand/orgBrandDraft";

describe("Brand Studio authorization", () => {
  it("allows only the manager or agency that owns the company record", () => {
    expect(canEditOrgBrand("manager")).toBe(true);
    expect(canEditOrgBrand("agency")).toBe(true);
    expect(canEditOrgBrand("submanager")).toBe(false);
    expect(canEditOrgBrand("webhost")).toBe(false);
    expect(canEditOrgBrand("landlord")).toBe(false);
    expect(canEditOrgBrand("tenant")).toBe(false);
    expect(canEditOrgBrand(null)).toBe(false);
  });
});

describe("Brand Studio sanitization", () => {
  it("rejects CSS and script payloads", () => {
    expect(containsCssInjection("<style>body{}</style>")).toBe(true);
    expect(containsCssInjection("javascript:alert(1)")).toBe(true);
    expect(sanitizePlainText("Ridgeview <b>Estates</b>")).toBe("Ridgeview Estates");
    expect(sanitizeBrandUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeBrandUrl("https://cdn.example/logo.png")).toBe("https://cdn.example/logo.png");
    expect(sanitizeBrandUrl("/favicon.ico")).toBe("/favicon.ico");
  });

  it("stores a host only for custom domain", () => {
    expect(sanitizeCustomDomain("https://app.ridgeview.co.ke/login")).toBe("app.ridgeview.co.ke");
    expect(sanitizeCustomDomain("not a domain")).toBe("");
  });

  it("keeps only 6-digit hex colours", () => {
    expect(sanitizeOptionalHex("#2F6FED")).toBe("#2F6FED");
    expect(sanitizeOptionalHex("blue")).toBe("");
    expect(sanitizeOptionalHex("")).toBe("");
  });

  it("does not persist CSS in the brand_config overlay", () => {
    const dirty = emptyOrgBrandDraft();
    dirty.tagline = "Hello {color:red}";
    dirty.emailFromName = "<style>x</style>Ridgeview";
    const clean = sanitizeOrgBrandDraft(dirty);
    expect(clean.tagline).not.toMatch(/[{}]/);
    expect(clean.emailFromName).not.toMatch(/style/i);
    const overlay = orgBrandDraftToOverlay(clean);
    expect(JSON.stringify(overlay)).not.toMatch(/<style/i);
  });
});
