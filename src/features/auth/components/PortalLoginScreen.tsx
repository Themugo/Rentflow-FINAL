import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { portalSurfaceProps } from "@/core/design";
import { usePublicSiteConfig } from "@/features/marketing/hooks/usePublicSiteConfig";
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";
import { DEFAULT_PUBLIC_SITE_CONFIG } from "@/features/marketing/publicSiteConfig";
import ForgotPasswordDialog from "@/features/auth/components/ForgotPasswordDialog";

/**
 * Shared login-screen chrome for all four portals (manager, landlord,
 * tenant, agency). Each portal keeps its own identity — accent color,
 * background photo, icon and copy — but the layout, the auth card and its
 * fields are one shared implementation so all four screens stay visually
 * and functionally consistent. Matches the approved reference design: a
 * full-height identity panel beside a "Welcome Back!" sign-in card with
 * email/password, remember-me, a colored login button, and a Google
 * sign-in option.
 */

/** Multicolor Google "G" mark — the standard four-color glyph. */
export function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 34.7 26.9 36 24 36c-5.3 0-9.6-3.1-11.3-7.6l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C39.9 37.4 44 31.6 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

interface PortalLoginLayoutProps {
  portalId: "manager" | "landlord" | "tenant" | "agency";
  accentHex: string;
  backgroundImage: string;
  badgeIcon: ComponentType<{ className?: string }>;
  /** e.g. "Manager" — primary portal heading. */
  portalName: string;
  /** Marketable portal slogan shown prominently under the portal name. */
  slogan?: string;
  /** Optional explicit headline lines for a portal-specific entry treatment. */
  headlineLines?: string[];
  description: string;
  features?: Array<{ icon: ComponentType<{ className?: string }>; label: string; text: string }>;
  trustLabel?: string;
  children: ReactNode;
}

export function PortalLoginLayout({
  portalId,
  accentHex,
  backgroundImage,
  badgeIcon: BadgeIcon,
  portalName,
  slogan,
  headlineLines,
  description,
  features = [],
  trustLabel = "Secure workspace · Connected property operations",
  children,
}: PortalLoginLayoutProps) {
  const { data = DEFAULT_PUBLIC_SITE_CONFIG } = usePublicSiteConfig();
  const brand = data.brand;
  const { identities } = usePortalIdentity();
  const identity = identities[portalId];
  const resolvedAccent = identity?.primaryHex || accentHex;
  const resolvedBackgroundImage = identity?.backgroundImageUrl || backgroundImage;
  const resolvedPortalName = identity?.shortName || portalName;
  const resolvedSlogan = slogan || identity?.tagline || description;
  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white" {...portalSurfaceProps(portalId)}>
      <div className="absolute inset-0" aria-hidden>
        <img src={resolvedBackgroundImage} alt="" loading="eager" decoding="async" className="h-full w-full object-cover object-center" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(105deg, ${resolvedAccent}E8 0%, ${resolvedAccent}B8 29%, ${resolvedAccent}55 53%, rgba(7,21,47,0.18) 73%, rgba(7,21,47,0.56) 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_16%,rgba(255,255,255,0.16),transparent_26%),radial-gradient(circle_at_10%_88%,rgba(255,255,255,0.09),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,18,38,0.42),transparent_30%,rgba(3,18,38,0.16))]" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10 xl:px-14">
          <Link to={PUBLIC_ROUTES.home} aria-label="CALQULUS home"><BrandMark size="nav" showWordmark subtitleOverride={brand.descriptor} wordmarkOverride={brand.name} logoUrl={brand.logoUrl} inverse forcePlatform /></Link>
          <div className="flex items-center gap-2">
            <Link to={PUBLIC_ROUTES.portalAccess} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">Change portal</Link>
            <Link to={PUBLIC_ROUTES.home} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">Back to CALQULUS</Link>
          </div>
        </header>
        <main className="flex flex-1 items-center px-4 pb-7 sm:px-7 lg:px-10 xl:px-14">
          <div className="mx-auto grid w-full max-w-[1500px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] xl:gap-14">
            <section className="flex min-h-0 flex-col justify-center px-2 py-8 sm:min-h-[500px] sm:px-4 lg:min-h-[calc(100vh-122px)] lg:py-10">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold tracking-[0.24em] text-white/95 backdrop-blur-md"><BadgeIcon className="h-4 w-4" aria-hidden />{resolvedPortalName.toUpperCase()} PORTAL</div>
                <h1 className="mt-6 max-w-3xl font-heading text-[clamp(2.7rem,5.6vw,5.35rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.24)]">{(headlineLines ?? [resolvedPortalName]).map((line) => <span key={line} className="block">{line}</span>)}</h1>
                <p className="mt-4 max-w-3xl font-heading text-[clamp(1.45rem,2.45vw,2.2rem)] font-medium leading-[1.1] tracking-[-0.03em] text-white/96">{resolvedSlogan}</p>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/86 sm:text-lg sm:leading-8">{description}</p>
                {trustLabel ? <div className="mt-6 flex w-fit items-center gap-2.5 rounded-xl border border-white/16 bg-black/10 px-4 py-3 text-xs font-semibold text-white/92 backdrop-blur-md"><span className="h-2 w-2 rounded-full bg-white/80" aria-hidden />{trustLabel}</div> : null}
                {features.length ? <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">{features.map(({ icon: Icon, label, text }) => <div key={label} className="min-w-0 rounded-2xl border border-white/12 bg-black/10 p-4 shadow-lg backdrop-blur-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10"><Icon className="h-5 w-5" aria-hidden /></div><p className="mt-3 text-sm font-bold text-white">{label}</p><p className="mt-1 text-sm leading-5.5 text-white/72">{text}</p></div>)}</div> : null}
              </div>
            </section>
            <aside className="relative flex items-center justify-center lg:py-8" aria-label={`${resolvedPortalName} sign in`}>
              <div className="absolute inset-x-6 inset-y-8 rounded-[38px] bg-white/8 blur-3xl" aria-hidden />
              <div className="relative w-full max-w-md rounded-[28px] border border-white/20 bg-white/96 p-1 shadow-[0_28px_90px_rgba(2,15,28,0.42)] backdrop-blur-xl"><div className="rounded-[24px] border border-slate-200/80 bg-white p-2 sm:p-3">{children}</div></div>
            </aside>
          </div>
        </main>
        <footer className="flex items-center justify-between gap-4 border-t border-white/12 bg-black/5 px-5 py-4 text-xs text-white/70 sm:px-8 lg:px-10 xl:px-14"><span>© {new Date().getFullYear()} CALQULUS Limited</span><span className="font-medium text-white/80">{resolvedPortalName} workspace</span></footer>
      </div>
    </div>
  );
}

