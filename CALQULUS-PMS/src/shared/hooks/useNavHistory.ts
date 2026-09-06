import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export interface NavPage {
  name: string;
  href: string;
  category?: string;
}

const DEFAULT_FAVORITES: NavPage[] = [
  { name: "Dashboard", href: "/", category: "Overview" },
  { name: "Properties", href: "/properties", category: "Portfolio" },
  { name: "Tenants", href: "/tenants", category: "Occupancy" },
  { name: "Billing", href: "/billing", category: "Collections" },
];

const ROUTE_NAME_MAP: Record<string, { name: string; category: string }> = {
  "/": { name: "Dashboard", category: "Overview" },
  "/properties": { name: "Properties", category: "Portfolio" },
  "/units": { name: "Units", category: "Portfolio" },
  "/landlords": { name: "Landlords", category: "Portfolio" },
  "/leases": { name: "Leases", category: "Occupancy" },
  "/tenants": { name: "Tenants", category: "Occupancy" },
  "/tenant-screening": { name: "Tenant Screening", category: "Occupancy" },
  "/invites": { name: "Invites", category: "Occupancy" },
  "/vacation-notices": { name: "Vacation Notices", category: "Occupancy" },
  "/billing": { name: "Billing", category: "Collections" },
  "/water-billing": { name: "Water Billing", category: "Collections" },
  "/statements": { name: "Statements", category: "Collections" },
  "/payments": { name: "Payment History", category: "Collections" },
  "/platform-billing": { name: "Platform Billing", category: "Account" },
  "/maintenance": { name: "Maintenance", category: "Operations" },
  "/contracts": { name: "Contracts", category: "Operations" },
  "/reports": { name: "Reports", category: "Operations" },
  "/settings": { name: "Settings", category: "Account" },
  "/webhost": { name: "Webhost Portal", category: "Webhost" },
  "/agency": { name: "Agency Portal", category: "Agency" },
  "/landlord/dashboard": { name: "Landlord Dashboard", category: "Landlord" },
  "/landlord/portfolio": { name: "Portfolio", category: "Landlord" },
  "/landlord/financials": { name: "Financials", category: "Landlord" },
  "/landlord/statements": { name: "Statements", category: "Landlord" },
  "/landlord/maintenance": { name: "Maintenance", category: "Landlord" },
  "/landlord/documents": { name: "Documents", category: "Landlord" },
  "/landlord/settings": { name: "Settings", category: "Landlord" },
  "/portal": { name: "Tenant Portal", category: "Tenant" },
};

const FAVORITES_STORAGE_KEY = "calqulus_pms_favorites_v1";
const RECENTS_STORAGE_KEY = "calqulus_pms_recents_v1";

export function useNavHistory() {
  const location = useLocation();

  const [favorites, setFavorites] = useState<NavPage[]>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_FAVORITES;
  });

  const [recents, setRecents] = useState<NavPage[]>(() => {
    try {
      const stored = localStorage.getItem(RECENTS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Track page visits
  useEffect(() => {
    const pathname = location.pathname;
    const match = ROUTE_NAME_MAP[pathname];

    if (!match) return;

    setRecents((prev) => {
      const filtered = prev.filter((item) => item.href !== pathname);
      const updated = [{ name: match.name, href: pathname, category: match.category }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, [location.pathname]);

  const toggleFavorite = (page: NavPage) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.href === page.href);
      const updated = exists
        ? prev.filter((item) => item.href !== page.href)
        : [...prev, page];

      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const isFavorite = (href: string) => favorites.some((item) => item.href === href);

  return {
    favorites,
    recents,
    toggleFavorite,
    isFavorite,
  };
}
