import { describe, expect, it } from "vitest";
import { filterPublicListings } from "@/features/marketing/PublicPropertyDiscoveryPage";

describe("public property discovery filtering", () => {
  const listings = [
    { title: "Sunset Apartments", location: "Westlands, Nairobi", detail: "2 bedrooms", price: "KES 45,000/mo" },
    { title: "Executive Towers", location: "Upper Hill, Nairobi", detail: "Premium offices", price: "KES 120,000/mo" },
    { title: "Greenfield Estate", location: "Ruiru, Kiambu", detail: "Gated community", price: "KES 12,000,000" },
  ];

  it("filters by title, location, details or price", () => {
    expect(filterPublicListings(listings, "Westlands")).toHaveLength(1);
    expect(filterPublicListings(listings, "office")).toHaveLength(1);
    expect(filterPublicListings(listings, "45,000")).toHaveLength(1);
    expect(filterPublicListings(listings, "")).toHaveLength(3);
  });
});
