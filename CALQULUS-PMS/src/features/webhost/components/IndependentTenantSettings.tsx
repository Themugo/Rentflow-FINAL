import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldCheck, WalletCards } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";

export default function IndependentTenantSettings() {
  const { isSuperAdmin, platformAdminInfo } = useAuth();
  const canManage = Boolean(isSuperAdmin || platformAdminInfo?.can_manage_platform_settings);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [feeEnabled, setFeeEnabled] = useState(false);
  const [feeType, setFeeType] = useState<"percentage" | "fixed">("percentage");
  const [feeValue, setFeeValue] = useState("0");
  const { data } = useQuery({
    queryKey: ["tenant-platform-config"],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_platform_config" as any).select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  useEffect(() => {
    if (!data) return;
    setSignupEnabled(Boolean(data.independent_signup_enabled));
    setFeeEnabled(Boolean(data.transaction_fee_enabled));
    setFeeType(data.transaction_fee_type === "fixed" ? "fixed" : "percentage");
    setFeeValue(String(data.transaction_fee_value ?? 0));
  }, [data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("save_tenant_platform_config" as any, {
        p_enabled: signupEnabled,
        p_fee_enabled: feeEnabled,
        p_fee_type: feeType,
        p_fee_value: Number(feeValue) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-platform-config"] });
      toast({ title: "Independent tenant settings saved" });
    },
    onError: (e: Error) => toast({ title: "Could not save settings", description: e.message, variant: "destructive" }),
  });

  if (!canManage) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
        <div><h2 className="text-base font-semibold">Independent tenant services</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Enable portable self-service tenant records and configure an optional service fee for eligible CALQULUS transaction services.</p></div>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3"><div><Label>Independent registration</Label><p className="mt-1 text-xs text-muted-foreground">Tenants can open a free portable rental record without an invitation.</p></div><Switch checked={signupEnabled} onCheckedChange={setSignupEnabled} /></div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-primary" /><Label>Eligible transaction service fee</Label></div>
          <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Configuration only. Actual collection still belongs to the applicable payment workflow.</p><Switch checked={feeEnabled} onCheckedChange={setFeeEnabled} /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>Fee type</Label><Select value={feeType} onValueChange={(v: "percentage" | "fixed") => setFeeType(v)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed KES</SelectItem></SelectContent></Select></div>
            <div><Label>{feeType === "percentage" ? "Rate (%)" : "Amount (KES)"}</Label><Input className="mt-1" type="number" min="0" max={feeType === "percentage" ? "10" : undefined} step="0.01" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} /></div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end"><Button className="gap-2" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? "Saving…" : "Save settings"}</Button></div>
    </section>
  );
}
