import React from 'react';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Shield, Crown, User, AlertTriangle } from 'lucide-react';

interface PermissionsShape {
  admin_level: 'super_admin' | 'admin' | 'limited_admin';
  can_manage_managers: boolean;
  can_manage_billing: boolean;
  can_manage_properties: boolean;
  can_manage_system_landlords: boolean;
  can_view_activity_logs: boolean;
  // can_create_webhosts intentionally excluded — super_admin only, not editable here
}

interface AdminPermissionsEditorProps {
  permissions: PermissionsShape;
  onChange: (permissions: PermissionsShape) => void;
  disabled?: boolean;
  isSuperAdminEditor?: boolean; // true when a super_admin is editing
}

const LEVEL_PRESETS: Record<PermissionsShape['admin_level'], Omit<PermissionsShape, 'admin_level'>> = {
  super_admin: {
    can_manage_managers: true,
    can_manage_billing: true,
    can_manage_properties: true,
    can_manage_system_landlords: true,
    can_view_activity_logs: true,
  },
  admin: {
    can_manage_managers: true,
    can_manage_billing: true,
    can_manage_properties: true,
    can_manage_system_landlords: true,
    can_view_activity_logs: true,
  },
  limited_admin: {
    can_manage_managers: false,
    can_manage_billing: false,
    can_manage_properties: false,
    can_manage_system_landlords: false,
    can_view_activity_logs: true,
  },
};

const PERMISSION_ROWS: { key: keyof Omit<PermissionsShape, 'admin_level'>; label: string; desc: string }[] = [
  {
    key: 'can_manage_managers',
    label: 'Manage managers',
    desc: 'Approve, reject, and view all property managers',
  },
  {
    key: 'can_manage_billing',
    label: 'Manage billing',
    desc: 'View and manage manager subscription invoices and platform payments',
  },
  {
    key: 'can_manage_properties',
    label: 'View properties',
    desc: 'View all properties and their basic stats (no tenant data)',
  },
  {
    key: 'can_manage_system_landlords',
    label: 'Manage system landlords',
    desc: 'Manage landlords not linked to any manager — approve their payout requests',
  },
  {
    key: 'can_view_activity_logs',
    label: 'View audit logs',
    desc: 'Access platform-wide audit and activity logs',
  },
];

const AdminPermissionsEditor: React.FC<AdminPermissionsEditorProps> = ({
  permissions,
  onChange,
  disabled = false,
  isSuperAdminEditor = false,
}) => {
  const handleLevelChange = (level: PermissionsShape['admin_level']) => {
    onChange({ admin_level: level, ...LEVEL_PRESETS[level] });
  };

  const handleToggle = (key: keyof Omit<PermissionsShape, 'admin_level'>, value: boolean) => {
    onChange({ ...permissions, [key]: value });
  };

  const levelIcon = {
    super_admin: <Crown className="h-3.5 w-3.5" />,
    admin: <Shield className="h-3.5 w-3.5" />,
    limited_admin: <User className="h-3.5 w-3.5" />,
  };

  return (
    <div className="space-y-5">
      {/* Admin level */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Admin level</Label>
        <Select
          value={permissions.admin_level}
          onValueChange={v => handleLevelChange(v as PermissionsShape['admin_level'])}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isSuperAdminEditor && (
              <SelectItem value="super_admin">
                <div className="flex items-center gap-2">
                  <Crown className="h-3.5 w-3.5 text-yellow-600" />
                  Super Admin — full platform control
                </div>
              </SelectItem>
            )}
            <SelectItem value="admin">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-[hsl(214_73%_45%)]" />
                Admin — broad management access
              </div>
            </SelectItem>
            <SelectItem value="limited_admin">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Limited admin — granular permission control
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tenant access notice — always shown */}
      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-red-200 rounded-lg text-xs text-destructive">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Tenant data is never accessible to any webhost admin.</strong> This is a platform-level
          rule that cannot be toggled. Tenants are managed exclusively by their property manager.
        </span>
      </div>

      {/* Permission toggles */}
      <div className="space-y-3">
        {PERMISSION_ROWS.map(({ key, label, desc }) => {
          const isForced = permissions.admin_level === 'super_admin' || permissions.admin_level === 'admin';
          return (
            <div key={key} className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{label}</span>
                  {isForced && (
                    <Badge variant="outline" className="text-xs h-4 px-1 border-[hsl(214_73%_48%/0.35)] text-[hsl(214_73%_45%)]">
                      auto
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <Switch
                checked={permissions[key] as boolean}
                onCheckedChange={v => handleToggle(key, v)}
                disabled={disabled || isForced}
                className="shrink-0 mt-0.5"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminPermissionsEditor;
