import { afterEach, describe, expect, it } from "vitest";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/shared/lib/formDraft";

describe("formDraft", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips a draft object", () => {
    saveFormDraft("new-property", { name: "Sunset" });
    expect(loadFormDraft<{ name: string }>("new-property")).toEqual({ name: "Sunset" });
  });

  it("returns null when nothing is stored", () => {
    expect(loadFormDraft("missing")).toBeNull();
  });

  it("clears a stored draft", () => {
    saveFormDraft("invite-tenant", { email: "a@b.com" });
    clearFormDraft("invite-tenant");
    expect(loadFormDraft("invite-tenant")).toBeNull();
  });

  it("returns null for invalid JSON instead of throwing", () => {
    sessionStorage.setItem("calqulus-form-draft:broken", "{");
    expect(loadFormDraft("broken")).toBeNull();
  });
});
