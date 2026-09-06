import { Suspense, useCallback, useEffect } from "react";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DesktopInstallBanner } from "@/shared/components/ui/desktop-install-banner";
import { MobileInstallBanner } from "@/shared/components/ui/mobile-install-banner";
import { PushNotificationPrompt } from "@/shared/components/ui/push-notification-prompt";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth, type AppRole } from "@/features/auth/AuthContext";
import { ViewOnlyProvider } from "@/shared/contexts/ViewOnlyContext";
import { ThemeProvider } from "@/shared/contexts/ThemeContext";
import ProtectedRoute from "@/shared/components/ProtectedRoute";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { PageLoader } from "@/shared/components/PageLoader";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import {
  isDesignPreviewPath,
  designPreviewPublicRoutes,
  roleRouteConfigs,
  publicRoutes,
  adminDomainRoutes,
  authOnlyRoutes,
  fallbackRoutes,
  type RouteDef,
} from "@/app/routes";
import { DevPortalSwitcher } from "@/shared/components/DevPortalSwitcher";
import { STALE_TIMES } from "@/shared/hooks/useOptimizedQuery";
import { WhiteLabelProvider } from "@/core/whiteLabel/WhiteLabelProvider";
import { PortalIdentityProvider } from "@/core/product/PortalIdentityProvider";
import PortalDeviceGate from "@/shared/components/PortalDeviceGate";

// Optimized QueryClient with better caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.frequentlyChanging, // 30 seconds
      gcTime: 10 * 60 * 1000, // 10 minutes cache
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Route prefetching component - uses useManagerScope
const RoutePrefetcher = () => {
  const location = useLocation();
  const { managerId, isReady } = useManagerScope();

  // Prefetch likely next routes based on current path
  useEffect(() => {
    if (!isReady || !managerId) return;

    // Prefetch based on current route
    const path = location.pathname;

    if (path === "/") {
      // The dashboard mounts lazy recharts charts immediately; warming the
      // chunk during the initial data fetch removes the waterfall between
      // stats arriving and charts painting (requestIdleCallback with a
      // timeout fallback so startup work is never blocked).
      const warmCharts = () => {
        void import("@/features/dashboard/components/RevenueChart");
      };
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(warmCharts, { timeout: 2000 });
      } else {
        setTimeout(warmCharts, 500);
      }

      // On dashboard, prefetch properties and tenants
      queryClient.prefetchQuery({
        queryKey: ['properties', 'list', managerId],
        queryFn: async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase
            .from('properties')
            .select('id, name, address, units, occupied, revenue, image_url, status, created_at')
            .eq('manager_id', managerId)
            .neq('status', 'inactive');
          return data ?? [];
        },
        staleTime: STALE_TIMES.frequentlyChanging,
      });

      queryClient.prefetchQuery({
        queryKey: ['tenants', 'list', managerId],
        queryFn: async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase
            .from('tenants')
            .select('id, name, email, status, property_id, unit')
            .eq('manager_id', managerId);
          return data ?? [];
        },
        staleTime: STALE_TIMES.frequentlyChanging,
      });
    }

    if (path.startsWith("/properties")) {
      // Prefetch tenants when viewing properties
      queryClient.prefetchQuery({
        queryKey: ['tenants', 'list', managerId],
        queryFn: async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase
            .from('tenants')
            .select('id, name, email, status, property_id, unit')
            .eq('manager_id', managerId);
          return data ?? [];
        },
        staleTime: STALE_TIMES.frequentlyChanging,
      });
    }
  }, [location.pathname, managerId, isReady]);

  return null;
};

// ── Route rendering helpers ─────────────────────────────────────────
const LazyRoute = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

const renderRoute = (route: RouteDef, allowedRoles?: AppRole[]) => {
  if (route.redirect) {
    return <Route key={route.path} path={route.path} element={<Navigate to={route.redirect} replace />} />;
  }
  if (!route.element) return null;

  const element = (
    <LazyRoute>
      <route.element />
    </LazyRoute>
  );

  if (route.protected && allowedRoles) {
    return (
      <Route
        key={route.path}
        path={route.path}
        element={
          <ProtectedRoute
            allowedRoles={allowedRoles}
            permission={route.permission}
            requirePermission={route.requirePermission}
            minAdminLevel={route.minAdminLevel}
          >
            {element}
          </ProtectedRoute>
        }
      />
    );
  }

  return <Route key={route.path} path={route.path} element={element} />;
};

