import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronRight, Copy, Handshake, MapPin, Plus, Users } from "lucide-react";
import AgencyLayout from "@/features/agency/components/AgencyLayout";
import { useAgencyPortfolio, type AgencyPropertyRow } from "@/features/agency/lib/useAgencyPortfolio";
import { AGENCY_ROUTES, agencyClientPath, agencyPropertyPath } from "@/features/agency/lib/agencyPaths";
import { agencyClientStatus, agencyClientStatusChipClass, agencyClientStatusLabel } from "@/features/agency/lib/agencyPortfolio";
import { formatKes } from "@/features/landlord/lib/formatKes";
import { supabase } from "@/integrations/supabase/client";
import { occupancyRateColor } from "@/shared/lib/statusBadge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/ui/error-state";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { toast } from "@/shared/hooks/use-toast";
import { errorToast } from "@/shared/lib/errorToast";

export default function AgencyClients() {
  const { data, isLoading, isError, refetch } = useAgencyPortfolio();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);

  const clients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.clients ?? [];
    return (data?.clients ?? []).filter((client) => {
      return client.name.toLowerCase().includes(needle) || client.propertyLocations.some((location) => location.toLowerCase().includes(needle));
    });
  }, [data?.clients, query]);

  const propertiesByClient = useMemo(() => {
    const map = new Map<string, AgencyPropertyRow[]>();
    for (const property of data?.properties ?? []) {
      if (!property.clientId) continue;
      const current = map.get(property.clientId) ?? [];
      current.push(property);
      map.set(property.clientId, current);
    }
    return map;
  }, [data?.properties]);

  const createAccount = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !email.trim()) throw new Error("Landlord name and email are required.");
      if (propertyIds.length === 0) throw new Error("Select at least one property for this landlord.");
      const { data: result, error } = await supabase.functions.invoke("create-agency-landlord-account", {
        body: { name, email, phone, propertyIds, revenueSharePct: 100, portalUrl: window.location.origin },
      });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || "Could not create landlord account.");
      return result as { created: boolean; activationUrl: string | null; propertyCount: number };
    },
    onSuccess: (result) => {
      setActivationUrl(result.activationUrl);
      queryClient.invalidateQueries({ queryKey: ["agency-portfolio"] });
      toast({
        title: result.created ? "Landlord account created" : "Landlord account linked",
        description: `${result.propertyCount} propert${result.propertyCount === 1 ? "y" : "ies"} are now grouped under this landlord account.`,
      });
    },
    onError: (error) => errorToast("Could not create landlord account", error),
  });

  const resetCreate = () => {
    setCreateOpen(false);
    setName("");
    setEmail("");
    setPhone("");
    setPropertyIds([]);
    setActivationUrl(null);
    createAccount.reset();
  };

  const copyActivation = async () => {
    if (!activationUrl) return;
    await navigator.clipboard.writeText(activationUrl);
    toast({ title: "Activation link copied" });
  };

  return (
    <AgencyLayout
      title="Landlord book"
      description="Manage each landlord as one account, then work down into their properties, locations and occupants."
      actions={
        <Button onClick={() => setCreateOpen(true)} className="min-h-11">
          <Plus className="mr-2 h-4 w-4" /> Create landlord account
        </Button>
      }
    >
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Handshake className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">Landlord-first operations</p>
            <p className="text-[11px] text-muted-foreground">One landlord account can own many properties across towns, each retaining its own rules and operating model.</p>
          </div>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search landlord or location" className="h-10 sm:w-72" aria-label="Search landlords" />
      </div>

      {isError ? <ErrorState title="Couldn't load the landlord book" onRetry={() => void refetch()} className="mb-6" /> : null}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : clients.length === 0 ? (
        <EmptyState icon={Handshake} title="No landlords found" description="Create an account for a landlord or link an existing landlord to a property." />
      ) : (
        <div className="space-y-3">
          {clients.map((client) => {
            const status = agencyClientStatus(client);
            const properties = propertiesByClient.get(client.id) ?? [];
            const isExpanded = expanded.has(client.id);
            return (
              <section key={client.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(client.id)) next.delete(client.id); else next.add(client.id); return next; })} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted" aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${client.name}`}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0">
                        <Link to={agencyClientPath(client.id)} className="truncate text-base font-semibold hover:text-primary hover:underline">{client.name}</Link>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {client.email ? <span>{client.email}</span> : null}
                          <span>{client.propertyCount} propert{client.propertyCount === 1 ? "y" : "ies"}</span>
                          <span>{client.occupied}/{client.units} occupied</span>
                          {client.propertyLocations.slice(0, 2).map((location) => <span key={location} className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm lg:text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Occupancy</p><p className={occupancyRateColor(client.occupancyRate) + " font-semibold"}>{client.occupancyRate}%</p></div>
                  <div className="text-sm lg:text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recorded</p><p className="font-semibold">{formatKes(client.collectedMtd)}</p>{client.outstanding > 0 ? <p className="text-[11px] text-destructive">{formatKes(client.outstanding)} outstanding</p> : null}</div>
                  <div className="flex items-center gap-2 lg:justify-end"><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${agencyClientStatusChipClass(status)}`}>{agencyClientStatusLabel(status)}</span><Button variant="outline" size="sm" asChild><Link to={agencyClientPath(client.id)}>Open book</Link></Button></div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">Properties & occupants</p><p className="text-[10px] text-muted-foreground">Keep each building and its tenants together instead of mixing the whole agency book.</p></div><Link className="text-xs font-semibold text-primary hover:underline" to={agencyClientPath(client.id)}>Open landlord workspace</Link></div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {properties.map((property) => (
                        <Link key={property.id} to={agencyPropertyPath(property.id)} className="rounded-lg border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm">
                          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{property.name}</p><p className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{property.address || "Location not recorded"}</p></div><Building2 className="h-4 w-4 shrink-0 text-primary" /></div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-md bg-muted/40 p-2"><p className="text-[9px] uppercase text-muted-foreground">Units</p><p className="text-xs font-semibold">{property.units}</p></div><div className="rounded-md bg-muted/40 p-2"><p className="text-[9px] uppercase text-muted-foreground">Tenants</p><p className="text-xs font-semibold inline-flex items-center gap-1"><Users className="h-3 w-3" />{property.tenantCount}</p></div><div className="rounded-md bg-muted/40 p-2"><p className="text-[9px] uppercase text-muted-foreground">Occupancy</p><p className={`text-xs font-semibold ${occupancyRateColor(property.occupancyRate)}`}>{property.occupancyRate}%</p></div></div>
                        </Link>
                      ))}
                      {properties.length === 0 ? <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">No properties are linked to this landlord yet.</div> : null}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreate(); else setCreateOpen(true); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create landlord account</DialogTitle>
            <DialogDescription>Create the landlord's CALQULUS account yourself, then attach all relevant properties. The landlord can activate later; they do not need to complete an invitation flow first.</DialogDescription>
          </DialogHeader>
          {activationUrl ? (
            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div><p className="text-sm font-semibold">Account ready</p><p className="mt-1 text-xs text-muted-foreground">Give the landlord this secure activation link or send it through your normal communication channel. No password is exposed to the agency.</p></div>
              <div className="flex gap-2"><Input readOnly value={activationUrl} /><Button variant="outline" onClick={() => void copyActivation()}><Copy className="mr-2 h-4 w-4" />Copy</Button></div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="landlord-name">Landlord name</Label><Input id="landlord-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name or organisation" /></div>
                <div className="space-y-2"><Label htmlFor="landlord-email">Email</Label><Input id="landlord-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="landlord-phone">Phone <span className="text-muted-foreground">(optional)</span></Label><Input id="landlord-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254..." /></div>
              <div className="space-y-2"><div><Label>Assign properties</Label><p className="text-[10px] text-muted-foreground">Select multiple properties, including properties in different towns. Each property keeps its own operating and payment rules.</p></div><div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-2">{(data?.properties ?? []).map((property) => <label key={property.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 hover:bg-muted"><input type="checkbox" checked={propertyIds.includes(property.id)} onChange={(event) => setPropertyIds((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id !== property.id))} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{property.name}</span><span className="block truncate text-[10px] text-muted-foreground">{property.address || "Location not recorded"}</span></span><span className="text-[10px] text-muted-foreground">{property.tenantCount} tenants</span></label>)}{(data?.properties.length ?? 0) === 0 ? <p className="p-3 text-xs text-muted-foreground">Add properties before creating a landlord account.</p> : null}</div></div>
            </div>
          )}
          <DialogFooter>{activationUrl ? <Button onClick={resetCreate}>Done</Button> : <><Button variant="outline" onClick={resetCreate}>Cancel</Button><Button onClick={() => createAccount.mutate()} disabled={createAccount.isPending}>{createAccount.isPending ? "Creating…" : "Create account"}</Button></>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </AgencyLayout>
  );
}
