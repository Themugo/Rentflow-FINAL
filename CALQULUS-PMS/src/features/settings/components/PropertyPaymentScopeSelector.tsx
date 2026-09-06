/**
 * Pick which property's payment accounts to configure (or company-wide default).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Building2 } from 'lucide-react';

export type PropertyScope = string | null;

interface PropertyPaymentScopeSelectorProps {
  value: PropertyScope;
  onChange: (propertyId: PropertyScope) => void;
  className?: string;
}

export function PropertyPaymentScopeSelector({
  value,
  onChange,
  className,
}: PropertyPaymentScopeSelectorProps) {
  const { user, isManager } = useAuth();
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user?.id || !isManager) return;
    supabase
      .from('properties')
      .select('id, name')
      .eq('manager_id', user.id)
      .order('name')
      .then(({ data }) => setProperties(data ?? []));
  }, [user?.id, isManager]);

  if (!isManager) return null;

  return (
    <div className={className}>
      <Label className="text-sm font-medium flex items-center gap-2 mb-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        Configure payments for
      </Label>
      <Select
        value={value ?? 'default'}
        onValueChange={(v) => onChange(v === 'default' ? null : v)}
      >
        <SelectTrigger className="w-full max-w-md">
          <SelectValue placeholder="Select property" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">
            Company default (fallback when a property has no own account)
          </SelectItem>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-2">
        Each property can use its own M-Pesa paybill, bank account, and e-wallet. Tenants pay into the
        account linked to their unit&apos;s property.
      </p>
    </div>
  );
}
