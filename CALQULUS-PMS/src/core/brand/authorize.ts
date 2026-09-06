/** Organization Brand Studio may only be saved by the account that owns company_settings. */
export const ORG_BRAND_EDITOR_ROLES = ["manager", "agency"] as const;

export type OrgBrandEditorRole = (typeof ORG_BRAND_EDITOR_ROLES)[number];

export function canEditOrgBrand(role: string | null | undefined): boolean {
  return role === "manager" || role === "agency";
}
