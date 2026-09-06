import propertyResidential from "@/assets/marketing/property-residential.webp";
import propertyCommercial from "@/assets/marketing/property-commercial.webp";
import propertyOffice from "@/assets/marketing/property-office.webp";
import propertyResidentialThumb from "@/assets/marketing/property-residential-thumb.webp";
import propertyOfficeThumb from "@/assets/marketing/property-office-thumb.webp";
import type { PropertyVisualSlot } from "@/features/marketing/components/ArchitecturalSurface";

/**
 * Real Kenyan property photography (Unsplash License):
 * residential — The Alma, Nairobi (Cytonn Photography)
 * commercial — Nairobi residential development (Cytonn Photography)
 * office — Nairobi city high-rise (Isaac Mugwe)
 * Locally bundled WebP; never remote URLs.
 */
export const PROPERTY_IMAGES: Record<PropertyVisualSlot, string> = {
  residential: propertyResidential,
  commercial: propertyCommercial,
  office: propertyOffice,
};

export const PROPERTY_THUMBS: Record<"residential" | "office", string> = {
  residential: propertyResidentialThumb,
  office: propertyOfficeThumb,
};
