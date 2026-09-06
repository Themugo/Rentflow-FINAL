import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useRoleOnboarding } from "@/features/onboarding/hooks/useRoleOnboarding";
import { OnboardingProgress } from "@/features/onboarding/components/OnboardingProgress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Layout } from "@/shared/components/layout/Layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { ActivationFacts } from "@/features/dashboard/lib/activationPath";

/** Role onboarding resume. Facts come from the backend; progress re-resolves. */

async function fetchPortfolioFacts(managerId: string): Promise<ActivationFacts> {
  const [company, properties, units, tenants, invoices] = await Promise.all([
    supabase.from("company_settings").select("id").eq("manager_user_id", managerId).maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
  ]);

  return {
    hasCompany: !!company.data,
    propertyCount: properties.count ?? 0,
    unitCount: units.count ?? 0,
    tenantCount: tenants.count ?? 0,
    leaseCount: 0,
    invoiceCount: invoices.count ?? 0,
    paidInvoiceCount: 0,
    hasPaymentMethod: false,
    firstPropertyId: null,
  };
}

export default function OnboardingPage() {
  const { userRole } = useAuth();
  const { managerId } = useManagerScope();

  const { data: facts, isLoading } = useQuery<ActivationFacts>({
    queryKey: ["role-onboarding-facts", managerId],
    queryFn: () => fetchPortfolioFacts(managerId!),
    enabled: !!managerId,
  });

  const progress = useRoleOnboarding(facts);

  if (userRole?.role === "webhost") {
    return <Navigate to="/webhost" replace />;
  }

  if (!managerId) {
    return (
      <Layout title="Complete setup" subtitle="Finish onboarding to unlock full portfolio operations.">
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Account has no manager scope yet.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Complete setup" subtitle="Finish onboarding to unlock full portfolio operations.">
      <div className="space-y-6 p-6">
        {isLoading || !facts || !progress ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <OnboardingProgress progress={progress} />
        )}
      </div>
    </Layout>
  );
}
