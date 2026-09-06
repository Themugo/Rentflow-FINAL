import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { DEV_PRESET_ACCOUNTS, isDevAccessEnabled } from '@/features/auth/lib/devAccess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/shared/hooks/use-toast';
import {
  Zap,
  Building2,
  Shield,
  User,
  Handshake,
  Home,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  LogOut,
  Sparkles,
  Droplet,
  Mail,
  FileText,
  PieChart,
  Settings,
  Layers,
  Globe2
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

interface AccountPreset {
  role: string;
  label: string;
  email: string;
  pass: string;
  defaultPath: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
}

const PRESET_PRESENTATION: Record<string, Pick<AccountPreset, 'icon' | 'badgeColor'>> = {
  manager: { icon: Building2, badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  webhost: { icon: Shield, badgeColor: 'bg-warning/20 text-amber-300 border-warning/30' },
  tenant: { icon: User, badgeColor: 'bg-success/20 text-success border-success/30' },
  agency: { icon: Handshake, badgeColor: 'bg-navy-mid/20 text-navy-mid border-navy-mid/30' },
  landlord: { icon: Home, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
};

const PRESET_ACCOUNTS: AccountPreset[] = DEV_PRESET_ACCOUNTS.map((preset) => ({
  ...preset,
  pass: preset.password,
  ...(PRESET_PRESENTATION[preset.role] ?? { icon: Building2, badgeColor: 'bg-muted text-foreground border-border' }),
}));

const DIRECT_LINKS = [
  { label: 'Landing Page', path: '/', icon: Globe2 },
  { label: 'Manager Overview', path: '/', icon: Building2 },
  { label: 'Water Billing', path: '/water-billing', icon: Droplet },
  { label: 'Tenant Invites', path: '/invites', icon: Mail },
  { label: 'Property Statements', path: '/statements', icon: FileText },
  { label: 'Manager Landlords', path: '/landlords', icon: Home },
  { label: 'Reports', path: '/reports', icon: PieChart },
  { label: 'Agency Portal', path: '/agency', icon: Handshake },
  { label: 'Webhost Dashboard', path: '/webhost', icon: Shield },
  { label: 'Tenant Portal', path: '/portal', icon: User },
  { label: 'Landlord Dashboard', path: '/landlord/dashboard', icon: Layers }
];

export function DevPortalSwitcher() {
  const devEnabled = isDevAccessEnabled();

  // Auto-open once per browser session in open-access dev mode so the
  // account options are immediately visible — closing it stores the flag.
  const [isOpen, setIsOpen] = useState(() => {
    return devEnabled && sessionStorage.getItem('dev-switcher-seen') !== '1';
  });
  const [switching, setSwitching] = useState(false);
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isOpen) sessionStorage.setItem('dev-switcher-seen', '1');
  }, [isOpen]);

  const handlePresetLogin = async (preset: AccountPreset) => {
    setSwitching(true);
    toast({ title: `Signing into ${preset.label}…` });
    try {
      if (user) {
        await supabase.auth.signOut();
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: preset.email,
        password: preset.pass
      });

      if (error) {
        toast({ title: `Login error: ${error.message}`, variant: 'destructive' });
      } else if (data.user) {
        toast({ title: `Logged in as ${preset.label}` });
        navigate(preset.defaultPath);
        setIsOpen(false);
      }
    } catch (err: unknown) {
      toast({ title: 'Switch failed. Check network.', variant: 'destructive' });
    } finally {
      setSwitching(false);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  // Development-only tool: never expose to normal users / production.
  // The literal `import.meta.env.PROD` check (redundant with `devEnabled`
  // above) is statically replaced by Vite at build time, so bundlers can
  // dead-code-eliminate this whole component body — and the preset
  // credentials it renders — out of production bundles.
  if (import.meta.env.PROD || !devEnabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 text-warning border-2 border-dashed border-warning shadow-xl hover:bg-slate-800 hover:border-amber-400 backdrop-blur-md text-xs font-bold transition-all group"
          title="DEV ONLY — Open Dev Account & Portal Switcher"
        >
          <Zap className="h-4 w-4 text-warning animate-pulse group-hover:scale-110 transition-transform" />
          <span>Dev Bypass & Account Switcher</span>
          <span className="px-2 py-0.5 rounded-full bg-warning text-[9px] font-extrabold uppercase tracking-wider text-slate-900 shadow-sm">
            ⚠ DEV ONLY
          </span>
          {userRole && (
            <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-[10px] uppercase font-bold text-amber-300">
              {userRole.role}
            </span>
          )}
          <ChevronUp className="h-3.5 w-3.5 text-white/60" />
        </button>
      ) : (
        <div className="w-80 sm:w-96 rounded-2xl bg-slate-900/95 border-2 border-dashed border-warning text-white shadow-2xl backdrop-blur-2xl p-4 transition-all">
          {/* Development-only banner */}
          <div className="flex items-center gap-2 mb-3 rounded-lg bg-warning/15 border border-warning px-2.5 py-1.5">
            <Zap className="h-3.5 w-3.5 text-warning shrink-0" />
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 leading-tight">
              ⚠ Development Only — not shown in production
            </p>
          </div>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-bold text-white tracking-wide">Quick Account & Portal Bypass</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10"
              aria-label="Close dev switcher"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Current session info */}
          <div className="mb-3 p-2.5 rounded-xl bg-navy-deep/80 border border-white/10 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Current Session</p>
              <p className="text-xs font-semibold text-white truncate">
                {user ? user.email : 'Not logged in (Public view)'}
              </p>
            </div>
            {userRole ? (
              <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-[10px] font-bold uppercase">
                {userRole.role}
              </Badge>
            ) : (
              <Badge className="bg-white/10 text-white/60 border-white/20 text-[10px] font-bold uppercase">
                Guest
              </Badge>
            )}
          </div>

          {/* One-click account presets */}
          <div className="space-y-1.5 mb-4">
            <p className="text-[11px] text-amber-300/80 font-bold uppercase tracking-wider px-1">
              ⚡ 1-Click Login as Any Account
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {PRESET_ACCOUNTS.map((preset) => {
                const Icon = preset.icon;
                const isCurrent = userRole?.role === preset.role || user?.email === preset.email;
                return (
                  <button
                    key={preset.role}
                    disabled={switching}
                    onClick={() => handlePresetLogin(preset)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? 'bg-amber-400/15 border-amber-400/50 text-white font-bold'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-amber-400/30 text-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-slate-800 text-warning border border-white/10">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-none text-white">{preset.label}</p>
                        <p className="text-[10px] text-white/50 truncate mt-0.5">{preset.email}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                      {isCurrent ? 'Active' : 'Switch'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct page navigation shortcuts */}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <p className="text-[11px] text-white/60 font-bold uppercase tracking-wider px-1">
              🚀 Direct Route Jumpers
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {DIRECT_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => handleNavigate(link.path)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] text-left transition-all ${
                      isActive
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/80'
                    }`}
                  >
                    <Icon className="h-3 w-3 text-warning flex-shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="h-7 text-xs border-white/20 bg-white/5 hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/40"
              >
                <LogOut className="h-3 w-3 mr-1" /> Log Out
              </Button>
            )}
            <button
              onClick={() => handleNavigate('/landlord')}
              className="text-[11px] text-warning hover:underline flex items-center gap-1 ml-auto font-medium"
            >
              Sign-In Page <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
