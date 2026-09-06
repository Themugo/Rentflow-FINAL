import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import { errorToast } from "@/shared/lib/errorToast";
import { Layout } from "@/shared/components/layout/Layout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Check, Loader2, ArrowLeft, ArrowRight, SkipForward, Home, Factory, Briefcase, Building2 } from "lucide-react";
import { OnboardingCompletion } from "@/features/onboarding/components/OnboardingCompletion";
import { buildCompletionModel, landlordCompletionItems, landlordRecommendations } from "@/features/onboarding/lib/completion";
import { cn } from "@/shared/lib/utils";
import { LANDLORD_ONBOARDING_STEPS, LANDLORD_PROPERTY_TYPES } from "@/features/onboarding/components/landlord/LandlordOnboardingSteps";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useOnboardingDraft } from "@/features/onboarding/hooks/useOnboardingDraft";
import { ResendVerificationButton } from "@/features/auth/components/ResendVerificationButton";

const ORDER = LANDLORD_ONBOARDING_STEPS.map((s) => s.id) as readonly string[];

interface LandlordFacts {
  companyName: string | null;
  displayName: string | null;
  propertyTypes: string[];
  propertiesCount: number;
  payoutConfigured: boolean;
}

async function fetchLandlordFacts(userId: string): Promise<LandlordFacts> {
  const [company, properties] = await Promise.all([
    supabase.from("company_settings").select("company_name").eq("manager_user_id", userId).maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("manager_id", userId),
  ]);
  const propertyTypes = [] as string[];
  return {
    companyName: company.data?.company_name ?? null,
    displayName: null,
    propertyTypes,
    propertiesCount: properties.count ?? 0,
    payoutConfigured: false,
  };
}

