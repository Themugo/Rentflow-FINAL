import { useState } from "react";
import { ArrowRightLeft, Building2, CheckCircle2, Link2, ShieldCheck, UserRound } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router-dom";
import { Card } from "@/shared/components/ui/card";

type Mode = "agency" | "manager" | "landlord" | "independent";

interface Props {
  tenantId: string;
  mode: Mode;
  managerName?: string | null;
  agencyName?: string | null;
  landlordName?: string | null;
  propertyName?: string | null;
  hasActiveLease?: boolean;
}

const copy: Record<Mode, { label: string; title: string; body: string }> = {
  agency: { label: "Agency managed", title: "Your record is connected to an agency portfolio.", body: "Your tenant identity, payment history and rental record remain yours even when the managing team changes." },
  manager: { label: "Manager managed", title: "Your record is connected to a property manager.", body: "Your lease and payment history stay with your CALQULUS identity when your management relationship changes." },
  landlord: { label: "Landlord managed", title: "Your record is connected to direct landlord management.", body: "Your personal rental record stays portable if you later move to another managed property or go independent." },
  independent: { label: "Independent record", title: "Your rental record travels with you.", body: "Keep contracts, payment evidence, repair notes and condition history in one personal record. Link it to a managed property later." },
};

export default function TenantManagementStatusCard({ tenantId, mode, managerName, agencyName, landlordName, propertyName, hasActiveLease }: Props) {
  const { toast } = useToast();
  const [isLeaving, setIsLeaving] = useState(false);
  const item = copy[mode];
  const contextName = mode === "agency" ? agencyName || managerName : mode === "manager" ? managerName : mode === "landlord" ? landlordName : null;
  return (
    <Card className="mb-4 overflow-hidden border-border/80 bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {mode === "independent" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
            {item.label}
          </div>
          <h2 className="mt-1 text-sm font-semibold text-foreground sm:text-base">{item.title}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">{item.body}</p>
          {contextName || propertyName ? (
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              {contextName ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"><CheckCircle2 className="h-3 w-3 text-primary" />{contextName}</span> : null}
              {propertyName ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Building2 className="h-3 w-3 text-primary" />{propertyName}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "independent" ? (
            <Link to="/tenant/invitation" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 text-xs font-semibold text-primary hover:bg-primary/10">
              <Link2 className="h-3.5 w-3.5" />Link managed property
            </Link>
          ) : (
            <>
              {!hasActiveLease ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLeaving}
                  className="min-h-10 gap-2 text-xs"
                  title="Move your record to independent mode after the current managed lease is complete."
                  onClick={async () => {
                    setIsLeaving(true);
                    const { error } = await supabase.rpc('transfer_tenant_management_atomic' as any, {
                      p_tenant_id: tenantId, p_destination_mode: 'independent', p_notes: 'Tenant chose to continue with an independent portable record.'
                    });
                    if (error) toast({ title: 'Could not switch to independent mode', description: error.message, variant: 'destructive' });
                    else { toast({ title: 'Independent record enabled', description: 'Your CALQULUS history remains attached to your tenant identity.' }); window.location.reload(); }
                    setIsLeaving(false);
                  }}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />{isLeaving ? 'Updating…' : 'Continue independently'}
                </Button>
              ) : (
                <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground" title="Complete or terminate the active lease before changing management.">
                  <ArrowRightLeft className="h-3.5 w-3.5" />Portable identity
                </span>
              )}
            </>
          )}
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary" title="Your record is protected">
            <ShieldCheck className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Card>
  );
}
