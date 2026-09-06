import { describe, expect, it } from "vitest";
import {
  isSettingsPanelId,
  SETTINGS_GROUP_LABELS,
  SETTINGS_GROUPS,
  findSettingsItem,
} from "@/features/settings/lib/settingsGroups";

describe("settings groups", () => {
  it("exposes the eight named groups and only existing panels", () => {
    expect(SETTINGS_GROUP_LABELS).toEqual([
      "Organization",
      "Users",
      "Roles",
      "Notifications",
      "Billing",
      "Integrations",
      "Security",
      "Branding",
    ]);
    expect(findSettingsItem("company")?.label).toBe("Company details");
    expect(findSettingsItem("branding")?.id).toBe("branding");
    expect(findSettingsItem("platform-billing")?.href).toBe("/platform-billing");
    expect(isSettingsPanelId("platform-billing")).toBe(false);
    expect(isSettingsPanelId("payments")).toBe(true);
    expect(SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.id))).toEqual([
      "company",
      "currency",
      "date-time",
      "profile",
      "submanagers",
      "roles",
      "notifications",
      "reminders",
      "payments",
      "receipts",
      "platform-billing",
      "bank-integration",
      "password",
      "cache",
      "branding",
    ]);
  });
});
