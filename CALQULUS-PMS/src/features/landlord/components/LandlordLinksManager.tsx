import { format } from "date-fns";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { UserPlus, Trash2, User, Building2, Mail, Phone } from "lucide-react";
import { errorToast } from "@/shared/lib/errorToast";

interface PropertyLandlordLink {
  id: string;
  property_id: string;
  revenue_share_pct: number;
  assigned_at: string | null;
  landlord_user_id: string | null;
}

interface PropertyBrief {
  id: string;
  name: string;
  address: string;
}

interface ProfileBrief {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface PropertyLandlordRow {
  id: string;
  property_id: string;
  property_name: string;
  property_address: string;
  landlord_user_id: string | null;
  landlord_name: string | null;
  landlord_email: string | null;
  landlord_phone: string | null;
  revenue_share_pct: number;
  assigned_at: string | null;
}

const LandlordLinksManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPropertyId, setLinkPropertyId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [revenueShare, setRevenueShare] = useState("100");
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);

  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ["manager-landlords", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links, error } = await supabase
        .from("property_landlords")
        .select("id, property_id, revenue_share_pct, assigned_at, landlord_user_id")
        .eq("manager_id", user.id);

      if (error) throw error;
      if (!links || links.length === 0) return [];

      const typedLinks = links as PropertyLandlordLink[];
      const propIds = typedLinks.map(l => l.property_id);
      const { data: properties } = await supabase
        .from("properties")
        .select("id, name, address")
        .in("id", propIds);

      const propMap = new Map((properties || []).map((p: PropertyBrief) => [p.id, p]));

      const landlordIds = typedLinks.filter(l => l.landlord_user_id).map(l => l.landlord_user_id!);
      const { data: profiles } = landlordIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", landlordIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: ProfileBrief) => [p.id, p]));

      return typedLinks.map((link) => {
        const prop = propMap.get(link.property_id);
        const prof = link.landlord_user_id ? profileMap.get(link.landlord_user_id) : null;
        return {
          id: link.id,
          property_id: link.property_id,
          property_name: prop?.name ?? "Unknown",
          property_address: prop?.address ?? "",
          landlord_user_id: link.landlord_user_id,
          landlord_name: prof?.full_name ?? null,
          landlord_email: prof?.email ?? null,
          landlord_phone: prof?.phone ?? null,
          revenue_share_pct: link.revenue_share_pct ?? 100,
          assigned_at: link.assigned_at,
        } satisfies PropertyLandlordRow;
      });
    },
  });

  const { data: unlinkedProperties = [] } = useQuery({
    queryKey: ["unlinked-properties", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: linked } = await supabase
        .from("property_landlords")
        .select("property_id")
        .eq("manager_id", user.id);
      const typedLinked = (linked || []) as { property_id: string }[];
      const linkedIds = new Set(typedLinked.map(l => l.property_id));

      const { data: allProps } = await supabase
        .from("properties")
        .select("id, name")
        .eq("manager_id", user.id)
        .neq("status", "inactive");

      return ((allProps || []) as { id: string; name: string }[]).filter(p => !linkedIds.has(p.id));
    },
  });

  const linkLandlord = useMutation({
    mutationFn: async () => {
      if (!linkPropertyId) throw new Error("No property selected");
      if (!inviteEmail.trim()) throw new Error("Email is required");
      const share = parseFloat(revenueShare);
      if (isNaN(share) || share < 0 || share > 100) throw new Error("Revenue share must be 0–100");

      const { data: existingRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "landlord");

      const typedRoles = (existingRoles || []) as { user_id: string }[];
      if (typedRoles.length > 0) {
        const userIds = typedRoles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds)
          .eq("email", inviteEmail.trim().toLowerCase());

        if (profiles && profiles.length > 0) {
          const landlordUserId = profiles[0].id;
          const { error } = await supabase.rpc('link_landlord_atomic' as never, {
            p_property_id: linkPropertyId, p_landlord_user_id: landlordUserId, p_revenue_share_pct: share
          });
          if (error) throw error;
          return { type: "linked" };
        }
      }

      const { error } = await supabase.rpc('create_landlord_invitation_atomic' as never, {
        p_property_id: linkPropertyId, p_email: inviteEmail.trim().toLowerCase()
      });
      if (error) throw error;
      return { type: "invited" };
    },
    onSuccess: ({ type }) => {
      queryClient.invalidateQueries({ queryKey: ["manager-landlords"] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-properties"] });
      toast({
        title: type === "linked" ? "Landlord linked" : "Invitation sent",
        description: type === "linked" ? "The landlord has been linked to this property." : `An invitation has been sent to ${inviteEmail}`,
      });
      setLinkDialogOpen(false);
      setLinkPropertyId(null);
      setInviteEmail("");
      setRevenueShare("100");
    },
    onError: (err: Error) => errorToast("Failed", err),
  });

  const unlinkLandlord = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.rpc('unlink_landlord_atomic' as never, { p_link_id: linkId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-landlords"] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-properties"] });
      toast({ title: "Landlord unlinked" });
      setUnlinkTarget(null);
    },
    onError: (err: Error) => errorToast("Failed", err),
  });

  return (
    <>
      <div className="space-y-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : landlords.length === 0 && unlinkedProperties.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No properties found"
            description="Add a property first to link landlords."
          />
        ) : (
          <>
            {unlinkedProperties.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Link a Landlord
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {unlinkedProperties.map((prop) => (
                      <div key={prop.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{prop.name}</p>
                          <p className="text-xs text-muted-foreground">No landlord linked</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1"
                          onClick={() => {
                            setLinkPropertyId(prop.id);
                            setLinkDialogOpen(true);
                          }}
                        >
                          <UserPlus className="h-3 w-3" />
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {landlords.map((link) => (
                <Card key={link.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <span className="text-warning font-semibold text-sm">
                            {(link.landlord_name || link.landlord_email || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{link.property_name}</p>
                          {link.landlord_name && <p className="text-xs text-muted-foreground">{link.landlord_name}</p>}
                          {link.landlord_email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />{link.landlord_email}
                            </p>
                          )}
                          {link.landlord_phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />{link.landlord_phone}
                            </p>
                          )}
                          {!link.landlord_user_id && (
                            <Badge variant="outline" className="mt-1 text-xs border-amber-200 text-warning bg-amber-50">
                              Invitation pending
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className="mb-1">{link.revenue_share_pct}% share</Badge>
                        {link.assigned_at && (
                          <p className="text-xs text-muted-foreground">
                            Since {format(new Date(link.assigned_at), "dd/MM/yy")}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                          onClick={() => setUnlinkTarget(link.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Unlink
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Link Landlord Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a Landlord</DialogTitle>
            <DialogDescription>
              Enter the landlord's email. If they already have an account they'll be linked immediately.
              Otherwise an invitation will be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Landlord email</Label>
              <Input type="email" placeholder="owner@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Revenue share % (landlord's cut)</Label>
              <Input type="number" min="0" max="100" step="0.5" placeholder="100" value={revenueShare} onChange={(e) => setRevenueShare(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Percentage of property revenue that goes to the landlord. Default: 100%</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => linkLandlord.mutate()} disabled={linkLandlord.isPending}>
              {linkLandlord.isPending ? "Linking..." : "Link Landlord"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink confirm dialog */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink landlord?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the landlord from this property. They will lose access to this property's data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => unlinkTarget && unlinkLandlord.mutate(unlinkTarget)}>
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LandlordLinksManager;