interface PortalLoginCardProps {
  accentHex: string;
  /** Darker/deeper shade for small text on light surfaces, if the base accent is too light. */
  accentTextHex?: string;
  /** e.g. "manager" — used in "Sign in to your manager portal". */
  portalLabel: string;
  email: string;
  onEmailChange: (value: string) => void;
  emailPlaceholder?: string;
  password: string;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  rememberMe: boolean;
  onRememberMeChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  onGoogleSignIn: () => void;
  isGoogleSubmitting?: boolean;
  forgotPasswordVariant?: "tenant";
  /** Extra content rendered below the form and the secure-access footer — e.g. signup links, invite notes. */
  footNote?: ReactNode;
}

export function PortalLoginCard({
  accentHex,
  accentTextHex,
  portalLabel,
  email,
  onEmailChange,
  emailPlaceholder = "you@example.com",
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  rememberMe,
  onRememberMeChange,
  onSubmit,
  isSubmitting,
  submitLabel = "Login",
  submittingLabel = "Signing in…",
  onGoogleSignIn,
  isGoogleSubmitting = false,
  forgotPasswordVariant,
  footNote,
}: PortalLoginCardProps) {
  const { identities } = usePortalIdentity();
  const isKnownPortal = (value: string): value is "manager" | "landlord" | "tenant" | "agency" => ["manager", "landlord", "tenant", "agency"].includes(value);
  const identity = isKnownPortal(portalLabel) ? identities[portalLabel] : undefined;
  const resolvedAccent = identity?.primaryHex || accentHex;
  const linkColor = accentTextHex || resolvedAccent;
  return (
    <section
      className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/10 sm:p-8"
      aria-label={`${portalLabel} sign in`}
    >
      <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-[26px]">Welcome Back!</h2>
      <p className="mt-1 text-[15px] leading-6 text-muted-foreground">Sign in to your {portalLabel} portal</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="portal-login-email" className="text-[15px] font-medium text-foreground">
            Email address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="portal-login-email"
              type="email"
              placeholder={emailPlaceholder}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              className="h-11 border-border bg-card pl-10 text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="portal-login-password" className="text-[15px] font-medium text-foreground">
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="portal-login-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
              className="h-11 border-border bg-card pl-10 pr-11 text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={onToggleShowPassword}
              className="absolute right-1.5 top-1/2 inline-flex h-11 min-h-11 w-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => onRememberMeChange(checked as boolean)}
              aria-label="Remember me"
            />
            Remember me
          </label>
          <ForgotPasswordDialog
            variant={forgotPasswordVariant}
            trigger={
              <button type="button" className="text-sm font-semibold hover:underline" style={{ color: linkColor }}>
                Forgot password?
              </button>
            }
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full text-[15px] font-semibold text-white hover:brightness-110"
          style={{ backgroundColor: resolvedAccent }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {submittingLabel}
            </span>
          ) : (
            submitLabel
          )}
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onGoogleSignIn}
        disabled={isGoogleSubmitting}
        className="h-11 w-full gap-2 border-border bg-card text-[15px] font-medium text-foreground hover:bg-secondary"
      >
        {isGoogleSubmitting ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        ) : (
          <GoogleGlyph className="h-4 w-4" />
        )}
        Sign in with Google
      </Button>

      <p className="mt-5 text-center text-sm text-muted-foreground">🔒 Secure • Encrypted • Protected</p>

      {footNote ? <div className="mt-5 border-t border-border pt-5">{footNote}</div> : null}
    </section>
  );
}