export default function LandlordOnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const userId = user?.id ?? null;
  const [orgName, setOrgName, clearOrgNameDraft] = useOnboardingDraft("profile-name", userId);
  const [isSaving, setIsSaving] = useState(false);

  const { data: facts, isLoading, error } = useQuery<LandlordFacts>({
    queryKey: ["landlord-onboarding-facts", userId],
    queryFn: () => fetchLandlordFacts(userId!),
    enabled: !!userId,
  });

  const completedIds = useMemo(() => {
    if (!facts) return new Set<string>();
    const ids = new Set<string>();
    if (facts.companyName || orgName) ids.add("profile");
    if (facts.propertyTypes.length > 0) ids.add("portfolio");
    if (facts.propertiesCount > 0) ids.add("first-property");
    return ids;
  }, [facts, orgName]);

  const currentId = ORDER[Math.min(stepIdx, ORDER.length - 1)];

  const skipStep = () => setStepIdx((i) => Math.min(i + 1, ORDER.length - 1));

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_manager_company_settings_atomic', {
        p_payload: { company_name: orgName || "My property business" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      clearOrgNameDraft();
      toast({ title: "Saved", description: "Profile saved." });
      skipStep();
    },
    onError: (error) => {
      errorToast("Could not save profile", error, "Check your connection and try again.");
    },
  });

  const savePortfolio = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_manager_company_settings_atomic', {
        p_payload: {
          company_name: orgName || "My property business",
          brand_config: { onboarding: { landlordPropertyTypes: propertyTypes } },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Portfolio preferences saved." });
      skipStep();
    },
    onError: (error) => {
      errorToast("Could not save portfolio", error, "Check your connection and try again.");
    },
  });

  if (!userId) {
    return (
      <Layout title="Setting up your portfolio" subtitle="Your investment portfolio.">
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading your account…</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Setting up your portfolio" subtitle="Your investment portfolio.">
        <div className="space-y-4 p-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-8 rounded-md w-2/3" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Setting up your portfolio" subtitle="Your investment portfolio.">
        <div className="p-6">
          <p className="text-sm text-destructive">Could not load your portfolio state. Try again.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Setting up your portfolio" subtitle="Your investment portfolio.">
      <div className="space-y-6 p-6">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {LANDLORD_ONBOARDING_STEPS.map((step, i) => {
            const done = i < stepIdx || completedIds.has(step.id);
            const active = i === stepIdx;
            return (
              <li key={step.id} className="flex-1">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2.5",
                    done && "border-success/40 bg-success/10",
                    active && "border-primary/60 bg-primary/8",
                    !done && !active && "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{step.label}</p>
                    <p className="text-[11px] text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted-foreground sm:hidden">
          Step {Math.min(stepIdx + 1, ORDER.length)} of {ORDER.length} · {LANDLORD_ONBOARDING_STEPS[Math.min(stepIdx, ORDER.length - 1)].label}
        </p>

        {currentId === "account" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your login is ready. Continue to set up your investment profile.</p>
            <div className="mt-5 flex gap-2">
              <Button onClick={skipStep} className="gap-1.5">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "verification" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Verify your email</h2>
            <p className="mt-1 text-sm text-muted-foreground">Check your inbox for a verification link to keep your portfolio secure. If it hasn't arrived, resend it below.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={skipStep} className="gap-1.5">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
              <ResendVerificationButton email={user?.email} redirectTo={`${window.location.origin}/landlord/onboarding`} />
              <Button variant="ghost" onClick={skipStep} className="gap-1.5">
                <SkipForward className="h-4 w-4" /> Skip for now
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "profile" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Your profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">The name that appears on statements and payouts.</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const value = orgName.trim() || displayName.trim();
                if (!value) return;
                setIsSaving(true);
                void saveProfile.mutateAsync().finally(() => setIsSaving(false));
              }}
            >
              <div>
                <Label htmlFor="org-name">Business name</Label>
                <Input
                  id="org-name"
                  className="mt-1.5"
                  placeholder="Mugo Properties Ltd"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  className="mt-1.5"
                  placeholder="How you prefer to be addressed"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving || (!orgName.trim() && !displayName.trim())}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save and continue
                </Button>
                <Button type="button" variant="outline" onClick={skipStep}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {currentId === "portfolio" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Your portfolio</h2>
            <p className="mt-1 text-sm text-muted-foreground">What kind of properties do you own?</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LANDLORD_PROPERTY_TYPES.map((type) => {
                const active = propertyTypes.includes(type.id);
                const Icon = type.id === "residential" ? Home : type.id === "commercial" ? Factory : type.id === "office" ? Briefcase : Building2;
                return (
                  <button
                    key={type.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setPropertyTypes((current) =>
                        active ? current.filter((id) => id !== type.id) : [...current, type.id],
                      )
                    }
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      active ? "border-primary/60 bg-primary/8" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft-blue text-primary">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="mt-2 text-sm font-semibold text-foreground">{type.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{type.description}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => {
                  if (propertyTypes.length === 0) return;
                  setIsSaving(true);
                  void savePortfolio.mutateAsync().finally(() => setIsSaving(false));
                }}
                disabled={isSaving || propertyTypes.length === 0}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continue
              </Button>
              <Button type="button" variant="outline" onClick={skipStep}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "first-property" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">First property</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add the first building or unit you own. More can follow later.</p>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => navigate("/landlord/properties")} className="gap-1.5">
                Add a property <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={skipStep}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "financials" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Financial setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">Payout preferences and statements. You can configure these later.</p>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => navigate("/landlord/settings")} className="gap-1.5">
                Configure payouts <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={skipStep}>
                <SkipForward className="mr-1.5 h-4 w-4" /> Skip for now
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "complete" && facts ? (
          <OnboardingCompletion
            model={buildCompletionModel(
              landlordCompletionItems({
                companyName: facts.companyName,
                propertiesCount: facts.propertiesCount,
              }),
              landlordRecommendations({
                companyName: facts.companyName,
                propertiesCount: facts.propertiesCount,
              }),
            )}
            headline="Your portfolio is ready."
            primaryAction={{ label: "Open Landlord Dashboard", href: "/landlord/dashboard" }}
            secondaryAction={{ label: "Link another property", href: "/landlord/portfolio" }}
          />
        ) : null}
      </div>
    </Layout>
  );
}
