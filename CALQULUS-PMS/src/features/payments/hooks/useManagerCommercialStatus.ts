import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import {
  displayNameForTier,
  formatKes,
  nextBillingDate,
  normalizeTierKey,
  resolveBillingHealth,
  type BillingHealthResult,
} from "@/shared/lib/commercialCatalog";

interface ProfileRow {
  subscription_tier?: string | null;
  status?: string | null;
  max_properties?: number | null;
  max_units?: number | null;
  property_count?: number | null;
  unit_count?: number | null;
  platform_rate?: number | null;
}

interface InvoiceRow {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
}

export function useManagerCommercialStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager-commercial-status", user?.id],
    enabled: !!user?.id,
    staleTime: 15_000,
    queryFn: async () => {
      const [profileRes, invoicesRes, rulesRes, tierRes] = await Promise.all([
        supabase
          .from("manager_profiles")
          .select("subscription_tier, status, max_properties, max_units, property_count, unit_count, platform_rate")
          .eq("manager_user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("manager_invoices")
          .select("id, amount, status, due_date, paid_date, created_at")
          .eq("manager_user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("platform_billing_rules").select("free_trial_days").limit(1).maybeSingle(),
        supabase.from("subscription_tiers").select("tier_key, price_per_property, name").eq("is_active", true),
      ]);

      const profile = (profileRes.data ?? null) as ProfileRow | null;
      const invoices = (invoicesRes.data ?? []) as InvoiceRow[];
      const openInvoice = invoices.find((i) => i.status === "pending" || i.status === "overdue") ?? null;
      const latestPaid = invoices.find((i) => i.status === "paid") ?? null;
      const focusInvoice = openInvoice ?? invoices[0] ?? null;
      const tierKey = normalizeTierKey(profile?.subscription_tier);
      const liveTier = (tierRes.data ?? []).find((t) => t.tier_key === tierKey);
      const rate = Number(profile?.platform_rate) || Number(liveTier?.price_per_property) || 0;
      const trialDays = Number(rulesRes.data?.free_trial_days) || 30;
      const health: BillingHealthResult = resolveBillingHealth({
        profileStatus: profile?.status,
        invoiceStatus: focusInvoice?.status,
        dueDate: focusInvoice?.due_date,
        hasPaidInvoice: Boolean(latestPaid),
        signupAt: user?.created_at,
        trialDays,
      });

      return {
        profile,
        tierKey,
        planName: displayNameForTier(profile?.subscription_tier ?? liveTier?.name ?? tierKey),
        rate,
        rateLabel: rate > 0 ? `${formatKes(rate)} / property / month` : "Set with your platform invoice",
        billingCycle: "Monthly",
        nextBilling: nextBillingDate(focusInvoice?.due_date ?? latestPaid?.due_date),
        amountDue: openInvoice ? Number(openInvoice.amount) : 0,
        openInvoice,
        latestPaid,
        health,
        trialDays,
        invoices,
      };
    },
  });
}
