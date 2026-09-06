import type { BrandConfig, BrandTerm } from "./BrandConfig";

export function term(config: BrandConfig, key: BrandTerm): string {
  const value = config.terminology[key]?.trim();
  return value || fallbackTerm(key);
}

function fallbackTerm(key: BrandTerm): string {
  switch (key) {
    case "property":
      return "Property";
    case "tenant":
      return "Tenant";
    case "landlord":
      return "Landlord";
    case "manager":
      return "Manager";
  }
}
