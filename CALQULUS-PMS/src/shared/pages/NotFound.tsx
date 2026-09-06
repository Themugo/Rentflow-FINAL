import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { logError } from "@/shared/lib/errorLogger";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";
import { BrandMark } from "@/shared/components/branding/BrandMark";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole } = useAuth();

  useEffect(() => {
    logError('404', location.pathname);
  }, [location.pathname]);

  const homeLink = () => {
    if (!userRole) return '/auth';
    switch (userRole.role) {
      case 'tenant':     return '/portal';
      case 'landlord':   return '/landlord/dashboard';
      case 'webhost':    return '/webhost';
      case 'submanager': return '/';
      case 'agency':     return '/agency';
      case 'payer':      return '/payer';
      default:           return '/';
    }
  };

  const roleLabel = () => {
    if (!userRole) return null;
    const map: Record<string, string> = {
      tenant: 'Tenant Portal', landlord: 'Landlord Portal',
      webhost: 'Admin Portal', submanager: 'Dashboard',
      agency: 'Agency Portal', manager: 'Dashboard',
    };
    return map[userRole.role] ?? 'Dashboard';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center hero-gradient px-4">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: `linear-gradient(hsl(220 87% 51% / 0.4) 1px, transparent 1px),
                          linear-gradient(90deg, hsl(220 87% 51% / 0.4) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      <div className="relative z-10 text-center max-w-md w-full">
        <div className="flex justify-center mb-10">
          <BrandMark size="lg" />
        </div>

        <div className="relative mb-6">
          <p className="font-heading text-[120px] sm:text-[160px] font-bold leading-none select-none text-primary/15">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-[var(--radius)] bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Search className="h-8 w-8 text-primary/60" />
            </div>
          </div>
        </div>

        <h1 className="type-page-title mb-3">Page not found</h1>
        <p className="type-body text-muted-foreground mb-2">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border mb-8">
          <code className="text-muted-foreground text-xs font-mono">{location.pathname}</code>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:bg-white/8 hover:text-foreground gap-2"
            onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button
            className="btn-brand font-semibold gap-2"
            onClick={() => navigate(homeLink())}>
            <Home className="h-4 w-4" />
            {roleLabel() ? `Back to ${roleLabel()}` : 'Return to home'}
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-12 text-muted-foreground text-xs">
          calqulus.site · If this keeps happening, contact your administrator.
        </p>
      </div>
    </div>
  );
};

export default NotFound;
