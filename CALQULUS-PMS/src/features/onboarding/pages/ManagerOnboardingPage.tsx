import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useToast } from "@/shared/hooks/use-toast";
import { errorToast } from "@/shared/lib/errorToast";
import { Layout } from "@/shared/components/layout/Layout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Check, Loader2, ArrowLeft, ArrowRight, SkipForward, Building2, Users, Home, Factory, Briefcase } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { MANAGER_ONBOARDING_STEPS, PROPERTY_GROUPS, type ManagerOnboardingStepId } from "@/features/onboarding/components/manager/ManagerOnboardingSteps";
import { useManagerOnboardingState } from "@/features/onboarding/hooks/useManagerOnboardingState";
import { useOnboardingDraft } from "@/features/onboarding/hooks/useOnboardingDraft";
import { OnboardingCompletion } from "@/features/onboarding/components/OnboardingCompletion";
import { buildCompletionModel, managerCompletionItems, managerRecommendations } from "@/features/onboarding/lib/completion";
import { ResendVerificationButton } from "@/features/auth/components/ResendVerificationButton";

const ORDER = MANAGER_ONBOARDING_STEPS.map((s) => s.id) as readonly ManagerOnboardingStepId[];

export default function ManagerOnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const [stepIdx, setStepIdx] = useState(0);
  const [organizationName, setOrganizationName, clearOrganizationDraft] = useOnboardingDraft("organization", userId);
  const [orgSaving, setOrgSaving] = useState(false);
  const [portfolioGroups, setPortfolioGroups] = useState<string[]>([]);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [teamEmail, setTeamEmail, clearTeamDraft] = useOnboardingDraft("team-email", userId);
  const [teamSaving, setTeamSaving] = useState(false);

  const { progress, isLoading, error, refetch } = useManagerOnboardingState();
  const currentId = ORDER[Math.min(stepIdx, ORDER.length - 1)];

  const stepMeta = useMemo(() => {
    return progress ?? null;
  }, [progress]);

  const skipStep = () => {
    setStepIdx((i) => Math.min(i + 1, ORDER.length - 1));
  };

  const saveOrganization = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc('save_manager_company_settings_atomic', {
        p_payload: {
          company_name: name,
          brand_config: { onboarding: { organizationComplete: true } },
        },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setOrganizationName("");
      clearOrganizationDraft();
      toast({ title: "Saved", description: "Your organization name has been saved." });
      await refetch();
      skipStep();
    },
    onError: (error) => {
      errorToast("Could not save organization", error, "Check your connection and try again.");
    },
  });

  const savePortfolio = useMutation({
    mutationFn: async (groups: string[]) => {
      const { error } = await supabase.rpc('save_manager_company_settings_atomic', {
        p_payload: {
          company_name: "CALQULUS Workspace",
          brand_config: { onboarding: { propertyGroups: groups } },
        },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Saved", description: "Property types saved." });
      await refetch();
      skipStep();
    },
    onError: (error) => {
      errorToast("Could not save portfolio", error, "Check your connection and try again.");
    },
  });

  const inviteTeam = useMutation({
    mutationFn: async (email: string) => {
      // Real invite via existing auth mechanism (same pattern as SubmanagerManagement).
      const { error } = await supabase.auth.signUp({
        email,
        password: crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1!",
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: email.split("@")[0], role: "submanager", manager_id: managerId },
        },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTeamEmail("");
      clearTeamDraft();
      toast({ title: "Invite sent", description: "The team member will get an email with the invitation link." });
      await refetch();
      skipStep();
    },
    onError: (error) => {
      errorToast("Could not invite team member", error, "Check the email address and try again.");
    },
  });

  if (!managerId) {
    return (
      <Layout title="Onboarding" subtitle="Setting up your workspace.">
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading your account…</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Onboarding" subtitle="Setting up your workspace.">
        <div className="space-y-4 p-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-8 rounded-md w-2/3" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (error || !stepMeta) {
    return (
      <Layout title="Onboarding" subtitle="Setting up your workspace.">
        <div className="p-6">
          <p className="text-sm text-destructive">Could not load onboarding state. Try again.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ["manager-onboarding-facts"] })}>
            Retry
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Onboarding" subtitle="Setting up your workspace.">
      <div className="space-y-6 p-6">
        {/* Progress indicator — desktop pills */}
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {MANAGER_ONBOARDING_STEPS.map((step, i) => {
            const done = i < stepIdx || stepMeta.completedIds.has(step.id);
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
          Step {Math.min(stepIdx + 1, ORDER.length)} of {ORDER.length} · {MANAGER_ONBOARDING_STEPS[Math.min(stepIdx, ORDER.length - 1)].label}
        </p>

        {/* Step content */}
        {currentId === "account" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your email is already on file. Continue to verification.</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm">
                <span className="font-medium">Email</span> · <span className="text-muted-foreground">{user?.email ?? "…"}</span>
              </p>
              <p className="text-xs text-muted-foreground">Signed in with your existing CALQULUS account.</p>
            </div>
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
            <p className="mt-1 text-sm text-muted-foreground">
              Check your inbox for a verification link. If you haven't received it, you can resend or use a different email.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={skipStep} className="gap-1.5">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
              <ResendVerificationButton email={user?.email} redirectTo={`${window.location.origin}/onboarding/manager`} />
              <Button variant="ghost" onClick={skipStep} className="gap-1.5">
                <SkipForward className="h-4 w-4" /> Skip for now
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "organization" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Organization</h2>
            <p className="mt-1 text-sm text-muted-foreground">Name the company that appears on invoices, receipts and statements.</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const value = organizationName.trim();
                if (!value) return;
                setOrgSaving(true);
                void saveOrganization.mutateAsync(value).finally(() => setOrgSaving(false));
              }}
            >
              <div>
                <Label htmlFor="org-name">Company name</Label>
                <Input
                  id="org-name"
                  className="mt-1.5"
                  placeholder="Acme Property Management Ltd"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={orgSaving || !organizationName.trim()}>
                  {orgSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
            <h2 className="font-heading text-lg font-semibold">What do you manage?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select all that apply. These show up in property filters and billing.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROPERTY_GROUPS.map((group) => {
                const active = portfolioGroups.includes(group.id);
                const Icon = group.id === "residential" ? Home : group.id === "commercial" ? Factory : group.id === "office" ? Briefcase : Building2;
                return (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setPortfolioGroups((current) =>
                        active ? current.filter((id) => id !== group.id) : [...current, group.id],
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
                    <p className="mt-2 text-sm font-semibold text-foreground">{group.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => {
                  if (portfolioGroups.length === 0) return;
                  setPortfolioSaving(true);
                  void savePortfolio.mutateAsync(portfolioGroups).finally(() => setPortfolioSaving(false));
                }}
                disabled={portfolioSaving || portfolioGroups.length === 0}
              >
                {portfolioSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continue
              </Button>
              <Button type="button" variant="outline" onClick={skipStep}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "property" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">First property</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add the first building you'll manage. Add more later.</p>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => navigate("/properties")} className="gap-1.5">
                Add a property <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={skipStep}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            </div>
          </section>
        ) : null}

        {currentId === "team" ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Invite your team</h2>
            <p className="mt-1 text-sm text-muted-foreground">Submanagers help you run properties. You can add them later.</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const value = teamEmail.trim();
                if (!value) return;
                setTeamSaving(true);
                void inviteTeam.mutateAsync(value).finally(() => setTeamSaving(false));
              }}
            >
              <div>
                <Label htmlFor="team-email">Teammate email</Label>
                <Input
                  id="team-email"
                  type="email"
                  className="mt-1.5"
                  placeholder="colleague@company.com"
                  value={teamEmail}
                  onChange={(event) => setTeamEmail(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={teamSaving || !teamEmail.trim()}>
                  {teamSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  <Users className="mr-1.5 h-4 w-4" /> Send invite
                </Button>
                <Button type="button" variant="outline" onClick={skipStep}>
                  <SkipForward className="mr-1.5 h-4 w-4" /> Skip for now
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {currentId === "complete" && stepMeta.facts ? (
          <OnboardingCompletion
            model={buildCompletionModel(
              managerCompletionItems({
                companyName: stepMeta.facts.companyName,
                propertyTypeGroups: stepMeta.facts.propertyTypeGroups,
                propertiesCount: stepMeta.facts.propertiesCount,
                verifiedEmail: stepMeta.facts.verifiedEmail,
              }),
              managerRecommendations({
                companyName: stepMeta.facts.companyName,
                propertyTypeGroups: stepMeta.facts.propertyTypeGroups,
                propertiesCount: stepMeta.facts.propertiesCount,
                verifiedEmail: stepMeta.facts.verifiedEmail,
              }),
            )}
            headline="You're ready to run your properties."
            primaryAction={{ label: "Open Manager Dashboard", href: "/" }}
            secondaryAction={{ label: "Add another property", href: "/properties" }}
          />
        ) : null}
      </div>
    </Layout>
  );
}
