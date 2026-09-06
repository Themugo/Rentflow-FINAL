import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Loader2, UserCog, Shield, UserPlus, Eye, EyeOff, Globe, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/shared/components/ui/alert-dialog";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: "manager" | "tenant" | "webhost" | null;
  tenant_id: string | null;
  role_record_id: string | null;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
}

export const UserRoleManagement = () => {
  const { toast } = useToast();
  const { isManager, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<"manager">("manager");
  const [saving, setSaving] = useState(false);
  
  // Add Manager state
  const [addManagerOpen, setAddManagerOpen] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");
  const [newManagerEmail, setNewManagerEmail] = useState("");
  const [newManagerPassword, setNewManagerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [addingManager, setAddingManager] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, tenant_id");

      if (rolesError) throw rolesError;

      // Fetch tenants for assignment
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, name, email")
        .eq("status", "active");

      if (tenantsError) throw tenantsError;

      setTenants(tenantsData || []);

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: userRole?.role as "manager" | "tenant" | null,
          tenant_id: userRole?.tenant_id || null,
          role_record_id: userRole?.id || null,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isManager) {
      fetchData();
    }
  }, [isManager, fetchData]);

  const handleEditRole = (user: UserWithRole) => {
    setEditingUser(user);
    setSelectedRole("manager");
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const roleData = {
        user_id: editingUser.id,
        role: selectedRole,
        tenant_id: null,
      };

      const { error } = await supabase.rpc('assign_manager_role_atomic', { p_user_id: editingUser.id });
      if (error) throw error;

      toast({
        title: "Role Updated",
        description: `${editingUser.email}'s role has been updated to ${selectedRole}.`,
      });

      setEditingUser(null);
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddManager = async () => {
    if (!newManagerEmail || !newManagerPassword || !newManagerName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (newManagerPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setAddingManager(true);
    try {
      // Create the new user account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newManagerEmail,
        password: newManagerPassword,
        options: {
          data: {
            full_name: newManagerName,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast({
            title: "User Already Exists",
            description: "This email is already registered. You can assign them the manager role from the list below.",
            variant: "destructive",
          });
        } else {
          throw signUpError;
        }
        return;
      }

      if (signUpData.user) {
        // Create manager role for the new user
        const { error: roleError } = await supabase.rpc('assign_manager_role_atomic', { p_user_id: signUpData.user.id });

        if (roleError) {
          // Don't throw - user was created, just role failed
          toast({
            title: "Account Created",
            description: "Manager account created but role assignment failed. Please assign the role manually.",
            variant: "default",
          });
        } else {
          toast({
            title: "Manager Added",
            description: `${newManagerName} has been added as a manager. They can now log in with their credentials.`,
          });
        }
      }

      // Reset form and close dialog
      setNewManagerName("");
      setNewManagerEmail("");
      setNewManagerPassword("");
      setAddManagerOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add manager. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingManager(false);
    }
  };

  const handleRemoveManager = async (user: UserWithRole) => {
    if (!user.role_record_id) {
      toast({
        title: "Error",
        description: "No role found to remove.",
        variant: "destructive",
      });
      return;
    }

    setRemovingUserId(user.id);
    try {
      const { error } = await supabase.rpc('remove_manager_role_atomic', { p_user_id: user.id });
      if (error) throw error;

      toast({
        title: "Manager Removed",
        description: `${user.full_name || user.email} has been removed from the managerial team.`,
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove manager. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRemovingUserId(null);
    }
  };

  // Manager role minting/removal is now platform-admin-only. Managers use
  // SubmanagerManagement for scoped delegation instead.
  if (!isManager) {
    return null;
  }

  return (
    <>
      <Card className="card-shadow animate-fade-in" style={{ animationDelay: "150ms" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="font-heading flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              User Role Management
            </CardTitle>
            <CardDescription>Manage users and add new managers</CardDescription>
          </div>
          <Dialog open={addManagerOpen} onOpenChange={setAddManagerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Manager
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Manager</DialogTitle>
                <DialogDescription>
                  Create a new manager account. They will be able to log in immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="manager-name">Full Name</Label>
                  <Input
                    id="manager-name"
                    placeholder="John Doe"
                    value={newManagerName}
                    onChange={(e) => setNewManagerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager-email">Email</Label>
                  <Input
                    id="manager-email"
                    type="email"
                    placeholder="manager@example.com"
                    value={newManagerEmail}
                    onChange={(e) => setNewManagerEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager-password">Temporary Password</Label>
                  <div className="relative">
                    <Input
                      id="manager-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={newManagerPassword}
                      onChange={(e) => setNewManagerPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this password with the new manager. They can change it after logging in.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddManagerOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddManager} disabled={addingManager}>
                  {addingManager && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Manager
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.filter((user) => user.role !== "tenant").map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          <Badge
                            variant={user.role === "manager" ? "default" : user.role === "webhost" ? "secondary" : "outline"}
                            className="flex items-center gap-1 w-fit"
                          >
                            {user.role === "manager" ? (
                              <Shield className="h-3 w-3" />
                            ) : user.role === "webhost" ? (
                              <Globe className="h-3 w-3" />
                            ) : null}
                            {user.role === "manager" ? "Manager" : user.role === "webhost" ? "Webhost" : user.role}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No role
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRole(user)}
                          >
                            Edit Role
                          </Button>
                          {user.role_record_id && user.id !== currentUser?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  disabled={removingUserId === user.id}
                                >
                                  {removingUserId === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Manager</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {user.full_name || user.email} from the managerial team? They will lose access to management features.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveManager(user)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Assign a role to {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                <Shield className="h-4 w-4" />
                <span>Manager</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This user will be assigned the Manager role
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