// ── Role-based route renderer ───────────────────────────────────────
const RoleRoutes = ({ role, allowedRoles, wrapper }: {
  role: string;
  allowedRoles: AppRole[];
  wrapper?: string;
}) => {
  const config = roleRouteConfigs.find(c => c.role === role);
  if (!config) return null;

  const routes = config.routes.map(r => renderRoute(r, allowedRoles));

  const content = <Routes>{routes}</Routes>;

  if (wrapper === "viewOnly") {
    return <ViewOnlyProvider>{content}</ViewOnlyProvider>;
  }

  return content;
};

// ── Main route dispatcher ───────────────────────────────────────────
const AppRoutes = () => {
  const { user, loading, userRole, devAccessEnabled } = useAuth();
  const location = useLocation();
  const isAdminDomain = window.location.hostname.startsWith("admin.");
  const recoveryHash =
    window.location.hash.includes("type=recovery") ||
    window.location.hash.includes("access_token=");
  
  if (recoveryHash && window.location.pathname !== "/reset-password") {
    return (
      <Navigate
        to={`/reset-password${window.location.search}${window.location.hash}`}
        replace
      />
    );
  }

  if (loading) return <PageLoader />;

  if (isDesignPreviewPath(location.pathname)) {
    return <Routes>{designPreviewPublicRoutes.map((route) => renderRoute(route))}</Routes>;
  }

  // Open-access dev mode: route by URL path so every portal renders
  // directly with no login wall. The auto-login and account switcher
  // still provide a real session (for data); the path just decides
  // which portal's routes are shown.
  if (devAccessEnabled) {
    const path = location.pathname;
    if (path === "/landing" || path === "/welcome") {
      return <Routes>{publicRoutes.map(r => renderRoute(r))}</Routes>;
    }
    const devRole =
      path.startsWith("/webhost") ? "webhost" :
      path.startsWith("/agency") ? "agency" :
      path.startsWith("/portal") ? "tenant" :
      path.startsWith("/landlord") ? "landlord" :
      "manager";
    return <RoleRoutes role={devRole} allowedRoles={[devRole as AppRole]} />;
  }

  // User logged in but role not yet resolved
  if (user && !userRole) {
    return <Routes>{authOnlyRoutes.map(r => renderRoute(r))}</Routes>;
  }

  // Webhost — allow from any domain (not just admin.* subdomain)
  if (userRole?.role === "webhost") {
    return <RoleRoutes role="webhost" allowedRoles={["webhost"]} />;
  }

  // Submanager
  if (userRole?.role === "submanager") {
    return <RoleRoutes role="submanager" allowedRoles={["submanager"]} wrapper="viewOnly" />;
  }

  // Landlord
  if (userRole?.role === "landlord") {
    return <RoleRoutes role="landlord" allowedRoles={["landlord"]} />;
  }

  // Tenant
  if (userRole?.role === "tenant") {
    return <RoleRoutes role="tenant" allowedRoles={["tenant"]} />;
  }

  // Agency (pending/rejected)
  if (!devAccessEnabled && userRole?.role === "agency" && userRole.approval_status !== "approved") {
    return <RoleRoutes role="manager-pending" allowedRoles={["agency"]} />;
  }

  // Agency (approved) — dev access mode treats every account as approved
  if (userRole?.role === "agency" && (devAccessEnabled || userRole.approval_status === "approved")) {
    return <RoleRoutes role="agency" allowedRoles={["agency"]} />;
  }

  // Manager (pending/rejected)
  if (!devAccessEnabled && userRole?.role === "manager" && userRole.approval_status !== "approved") {
    return <RoleRoutes role="manager-pending" allowedRoles={["manager"]} />;
  }

  // Manager (approved)
  if (userRole?.role === "manager" && (devAccessEnabled || userRole.approval_status === "approved")) {
    return <RoleRoutes role="manager" allowedRoles={["manager"]} />;
  }

  // Not logged in
  if (!user) {
    const routes = isAdminDomain ? adminDomainRoutes : publicRoutes;
    return <Routes>{routes.map(r => renderRoute(r))}</Routes>;
  }

  // Fallback
  return <Routes>{fallbackRoutes.map(r => renderRoute(r))}</Routes>;
};

// ── App root ────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <ErrorBoundary fallback={null}>
          <Toaster />
        </ErrorBoundary>
        <ErrorBoundary fallback={null}>
          <DesktopInstallBanner />
        </ErrorBoundary>
        <ErrorBoundary fallback={null}>
          <MobileInstallBanner />
        </ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <PortalIdentityProvider>
              <WhiteLabelProvider>
              <ErrorBoundary fallback={null}>
                <PushNotificationPrompt />
              </ErrorBoundary>
              <RoutePrefetcher />
              <ErrorBoundary>
                <PortalDeviceGate><AppRoutes /></PortalDeviceGate>
              </ErrorBoundary>
              <DevPortalSwitcher />
              </WhiteLabelProvider>
            </PortalIdentityProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
