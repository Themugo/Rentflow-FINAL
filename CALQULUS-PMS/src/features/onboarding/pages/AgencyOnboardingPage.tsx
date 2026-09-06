import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import { errorToast } from "@/shared/lib/errorToast";
import AgencyLayout from "@/features/agency/components/AgencyLayout";
import { AGENCY_ROUTES } from "@/features/agency/lib/agencyPaths";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Check, Loader2, ArrowLeft, ArrowRight, SkipForward, Users, Building2, Handshake, Briefcase } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  AGENCY_COLLECTION_MODELS,
  AGENCY_ONBOARDING_STEPS,
  AGENCY_PORTFOLIO_FOCUS,
  deriveAgencyCompletedSteps,
  readAgencyPortfolioDraft,
  type AgencyCollectionModel,
  type AgencyPortfolioFocus,
} from "@/features/onboarding/components/agency/AgencyOnboardingSteps";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { OnboardingCompletion } from "@/features/onboarding/components/OnboardingCompletion";
import { buildCompletionModel, agencyCompletionItems, agencyRecommendations } from "@/features/onboarding/lib/completion";
import { useOnboardingDraft } from "@/features/onboarding/hooks/useOnboardingDraft";
import { ResendVerificationButton } from "@/features/auth/components/ResendVerificationButton";

const ORDER = AGENCY_ONBOARDING_STEPS.map((s) => s.id) as readonly string[];

interface AgencyFactsRow {
  agencyName: string | null;
  propertyCount: number;
  clientCount: number;
  brandConfig: unknown;
}

async function fetchAgencyFacts(userId: string): Promise<AgencyFactsRow> {
  const [company, properties, links] = await Promise.all([
    supabase.from("company_settings").select("company_name, brand_config").eq("manager_user_id", userId).maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("manager_id", userId),
    supabase.from("property_landlords").select("landlord_user_id", { count: "exact", head: true }).eq("manager_id", userId).not("landlord_user_id", "is", null),
  ]);
  return {
    agencyName: company.data?.company_name ?? null,
    propertyCount: properties.count ?? 0,
    clientCount: links.count ?? 0,
    brandConfig: company.data?.brand_config ?? null,
  };
}

/** Read-modify-write merge of company_settings.brand_config.onboarding. */
async function saveOnboardingConfig(userId: string, companyName: string, patch: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from("company_settings")
    .select("brand_config")
    .eq("manager_user_id", userId)
    .maybeSingle();
  const current = (existing?.brand_config && typeof existing.brand_config === "object"
    ? existing.brand_config
    : {}) as Record<string, unknown>;
  const onboarding = (current.onboarding && typeof current.onboarding === "object"
    ? current.onboarding
    : {}) as Record<string, unknown>;
  const { error } = await supabase.rpc('save_manager_company_settings_atomic', {
    p_payload: {
      company_name: companyName,
      brand_config: { ...current, onboarding: { ...onboarding, ...patch } },
    },
  });
  if (error) throw error;
}

