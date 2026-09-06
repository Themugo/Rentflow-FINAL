import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import type { LandlordPayoutRequest, LandlordPropertySummary } from "@/features/landlord/lib/types";

export function useLandlordPayouts() {
  const { user, userRole } = useAuth();
  const enabled = Boolean(user) && userRole?.role === "landlord";

  const query = useQuery({
    queryKey: ["landlord-payouts", user?.id],
    queryFn: async (): Promise<LandlordPayoutRequest[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("landlord_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string;
        property_id: string;
        amount: number;
        period_start: string;
        period_end: string;
        notes: string | null;
        status: LandlordPayoutRequest["status"];
        created_at: string;
        approved_at: string | null;
        paid_at: string | null;
      }>;

      const propIds = [...new Set(rows.map((r) => r.property_id))];
      const propNames: Record<string, string> = {};
      if (propIds.length > 0) {
        const { data: ps } = await supabase.from("properties").select("id, name").in("id", propIds);
        (ps ?? []).forEach((p: { id: string; name: string }) => {
          propNames[p.id] = p.name;
        });
      }

      return rows.map((r) => ({ ...r, property_name: propNames[r.property_id] ?? "Property" }));
    },
    enabled,
  });

  return {
    ...query,
    payouts: query.data ?? [],
  };
}

export function useCreateLandlordPayout(properties: LandlordPropertySummary[]) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      propertyId: string;
      amount: number;
      periodStart: string;
      periodEnd: string;
      notes: string;
    }) => {
      if (!user) throw new Error("You must be signed in to request a payout");
      const prop = properties.find((p) => p.id === input.propertyId);
      const managerId = prop?.manager_id ?? null;
      const { data, error } = await supabase.rpc("create_payout_request_atomic", {
        p_property_id: input.propertyId,
        p_landlord_user_id: user.id,
        p_amount: input.amount,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
        p_notes: input.notes || null,
      });
      if (error) throw error;
      return { managed: Boolean(managerId), payout: data };
    },
    onSuccess: (result) => {
      toast({
        title: "Payout request submitted",
        description: result.managed
          ? "Your property manager will review and approve it."
          : "The platform admin will review and approve it.",
      });
      void queryClient.invalidateQueries({ queryKey: ["landlord-payouts"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}
