import { useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Handshake, Home, Users, Check, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { signupSchema, formatValidationErrors } from "@/shared/lib/validations";
import { sanitizeAuthError } from "@/features/auth/lib/authFlow";
import type { PortalAuthFeature, PortalSwitchLink } from "@/features/auth/components/AuthHeroChrome";
import type { AppRole } from "@/features/auth/AuthContext";
import { cn } from "@/shared/lib/utils";
import type { PortalId } from "@/core/product/portals";

/**
 * Registration preview — role-choice → compact form.
 * Backend wiring stays at the portal entry points; this page is the
 * design preview for the unified registration experience. Admin and
 * WebHost are intentionally not selectable (invitation-only).
 */

type PublicRole = "manager" | "landlord" | "agency" | "tenant";

interface RoleOption {
  id: PublicRole;
  portal: PortalId;
  icon: ComponentType<{ className?: string }>;
  title: string;
  oneLiner: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { id: "manager", portal: "manager", icon: Building2, title: "Property Manager", oneLiner: "Run property operations and manage your portfolio." },
  { id: "landlord", portal: "landlord", icon: Handshake, title: "Landlord", oneLiner: "Monitor properties, income and performance." },
  { id: "agency", portal: "agency", icon: Users, title: "Agency", oneLiner: "Manage clients, portfolios and property operations." },
  { id: "tenant", portal: "tenant", icon: Home, title: "Tenant", oneLiner: "Access your property, payments and services." },
];

const PORTAL_DEST: Record<PublicRole, { loginPath: string }> = {
  manager: { loginPath: "/auth" },
  landlord: { loginPath: "/landlord/login" },
  agency: { loginPath: "/agency/login" },
  tenant: { loginPath: "/tenant/login" },
};

const FEATURES: Record<PublicRole, PortalAuthFeature[]> = {
  manager: [
    { icon: Building2, text: "Properties", detail: "Units, occupancy and leases." },
    { icon: Users, text: "Tenants", detail: "Moves in, notices, invitations." },
    { icon: Check, text: "Collections", detail: "Payments and billing." },
  ],
  landlord: [
    { icon: Handshake, text: "Portfolio", detail: "Income at a glance." },
    { icon: Check, text: "Revenue", detail: "Collected vs expected." },
    { icon: Check, text: "Occupancy", detail: "By property." },
  ],
  agency: [
    { icon: Users, text: "Clients", detail: "Commission-managed properties." },
    { icon: Building2, text: "Operations", detail: "Run properties for owners." },
    { icon: Check, text: "Reports", detail: "Portfolio oversight." },
  ],
  tenant: [
    { icon: Home, text: "Home", detail: "Lease, deposit and notices." },
    { icon: Check, text: "Payments", detail: "Receipts and statements." },
    { icon: Check, text: "Repairs", detail: "Open and resolved." },
  ],
};

const OTHER_PORTALS_FOR: (current: PublicRole) => PortalSwitchLink[] = (current) =>
  ROLE_OPTIONS.filter((opt) => opt.id !== current).map((opt) => ({ label: opt.title, href: PORTAL_DEST[opt.id].loginPath }));

const passwordCheck = (pw: string) => ({
  length: pw.length >= 8,
  upper: /[A-Z]/.test(pw),
  lower: /[a-z]/.test(pw),
  number: /[0-9]/.test(pw),
  special: /[^A-Za-z0-9]/.test(pw),
});

export default function RegisterExperience() {
  const navigate = useNavigate();
  const { signUp: _unused } = useAuth();
  const { toast } = useToast();
  const [role, setRole] = useState<PublicRole>("manager");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const option = useMemo(() => ROLE_OPTIONS.find((opt) => opt.id === role)!, [role]);
  const features = FEATURES[role];
  const oneLine = option.oneLiner;
  const specialCheck = passwordCheck(password);

  const roleOptionButton = (opt: RoleOption) => {
    const active = opt.id === role;
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() => setRole(opt.id)}
        aria-pressed={active}
        className={cn(
          "w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active
            ? "border-primary/60 bg-primary/6"
            : "border-border bg-card hover:border-primary/30 hover:bg-soft-blue",
        )}
      >
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--portal-accent)]",
              active ? "bg-primary/12" : "bg-soft-blue",
            )}
          >
            <opt.icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">{opt.title}</span>
            <span className="block text-xs text-muted-foreground">{opt.oneLiner}</span>
          </span>
          {active ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
        </span>
      </button>
    );
  };

  const validateEmail = (value: string) => {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const onEmail = (value: string) => {
    setEmail(value);
    setEmailError(value && !validateEmail(value) ? "Please enter a valid email address" : "");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (emailError) return;
    setIsSubmitting(true);
    const validation = signupSchema.safeParse({ email, password, fullName });
    if (!validation.success) {
      toast({ title: "Validation error", description: formatValidationErrors(validation.error), variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    // Role-locked routes: the preview redirects to the correct portal
    // login to invoke its own signup flow. Admin/WebHost are never enrolled.
    toast({ title: "One step closer", description: `Continue as ${option.title}.` });
    navigate(PORTAL_DEST[role].loginPath);
    setIsSubmitting(false);
  };

  return (
    <div className="structured-bg desk-canvas min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <div className="relative hidden lg:flex lg:w-[54%] flex-col p-10 xl:p-12">
          <div className="mb-10 flex items-center justify-between gap-4">
            <a href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="font-heading text-lg font-bold uppercase tracking-wide text-foreground">CALQULUS</span>
              <span className="block text-xs font-medium text-muted-foreground">Property operations</span>
            </a>
            <a href="/" className="text-xs font-medium text-muted-foreground hover:text-primary">
              Back to home
            </a>
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-5 inline-flex items-center gap-2 self-start rounded-full border border-primary/20 bg-soft-blue px-3 py-1.5">
              <option.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="text-xs font-semibold text-primary">{option.title}</span>
            </div>

            <h1 className="page-title max-w-lg text-[2rem] leading-tight xl:text-[2.35rem]">
              Create your CALQULUS account
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Set up your property operations in a few simple steps.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {features.map((f) => (
                <article key={f.text} className="enterprise-card p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft-blue text-primary">
                    <f.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">{f.text}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-[46%]">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <a href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="font-heading text-lg font-bold uppercase tracking-wide text-foreground">CALQULUS</span>
              </a>
              <a href="/" className="text-xs font-medium text-muted-foreground hover:text-primary">
                Home
              </a>
            </div>

            <div className="enterprise-card p-6 sm:p-7">
              <h2 className="font-heading text-2xl font-bold text-foreground">Create your account</h2>
              <p className="mt-1 text-sm text-muted-foreground">{oneLine}</p>

              {/* Role choice — inline picker; Admin/WebHost never enroll */}
              <fieldset className="mt-5">
                <legend className="sr-only">Choose your experience</legend>
                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Choose your experience">
                  {ROLE_OPTIONS.map(roleOptionButton)}
                </div>
              </fieldset>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    className="mt-1.5"
                    placeholder="John Mugo"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="mt-1.5"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => onEmail(event.target.value)}
                    aria-invalid={emailError ? true : undefined}
                    required
                  />
                  {emailError ? <p className="mt-1.5 text-xs text-destructive">{emailError}</p> : null}
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-describedby="password-checks"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <ul id="password-checks" className="mt-2 space-y-1 text-xs">
                    {[
                      ["length", "At least 8 characters"],
                      ["upper", "One uppercase letter"],
                      ["lower", "One lowercase letter"],
                      ["number", "One number"],
                      ["special", "One special character"],
                    ].map(([key, label]) => (
                      <li key={key} className="flex items-center gap-2">
                        {specialCheck[key as keyof typeof specialCheck] ? (
                          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        )}
                        <span className={specialCheck[key as keyof typeof specialCheck] ? "text-success" : "text-muted-foreground"}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? "Creating account…" : "Create account"}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <a href={PORTAL_DEST[role].loginPath} className="font-medium text-primary hover:underline">
                  Sign in
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
