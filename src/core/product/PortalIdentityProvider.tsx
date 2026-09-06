import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { portalFromAppRole, type PortalId } from "./portals";
import { DEFAULT_PORTAL_IDENTITIES, portalIdentityFromRow, type PortalIdentity } from "./portalIdentity";
import { useAuth } from "@/features/auth/AuthContext";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";

interface PortalIdentityContextValue {
  portalId: PortalId;
  identity: PortalIdentity;
  identities: Record<PortalId, PortalIdentity>;
  isLoading: boolean;
  themeMode: "portal" | "white";
  setThemeMode: (mode: "portal" | "white") => void;
}

const PortalIdentityContext = createContext<PortalIdentityContextValue>({
  portalId: "manager",
  identity: DEFAULT_PORTAL_IDENTITIES.manager,
  identities: DEFAULT_PORTAL_IDENTITIES,
  isLoading: false,
  themeMode: "portal",
  setThemeMode: () => {},
});

export function portalFromPath(pathname: string): PortalId {
  if (pathname.startsWith("/landlord")) return "landlord";
  if (pathname.startsWith("/agency")) return "agency";
  if (pathname.startsWith("/tenant") || pathname.startsWith("/portal")) return "tenant";
  if (pathname.startsWith("/webhost")) return "platform_admin";
  return "manager";
}

export function usePortalIdentity() {
  return useContext(PortalIdentityContext);
}

export function PortalIdentityProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, userRole } = useAuth();
  // The URL is the source of truth for the currently selected portal.
  // AuthContext independently re-picks the matching role for multi-role users.
  const portalId = portalFromPath(location.pathname) || portalFromAppRole(userRole?.role) || "manager";
  const fallback = DEFAULT_PORTAL_IDENTITIES[portalId];
  const themeStorageKey = user?.id ? `calqulus-portal-theme:${user.id}:${portalId}` : `calqulus-portal-theme:guest:${portalId}`;
  const [themeMode, setThemeModeState] = React.useState<"portal" | "white">(() => {
    try {
      return localStorage.getItem(themeStorageKey) === "white" ? "white" : "portal";
    } catch { return "portal"; }
  });

  React.useEffect(() => {
    try {
      setThemeModeState(localStorage.getItem(themeStorageKey) === "white" ? "white" : "portal");
    } catch { setThemeModeState("portal"); }
  }, [themeStorageKey]);

  const setThemeMode = React.useCallback((mode: "portal" | "white") => {
    setThemeModeState(mode);
    try { localStorage.setItem(themeStorageKey, mode); } catch {}
  }, [themeStorageKey]);

  const { data: identities = DEFAULT_PORTAL_IDENTITIES, isLoading } = useQuery({
    queryKey: ["portal-identities"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase.from as any)("platform_portal_identities")
        .select("portal_id,display_name,short_name,tagline,primary_hex,background_image_url");
      if (error) throw error;
      const resolved = { ...DEFAULT_PORTAL_IDENTITIES };
      for (const row of rows ?? []) {
        if (row?.portal_id && row.portal_id in resolved) {
          const id = row.portal_id as PortalId;
          resolved[id] = portalIdentityFromRow(row, id);
        }
      }
      return resolved;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const identity = identities[portalId] ?? fallback;
  const palette = deriveBrandPalette(themeMode === "white" ? "#16324F" : identity.primaryHex);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.activePortal = portalId;
    if (palette.approved) {
      root.style.setProperty("--portal-primary", palette.hex);
      root.style.setProperty("--portal-accent", palette.hex);
      root.style.setProperty("--portal-accent-muted", palette.muted);
      root.style.setProperty("--portal-accent-border", palette.border);
      root.style.setProperty("--portal-accent-surface", palette.surface);
      root.style.setProperty("--portal-accent-foreground", palette.onColor);
      root.style.setProperty("--portal-primary-hover", palette.hover);
      root.style.setProperty("--portal-primary-active", palette.active);
      root.style.setProperty("--portal-primary-muted", palette.muted);
      root.style.setProperty("--portal-primary-border", palette.border);
      root.style.setProperty("--portal-primary-surface", palette.surface);
      root.style.setProperty("--portal-primary-focus", palette.focus);
      root.style.setProperty("--portal-primary-foreground", palette.onColor);
    }
    return () => {
      root.removeAttribute("data-active-portal");
      ["--portal-primary", "--portal-primary-hover", "--portal-primary-active", "--portal-primary-muted", "--portal-primary-border", "--portal-primary-surface", "--portal-primary-focus", "--portal-primary-foreground", "--portal-accent", "--portal-accent-muted", "--portal-accent-border", "--portal-accent-surface", "--portal-accent-foreground"].forEach((name) => root.style.removeProperty(name));
    };
  }, [palette, portalId]);

  const value = useMemo(() => ({ portalId, identity, identities, isLoading, themeMode, setThemeMode }), [portalId, identity, identities, isLoading, themeMode, setThemeMode]);
  return <PortalIdentityContext.Provider value={value}>{children}</PortalIdentityContext.Provider>;
}
