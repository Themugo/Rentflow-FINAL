// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/**
 * PaymentSetupStatus — Per-property plug-and-play readiness (M-Pesa, bank, receipts).
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  Smartphone,
  Building2,
  Receipt,
  CheckCircle2,
  Circle,
  ArrowRight,
  Plug,
} from 'lucide-react';

async function fetchMpesaList() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { list: [] as { property_id: string | null; ready: boolean }[] };
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-mpesa-settings?list=all`,
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  );
  if (!res.ok) return { list: [] };
  return res.json() as { list: { property_id: string | null; ready: boolean }[] };
}

export const PaymentSetupStatus = () => {
  const { user, isManager } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['payment-setup-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [propertiesRes, mpesaListRes, bankRes, receiptRes] = await Promise.all([
        supabase.from('properties').select('id, name').eq('manager_id', user.id).order('name'),
        fetchMpesaList(),
        supabase
          .from('bank_integration_settings')
          .select('id, property_id, is_active, bank_name')
          .eq('manager_id', user.id),
        supabase
          .from('receipt_settings')
          .select('auto_send_receipts')
          .eq('manager_user_id', user.id)
          .maybeSingle(),
      ]);

      const properties = propertiesRes.data ?? [];
      const mpesaByProperty = new Map<string | null, boolean>();
      for (const row of mpesaListRes.list ?? []) {
        mpesaByProperty.set(row.property_id, row.ready);
      }

      const bankByProperty = new Map<string | null, boolean>();
      for (const row of bankRes.data ?? []) {
        if (row.is_active) {
          bankByProperty.set(row.property_id, true);
        }
      }

      const receiptsOn = receiptRes.data?.auto_send_receipts !== false;

      const rows = [
        {
          id: 'default',
          name: 'Company default',
          mpesaReady: mpesaByProperty.get(null) ?? false,
          bankReady: bankByProperty.get(null) ?? false,
        },
        ...properties.map((p) => ({
          id: p.id,
          name: p.name,
          mpesaReady: mpesaByProperty.get(p.id) ?? mpesaByProperty.get(null) ?? false,
          bankReady: bankByProperty.get(p.id) ?? bankByProperty.get(null) ?? false,
        })),
      ];

      const configured = rows.filter((r) => r.mpesaReady || r.bankReady).length;
      const score = properties.length
        ? Math.round((configured / rows.length) * 100)
        : rows[0]?.mpesaReady
          ? 100
          : 0;

      return { rows, score, receiptsOn, propertyCount: properties.length };
    },
    enabled: !!user?.id && isManager,
  });

  if (!isManager) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Payment setup by property</CardTitle></CardHeader>
        <CardContent><div className="h-2 bg-muted rounded animate-pulse" /></CardContent>
      </Card>
    );
  }

  const score = data?.score ?? 0;
  const allReady = score >= 100 && (data?.receiptsOn ?? false);

  return (
    <Card className={allReady ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/20'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4 text-warning" />
            Payment setup by property
          </CardTitle>
          <Badge variant={allReady ? 'default' : 'secondary'} className={allReady ? 'bg-green-600' : ''}>
            {score}% properties ready
          </Badge>
        </div>
        <CardDescription>
          Each property can have its own M-Pesa paybill and bank webhook. Missing per-property config
          falls back to company default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={score} className="h-2" />

        <div className="flex items-center gap-2 text-sm">
          {data?.receiptsOn ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span>Instant receipts {data?.receiptsOn ? 'enabled' : 'off'}</span>
          {!data?.receiptsOn && (
            <Button variant="link" size="sm" className="h-auto p-0 ml-auto" asChild>
              <Link to="/settings?tab=receipts">Enable</Link>
            </Button>
          )}
        </div>

        {(data?.rows.length ?? 0) > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-center">M-Pesa</TableHead>
                  <TableHead className="text-center">Bank</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-center">
                      {row.mpesaReady ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.bankReady ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.id !== 'default' && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/properties/${row.id}?tab=settings`}>
                            Configure <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Button asChild className="w-full sm:w-auto">
          <Link to="/settings?tab=payments">
            <Building2 className="h-4 w-4 mr-2" />
            Open payment settings
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default PaymentSetupStatus;