export default function AgencyOnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const userId = user?.id ?? null;
  const [agencyName, setAgencyName, clearAgencyNameDraft] = useOnboardingDraft("agency-name", userId);
  const [focus, setFocus] = useState<AgencyPortfolioFocus | null>(null);
  const [collectionModel, setCollectionModel] = useState<AgencyCollectionModel | null>(null);
  const [clientName, setClientName, clearClientNameDraft] = useOnboardingDraft("client-name", userId);
  const [teamEmail, setTeamEmail, clearTeamEmailDraft] = useOnboardingDraft("team-email", userId);
  const [isSaving, setIsSaving] = useState(false);

  const { data: facts, isLoading, error } = useQuery<AgencyFactsRow>({
    queryKey: ["agency-onboarding-facts", userId],
    queryFn: () => fetchAgencyFacts(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (facts?.agencyName && !agencyName) setAgencyName(facts.agencyName);
  }, [facts?.agencyName, agencyName, setAgencyName]);

  const completedIds = useMemo(() => {
    if (!facts) return new Set<string>();
    return deriveAgencyCompletedSteps({
      agencyName: facts.agencyName,
      propertyCount: facts.propertyCount,
      clientCount: facts.clientCount,
      portfolioDraft: readAgencyPortfolioDraft(facts.brandConfig),
    });
  }, [facts]);

  const currentId = ORDER[Math.min(stepIdx, ORDER.length - 1)];

  const skipStep = () => setStepIdx((i) => Math.min(i + 1, ORDER.length - 1));
  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));
  const resolvedCompanyName = agencyName.trim() || facts?.agencyName || "My agency";

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error: upsertError } = await supabase.rpc('save_manager_company_settings_atomic', {
        p_payload: { company_name: agencyName.trim() },
      });
      if (upsertError) throw upsertError;
    },
    onSuccess: () => {
      clearAgencyNameDraft();
      toast({ title: "Saved", description: "Agency profile saved." });
      skipStep();
    },
    onError: (mutationError) => {
      errorToast("Could not save profile", mutationError, "Check your connection and try again.");
    },
  });

  const savePortfolio = useMutation({
    mutationFn: async () => {
      if (!focus || !collectionModel) return;
      await saveOnboardingConfig(userId!, resolvedCompanyName, { portfolio: { focus, collectionModel } });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Portfolio defaults saved — applied to new client links." });
      skipStep();
    },
    onError: (mutationError) => {
      errorToast("Could not save portfolio setup", mutationError, "Check your connection and try again.");
    },
  });

  const saveClient = useMutation({
    mutationFn: async () => {
      // Client links are property_landlords rows and need a property first.
      // Until then, keep the owner name as a draft note on the agency record.
      if (!clientName.trim()) return;
      await saveOnboardingConfig(userId!, resolvedCompanyName, { firstClientName: clientName.trim() });
    },
    onSuccess: () => {
      clearClientNameDraft();
      toast({ title: "Saved", description: "Client note saved — link the owner when you add your first property." });
      skipStep();
    },
    onError: (mutationError) => {
      errorToast("Could not save client", mutationError, "Check your connection and try again.");
    },
  });

  const inviteTeam = useMutation({
    mutationFn: async (email: string) => {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1!",
        options: {
          emailRedirectTo: `${window.location.origin}/agency`,
          data: { full_name: email.split("@")[0], role: "submanager", manager_id: userId },
        },
      });
      if (signUpError) throw signUpError;
    },
    onSuccess: () => {
      setTeamEmail("");
      clearTeamEmailDraft();
      toast({ title: "Invite sent", description: "The teammate will get an email with the invitation link." });
      skipStep();
    },
    onError: (mutationError) => {
      errorToast("Could not invite team member", mutationError, "Check the email address and try again.");
    },
  });

  if (isLoading) {
    return (
      <AgencyLayout title="Set up your agency" description="Professional portfolio management.">
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-8 w-2/3 rounded-md" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </AgencyLayout>
    );
  }

  if (error) {
    return (
      <AgencyLayout title="Set up your agency" description="Professional portfolio management.">
        <p className="text-sm text-destructive">Could not load your agency state. Try again.</p>
      </AgencyLayout>
    );
  }

  return (
    <AgencyLayout title="Set up your agency" description="Professional portfolio management.">
      <div className="space-y-6">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {AGENCY_ONBOARDING_STEPS.map((step, i) => {
            const done = i < stepIdx || completedIds.has(step.id);
            const active = i === stepIdx;
            return (
              <li key={step.id} className="flex-1">
                <div
                  aria-current={active ? "step" : undefined}
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
          Step {Math.min(stepIdx + 1, ORDER.length)} of {ORDER.length} · {AGENCY_ONBOARDING_STEPS[Math.min(stepIdx, ORDER.length - 1)].label}
        </p>

        {currentId === "account" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your login is ready. Continue to set up your agency profile.</p>
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
            <p className="mt-1 text-sm text-muted-foreground">Check your inbox for a verification link. If it hasn't arrived, resend it below.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={skipStep} className="gap-1.5">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
              <ResendVerificationButton email={user?.email} redirectTo={`${window.location.origin}/agency/onboarding`} />
              <Button variant="ghost" onClick={skipStep} className="gap-1.5">
                <SkipForward className="h-4 w-4" /> Skip for now
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "profile" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Agency profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">The name your clients and owners see on statements.</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!agencyName.trim()) return;
                setIsSaving(true);
                void saveProfile.mutateAsync().finally(() => setIsSaving(false));
              }}
            >
              <div>
                <Label htmlFor="agency-name">Agency name</Label>
                <Input
                  id="agency-name"
                  className="mt-1.5"
                  placeholder="Summit Property Management"
                  value={agencyName}
                  onChange={(event) => setAgencyName(event.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving || !agencyName.trim()}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save and continue
                </Button>
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {currentId === "portfolio" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-[var(--portal-accent)]" aria-hidden />
              <div>
                <h2 className="font-heading text-lg font-semibold">Portfolio setup</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  What you manage and how rent is collected. This sets the default for new client links — you can change it per client later.
                </p>
              </div>
            </div>
            <form
              className="mt-4 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!focus || !collectionModel) return;
                setIsSaving(true);
                void savePortfolio.mutateAsync().finally(() => setIsSaving(false));
              }}
            >
              <fieldset>
                <legend className="text-sm font-medium">What do you manage?</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {AGENCY_PORTFOLIO_FOCUS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={focus === option.id}
                      onClick={() => setFocus(option.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        focus === option.id ? "border-primary/60 bg-primary/8" : "border-border hover:bg-muted",
                      )}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium">How does rent usually flow?</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {AGENCY_COLLECTION_MODELS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={collectionModel === option.id}
                      onClick={() => setCollectionModel(option.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        collectionModel === option.id ? "border-primary/60 bg-primary/8" : "border-border hover:bg-muted",
                      )}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving || !focus || !collectionModel}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save and continue
                </Button>
                <Button type="button" variant="outline" onClick={skipStep}>
                  <SkipForward className="mr-1.5 h-4 w-4" /> Skip for now
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {currentId === "clients" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <Handshake className="mt-0.5 h-5 w-5 shrink-0 text-[var(--portal-accent)]" aria-hidden />
              <div>
                <h2 className="font-heading text-lg font-semibold">First client</h2>
                <p className="mt-1 text-sm text-muted-foreground">Note the first property owner you manage for. You link them to a building from the Clients page.</p>
              </div>
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!clientName.trim()) return;
                setIsSaving(true);
                void saveClient.mutateAsync().finally(() => setIsSaving(false));
              }}
            >
              <div>
                <Label htmlFor="client-name">Client or owner name</Label>
                <Input
                  id="client-name"
                  className="mt-1.5"
                  placeholder="James Kamau"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Link their properties from the{" "}
                  <Link className="underline" to={AGENCY_ROUTES.clients}>Clients</Link>{" "}
                  page when they're ready.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving || !clientName.trim()}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  <Users className="mr-1.5 h-4 w-4" /> Save and continue
                </Button>
                <Button type="button" variant="outline" onClick={skipStep}>
                  <SkipForward className="mr-1.5 h-4 w-4" /> Skip for now
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {currentId === "property" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">First property</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add the first managed building. More can follow later.</p>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => navigate("/agency/properties")} className="gap-1.5">
                <Building2 className="mr-1.5 h-4 w-4" /> Add a property <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "team" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Invite your team</h2>
            <p className="mt-1 text-sm text-muted-foreground">Colleagues can manage properties and clients. Optional.</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!teamEmail.trim()) return;
                setIsSaving(true);
                void inviteTeam.mutateAsync(teamEmail.trim()).finally(() => setIsSaving(false));
              }}
            >
              <div>
                <Label htmlFor="team-email">Teammate email</Label>
                <Input
                  id="team-email"
                  type="email"
                  className="mt-1.5"
                  placeholder="colleague@agency.com"
                  value={teamEmail}
                  onChange={(event) => setTeamEmail(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving || !teamEmail.trim()}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  <Users className="mr-1.5 h-4 w-4" /> Send invite
                </Button>
                <Button type="button" variant="outline" onClick={skipStep}>
                  <SkipForward className="mr-1.5 h-4 w-4" /> Skip for now
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {currentId === "complete" && facts ? (
          <OnboardingCompletion
            model={buildCompletionModel(
              agencyCompletionItems({
                agencyName: facts.agencyName,
                propertyCount: facts.propertyCount,
                clientCount: facts.clientCount,
                portfolioConfigured: readAgencyPortfolioDraft(facts.brandConfig) !== null,
              }),
              agencyRecommendations({
                agencyName: facts.agencyName,
                propertyCount: facts.propertyCount,
                clientCount: facts.clientCount,
                portfolioConfigured: readAgencyPortfolioDraft(facts.brandConfig) !== null,
              }),
            )}
            headline="Your agency is ready."
            primaryAction={{ label: "Open Agency Dashboard", href: "/agency" }}
            secondaryAction={{ label: "Add another property", href: "/agency/properties" }}
          />
        ) : null}
      </div>
    </AgencyLayout>
  );
}
