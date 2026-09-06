import React, { useState } from "react";
import { ShieldCheck, Lock, CheckCircle, XCircle, Eye, Edit3, Plus, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export interface RbacRole {
  id: string;
  roleName: string;
  category: "Platform Admin" | "Agency Manager" | "Property Staff" | "Tenant";
  userCount: number;
  permissions: Record<string, { read: boolean; create: boolean; update: boolean; delete: boolean; approve: boolean }>;
}

const MODULE_LIST = [
  { id: "properties", name: "Property & Unit Portfolio" },
  { id: "tenants", name: "Tenant Directory & Leases" },
  { id: "billing", name: "Invoices, STK Push & Receipts" },
  { id: "water_billing", name: "Water Meter Readings & Allocation" },
  { id: "maintenance", name: "Work Orders & Vendor Dispatch" },
  { id: "reports", name: "Financial & Occupancy Analytics" },
];

const INITIAL_ROLES: RbacRole[] = [
  {
    id: "role-super",
    roleName: "Super Webhost Administrator",
    category: "Platform Admin",
    userCount: 3,
    permissions: MODULE_LIST.reduce((acc, m) => {
      acc[m.id] = { read: true, create: true, update: true, delete: true, approve: true };
      return acc;
    }, {} as any),
  },
  {
    id: "role-manager",
    roleName: "Agency Team Manager",
    category: "Agency Manager",
    userCount: 28,
    permissions: MODULE_LIST.reduce((acc, m) => {
      acc[m.id] = { read: true, create: true, update: true, delete: m.id !== "reports", approve: true };
      return acc;
    }, {} as any),
  },
  {
    id: "role-staff",
    roleName: "Submanager / Leasing Staff",
    category: "Property Staff",
    userCount: 114,
    permissions: MODULE_LIST.reduce((acc, m) => {
      acc[m.id] = { read: true, create: m.id === "maintenance" || m.id === "water_billing", update: false, delete: false, approve: false };
      return acc;
    }, {} as any),
  },
];

export function VisualRbacEditor({ className }: { className?: string }) {
  const [roles, setRoles] = useState<RbacRole[]>(INITIAL_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState("role-manager");
  const [isPreviewImpactOpen, setIsPreviewImpactOpen] = useState(false);

  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  const handleTogglePermission = (moduleId: string, action: "read" | "create" | "update" | "delete" | "approve") => {
    setRoles((prevRoles) =>
      prevRoles.map((r) => {
        if (r.id !== activeRole.id) return r;
        const currentModPerms = r.permissions[moduleId] || { read: false, create: false, update: false, delete: false, approve: false };
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [moduleId]: {
              ...currentModPerms,
              [action]: !currentModPerms[action],
            },
          },
        };
      })
    );
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Role-Based Access Control (RBAC) Matrix</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Reference view of granular CRUD &amp; approval access per module and role tier. Actual access is enforced by backend Row-Level Security and the admin_permissions table.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsPreviewImpactOpen(!isPreviewImpactOpen)} className="h-8 text-xs font-semibold gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Preview Access Impact
          </Button>
          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Create Custom Role
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-6">
        <div className="p-2.5 rounded-lg border border-warning/20 bg-warning/5 text-[11px] flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <strong className="text-warning">Reference matrix.</strong> This view documents the intended role-permission architecture. The backend (<code className="font-mono">admin_permissions</code> + Row-Level Security) remains the source of truth; toggles here do not mutate live authorization.
          </p>
        </div>
        {/* Role Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoleId(r.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg border font-bold transition-all text-left shrink-0",
                r.id === activeRole.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border/80 hover:bg-muted"
              )}
            >
              <div>{r.roleName}</div>
              <span className="text-[10px] opacity-80 font-normal">{r.userCount} Active Users</span>
            </button>
          ))}
        </div>

        {/* Permission Matrix Table */}
        <div className="border border-border/80 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-muted/30 border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
              <tr>
                <th className="p-3">Module Name</th>
                <th className="p-3 text-center">Read</th>
                <th className="p-3 text-center">Create</th>
                <th className="p-3 text-center">Update</th>
                <th className="p-3 text-center">Delete</th>
                <th className="p-3 text-center">Approve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {MODULE_LIST.map((mod) => {
                const perms = activeRole.permissions[mod.id] || { read: false, create: false, update: false, delete: false, approve: false };
                return (
                  <tr key={mod.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-bold text-foreground">{mod.name}</td>
                    {(["read", "create", "update", "delete", "approve"] as const).map((act) => (
                      <td key={act} className="p-3 text-center">
                        <Checkbox
                          checked={perms[act]}
                          onCheckedChange={() => handleTogglePermission(mod.id, act)}
                          className="mx-auto"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Impact Preview Callout */}
        {isPreviewImpactOpen && (
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
            <span className="font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Live Access Simulation
            </span>
            <p className="text-muted-foreground">
              Users with role <strong>{activeRole.roleName}</strong> currently have access to {
                Object.values(activeRole.permissions).filter((p) => p.read).length
              } of {MODULE_LIST.length} system modules. Delete permissions are strictly restricted.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
