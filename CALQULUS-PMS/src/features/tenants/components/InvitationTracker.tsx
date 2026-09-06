import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { toast } from "@/shared/hooks/use-toast";
import { 
  Search, 
  Mail, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Copy,
  Loader2,
  MessageCircle,
  Phone,
  Trash2
} from "lucide-react";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";

interface Invitation {
  id: string;
  email: string;
  tenant_name: string;
  property_name: string;
  property_id: string | null;
  unit: string | null;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  invited_by: string;
}

export function InvitationTracker() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [deleteInvitation, setDeleteInvitation] = useState<Invitation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: invitations = [], isLoading, refetch } = useQuery({
    queryKey: ["tenant-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invitation[];
    },
  });

  // Categorize invitations
  const categorizedInvitations = invitations.reduce(
    (acc, inv) => {
      if (inv.status === "used") {
        acc.used.push(inv);
      } else if (isPast(parseISO(inv.expires_at))) {
        acc.expired.push(inv);
      } else {
        acc.pending.push(inv);
      }
      return acc;
    },
    { pending: [] as Invitation[], used: [] as Invitation[], expired: [] as Invitation[] }
  );

  const filterInvitations = (invs: Invitation[]) => {
    if (!searchQuery) return invs;
    const query = searchQuery.toLowerCase();
    return invs.filter(
      (inv) =>
        inv.tenant_name.toLowerCase().includes(query) ||
        inv.email.toLowerCase().includes(query) ||
        inv.property_name.toLowerCase().includes(query)
    );
  };

  const getInvitationUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/tenant/invitation?token=${token}`;
  };

  const handleCopyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(getInvitationUrl(token));
      toast({
        title: "Link copied!",
        description: "Invitation link copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResend = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-tenant-invitation", {
        body: {
          email: invitation.email,
          tenantName: invitation.tenant_name,
          propertyId: invitation.property_id,
          propertyName: invitation.property_name,
          unit: invitation.unit,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Invitation resent!",
        description: `A new invitation has been sent to ${invitation.email}.`,
      });

      refetch();
    } catch (err: unknown) {
      toast({
        title: "Failed to resend",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleSendSMS = async (invitation: Invitation, phoneNumber: string) => {
    setSendingSmsId(invitation.id);
    try {
      const invitationUrl = getInvitationUrl(invitation.token);
      const smsMessage = `Hi ${invitation.tenant_name}! You've been invited to join ${invitation.property_name}${invitation.unit ? ` (Unit ${invitation.unit})` : ""} on CALQULUS PMS. Create your account here: ${invitationUrl}`;

      const { data, error } = await supabase.functions.invoke("send-sms-notification", {
        body: {
          phoneNumber,
          message: smsMessage,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "SMS sent!",
          description: `Invitation SMS sent to ${phoneNumber}.`,
        });
      } else {
        throw new Error(data?.error || "Failed to send SMS");
      }
    } catch (err: unknown) {
      toast({
        title: "Failed to send SMS",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingSmsId(null);
    }
  };

  const handleWhatsAppShare = (invitation: Invitation) => {
    const invitationUrl = getInvitationUrl(invitation.token);
    const message = encodeURIComponent(
      `Hi ${invitation.tenant_name}! 👋\n\nYou've been invited to join ${invitation.property_name}${invitation.unit ? ` (Unit ${invitation.unit})` : ""} on CALQULUS PMS.\n\nClick the link below to create your tenant account:\n${invitationUrl}`
    );
    // Open WhatsApp without a specific number - user can choose recipient
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const handleDelete = async () => {
    if (!deleteInvitation) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_tenant_invitation_atomic', { p_invitation_id: deleteInvitation.id });

      if (error) throw error;

      toast({
        title: "Invitation deleted",
        description: "The invitation has been removed.",
      });

      refetch();
    } catch (err: unknown) {
      toast({
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteInvitation(null);
    }
  };

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.status === "used") {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Used
        </Badge>
      );
    }
    if (isPast(parseISO(invitation.expires_at))) {
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge className="bg-warning/10 text-warning border-warning/20">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const renderInvitationTable = (invs: Invitation[], showActions = true) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sent</TableHead>
          {showActions && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {invs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 5 : 4} className="text-center text-muted-foreground py-8">
              No invitations found
            </TableCell>
          </TableRow>
        ) : (
          invs.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{invitation.tenant_name}</p>
                  <p className="text-sm text-muted-foreground">{invitation.email}</p>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{invitation.property_name}</p>
                  {invitation.unit && (
                    <p className="text-sm text-muted-foreground">Unit {invitation.unit}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(invitation)}</TableCell>
              <TableCell>
                <div>
                  <p className="text-sm">
                    {formatDistanceToNow(parseISO(invitation.created_at), { addSuffix: true })}
                  </p>
                  {invitation.status !== "used" && (
                    <p className="text-xs text-muted-foreground">
                      {isPast(parseISO(invitation.expires_at))
                        ? "Expired"
                        : `Expires ${formatDistanceToNow(parseISO(invitation.expires_at), { addSuffix: true })}`}
                    </p>
                  )}
                  {invitation.used_at && (
                    <p className="text-xs text-success">
                      Used {formatDistanceToNow(parseISO(invitation.used_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {invitation.status !== "used" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyLink(invitation.token)}
                          title="Copy link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleWhatsAppShare(invitation)}
                          className="text-green-600 hover:text-green-700"
                          title="Send via WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResend(invitation)}
                          disabled={resendingId === invitation.id}
                          title="Resend email"
                        >
                          {resendingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteInvitation(invitation)}
                      className="text-destructive hover:text-destructive"
                      title="Delete invitation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invitation Tracker
            </CardTitle>
            <CardDescription>
              Track and manage tenant invitations
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg border bg-warning/5 border-warning/20">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium text-warning">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{categorizedInvitations.pending.length}</p>
          </div>
          <div className="p-4 rounded-lg border bg-success/5 border-success/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">Used</span>
            </div>
            <p className="text-2xl font-bold mt-1">{categorizedInvitations.used.length}</p>
          </div>
          <div className="p-4 rounded-lg border bg-red-500/5 border-red-500/20">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-600">Expired</span>
            </div>
            <p className="text-2xl font-bold mt-1">{categorizedInvitations.expired.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
              {categorizedInvitations.pending.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {categorizedInvitations.pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="used" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Used
            </TabsTrigger>
            <TabsTrigger value="expired" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Expired
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {renderInvitationTable(filterInvitations(categorizedInvitations.pending))}
          </TabsContent>

          <TabsContent value="used" className="mt-4">
            {renderInvitationTable(filterInvitations(categorizedInvitations.used), false)}
          </TabsContent>

          <TabsContent value="expired" className="mt-4">
            {renderInvitationTable(filterInvitations(categorizedInvitations.expired))}
          </TabsContent>
        </Tabs>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteInvitation} onOpenChange={() => setDeleteInvitation(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the invitation for{" "}
                <strong>{deleteInvitation?.tenant_name}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}