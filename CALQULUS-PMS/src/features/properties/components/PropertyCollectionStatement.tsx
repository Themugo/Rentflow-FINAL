import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Download, FileSpreadsheet, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { downloadPropertyStatementPDF } from '@/features/properties/lib/propertyStatementPdfExport';
import { useCurrency } from '@/shared/hooks/useCurrency';

interface Props {
  propertyId: string;
  propertyName: string;
}

interface UnitStatement {
  unit_id: string;
  label: string;           // house label e.g. R1, A3
  tenant_name: string;
  rent_payable: number;
  rent_paid: number;
  hse_deposit: number;
  hse_deposit_balance: number;
  water_dep: number;
  water_paid: number;
  water_bal: number;
  // Dynamic extra charges (garbage, security, etc.)
  extra_charges: { label: string; amount: number; paid: number }[];
  total: number;           // total charged this month
  bal: number;             // outstanding
  ref_no: string;
  paid_date: string;
  is_vacant: boolean;
  has_arrears: boolean;
}

const fmt = (n: number) =>
  n === 0 ? '-' : new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const PropertyCollectionStatement: React.FC<Props> = ({ propertyId, propertyName }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isDownloading, setIsDownloading] = useState(false);

  const startStr = `${month}-01`;
  const endStr = new Date(new Date(startStr).getFullYear(), new Date(startStr).getMonth() + 1, 0)
    .toISOString().slice(0, 10);
  const monthLabel = format(new Date(startStr), 'MMMM yyyy');

  const { data: statement, isLoading, refetch } = useQuery({
    queryKey: ['property-statement', propertyId, month],
    queryFn: async () => {
      const [unitsRes, tenantsRes, invoicesRes, waterRes, chargesRes, txRes] = await Promise.all([
        supabase.from('units')
          .select('id, unit_number, label, status, monthly_rent, house_deposit, water_deposit')
          .eq('property_id', propertyId)
          .order('unit_number'),
        supabase.from('tenants')
          .select('id, name, unit_id, status, monthly_rent')
          .eq('property_id', propertyId),
        supabase.from('invoices')
          .select('id, tenant_id, amount, paid_amount, balance_due, status, paid_date, description, invoice_number')
          .gte('due_date', startStr).lte('due_date', endStr),
        supabase.from('water_meter_readings')
          .select('unit_id, total_amount, status')
          .eq('property_id', propertyId)
          .gte('reading_date', startStr).lte('reading_date', endStr),
        supabase.from('unit_charge_configs')
          .select('unit_id, charge_type, charge_label, amount, is_active, is_metered')
          .eq('property_id', propertyId).eq('is_active', true),
        supabase.from('payment_transactions')
          .select('tenant_id, bank_reference, mpesa_receipt_number, completed_at, amount')
          .eq('property_id', propertyId)
          .gte('completed_at', startStr).lte('completed_at', endStr + 'T23:59:59')
          .eq('status', 'completed'),
      ]);

      const units = (unitsRes.data || []) as { id: string; unit_number: string; label: string | null; status: string; monthly_rent: number; house_deposit: number; water_deposit: number }[];
      const tenants = (tenantsRes.data || []) as { id: string; name: string; unit_id: string; status: string; monthly_rent: number }[];
      const invoices = (invoicesRes.data || []) as { id: string; tenant_id: string; amount: number; paid_amount: number | null; balance_due: number; status: string; paid_date: string | null; description: string | null; invoice_number: string }[];
      const water = (waterRes.data || []) as { unit_id: string; total_amount: number; status: string }[];
      const charges = (chargesRes.data || []) as { unit_id: string; charge_type: string; charge_label: string; amount: number; is_active: boolean; is_metered: boolean }[];
      const txs = (txRes.data || []) as { tenant_id: string; bank_reference: string | null; mpesa_receipt_number: string | null; completed_at: string; amount: number }[];

      // Collect all unique non-rent/non-water extra charge types for columns
      const extraTypes = Array.from(
        new Set(
          charges
            .filter(c => !['rent', 'water'].includes(c.charge_type))
            .map(c => c.charge_type)
        )
      );

      const rows: UnitStatement[] = units.map(unit => {
        const tenant = tenants.find(t => t.unit_id === unit.id && t.status === 'active');
        const isVacant = !tenant;

        // Rent
        const rentPayable = tenant?.monthly_rent ?? unit.monthly_rent ?? 0;
        const tenantInvoices = tenant
          ? invoices.filter(i => i.tenant_id === tenant.id)
          : [];

        const rentInvoices = tenantInvoices.filter(
          i => !i.description?.toLowerCase().includes('water') &&
               !i.description?.toLowerCase().includes('garbage') &&
               !i.description?.toLowerCase().includes('security')
        );
        const rentPaid = rentInvoices
          .reduce((s: number, i: { paid_amount: number | null; amount: number; status: string }) => {
            if (i.status === 'cancelled' || i.status === 'failed' || i.status === 'refunded') return s;
            return s + Number(i.paid_amount ?? 0);
          }, 0);

        // Deposits
        const hseDep = unit.house_deposit ?? 0;
        const waterDep = unit.water_deposit ?? 0;

        // Water
        const unitWater = water.filter(r => r.unit_id === unit.id);
        const waterCharge = charges.find(c => c.unit_id === unit.id && c.charge_type === 'water');
        const waterBilled = unitWater.reduce((s: number, r: { total_amount: number }) => s + Number(r.total_amount ?? 0), 0) ||
                            (waterCharge?.amount ?? 0);
        const waterInvoices = tenantInvoices.filter(i => i.description?.toLowerCase().includes('water'));
        const waterPaid = waterInvoices
          .reduce((s: number, i: { paid_amount: number | null; amount: number; status: string }) => {
            if (i.status === 'cancelled' || i.status === 'failed' || i.status === 'refunded') return s;
            return s + Number(i.paid_amount ?? 0);
          }, 0);
        const waterBal = Math.max(0, waterBilled - waterPaid);

        // Extra charges (garbage, security, etc.)
        const unitCharges = charges.filter(
          c => c.unit_id === unit.id && !['rent', 'water'].includes(c.charge_type)
        );
        const extraCharges = unitCharges.map(c => {
          const matchedInv = tenantInvoices.find(
            i => i.description?.toLowerCase().includes(c.charge_label.toLowerCase())
          );
          return {
            label: c.charge_label,
            amount: Number(c.amount),
            paid: matchedInv && !['cancelled', 'failed', 'refunded'].includes(matchedInv.status)
              ? Number(matchedInv.paid_amount ?? 0)
              : 0,
          };
        });

        // Total billed this month
        const extraTotal = extraCharges.reduce((s, e) => s + e.amount, 0);
        const total = rentPayable + waterBilled + extraTotal;

        // Balance
        const extraPaid = extraCharges.reduce((s, e) => s + e.paid, 0);
        const totalPaid = rentPaid + waterPaid + extraPaid;
        const bal = Math.max(0, total - totalPaid);

        // Payment reference
        const tenantTxs = txs.filter(t => t.tenant_id === tenant?.id);
        const lastTx = tenantTxs[tenantTxs.length - 1];
        const refNo = lastTx?.mpesa_receipt_number || lastTx?.bank_reference || '';
        const paidDate = lastTx?.completed_at
          ? format(new Date(lastTx.completed_at), 'dd/MM')
          : '';

        return {
          unit_id: unit.id,
          label: unit.label || unit.unit_number,
          tenant_name: tenant?.name ?? '',
          rent_payable: rentPayable,
          rent_paid: rentPaid,
          hse_deposit: hseDep,
          hse_deposit_balance: hseDep,  // simplified — full deposit tracked in ledger
          water_dep: waterDep,
          water_paid: waterPaid,
          water_bal: waterBal,
          extra_charges: extraCharges,
          total,
          bal,
          ref_no: refNo,
          paid_date: paidDate,
          is_vacant: isVacant,
          has_arrears: bal > 0 && !isVacant,
        };
      });

      const extraTypes2 = Array.from(
        new Set(rows.flatMap(r => r.extra_charges.map(e => e.label)))
      );

      const totals = rows.reduce(
        (t, r) => ({
          rent_payable: t.rent_payable + r.rent_payable,
          rent_paid: t.rent_paid + r.rent_paid,
          hse_deposit: t.hse_deposit + r.hse_deposit,
          water_paid: t.water_paid + r.water_paid,
          water_bal: t.water_bal + r.water_bal,
          total: t.total + r.total,
          bal: t.bal + r.bal,
        }),
        { rent_payable: 0, rent_paid: 0, hse_deposit: 0, water_paid: 0, water_bal: 0, total: 0, bal: 0 }
      );

      return { rows, totals, extraColumns: extraTypes2, monthLabel };
    },
    enabled: !!propertyId,
  });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadPropertyStatementPDF(propertyId, new Date(startStr), currency);
      toast({ title: 'Statement downloaded' });
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
    setIsDownloading(false);
  };

  const rows = statement?.rows ?? [];
  const totals = statement?.totals;
  const extraCols = statement?.extraColumns ?? [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Month</Label>
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading || rows.length === 0}
          className="gap-2"
        >
          {isDownloading
            ? <><RefreshCw className="h-4 w-4 animate-spin" />Generating…</>
            : <><Download className="h-4 w-4" />Download PDF</>
          }
        </Button>
        {statement && (
          <div className="text-xs text-muted-foreground ml-auto">
            {rows.length} units · {rows.filter(r => !r.is_vacant).length} occupied
            {totals && totals.bal > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · {fmtFull(totals.bal)} outstanding
              </span>
            )}
          </div>
        )}
      </div>

      {/* Statement table — matches uploaded sheet format */}
      <div className="overflow-x-auto rounded-lg border border-border">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No units found for this property" />
        ) : (
          <table className="w-full text-xs border-collapse" style={{ minWidth: '900px' }}>
            <thead>
              {/* Header row 1 — group labels (light blue like the sheet) */}
              <tr style={{ background: '#ADD8E6', fontWeight: 600 }}>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>HSE NO</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>Rent<br />Payable</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>Name</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>Rent</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>Hse<br />Deposit</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" colSpan={3}>Water</th>
                {extraCols.map(col => (
                  <th key={col} className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>{col}</th>
                ))}
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>Total</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>BAL</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>Ref No</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center" rowSpan={2}>Date</th>
              </tr>
              <tr style={{ background: '#ADD8E6', fontWeight: 600 }}>
                <th className="border border-gray-400 px-2 py-1.5 text-center">H2O dep</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">H2O Paid</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">H2O Bal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rowBg = row.has_arrears
                  ? '#FFFF99'                          // yellow for arrears (like R19 in sheet)
                  : row.is_vacant
                    ? '#F5F5F5'                        // light grey for vacant
                    : i % 2 === 0 ? '#EBF5FF' : '#FFFFFF'; // alternating blue-white

                return (
                  <tr key={row.unit_id} style={{ background: rowBg }}>
                    <td className="border border-gray-300 px-2 py-1 text-center font-semibold">{row.label}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {row.rent_payable > 0 ? fmt(row.rent_payable) : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {row.is_vacant
                        ? <span className="text-muted-foreground italic">Vacant</span>
                        : row.tenant_name
                      }
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {row.rent_paid > 0 ? fmt(row.rent_paid) : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {row.hse_deposit > 0 ? fmt(row.hse_deposit) : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {row.water_dep > 0 ? fmt(row.water_dep) : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {row.water_paid > 0 ? fmt(row.water_paid) : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {row.water_bal > 0 ? (
                        <span className="text-red-600 font-medium">{fmt(row.water_bal)}</span>
                      ) : ''}
                    </td>
                    {extraCols.map(col => {
                      const charge = row.extra_charges.find(e => e.label === col);
                      return (
                        <td key={col} className="border border-gray-300 px-2 py-1 text-right">
                          {charge?.amount ? fmt(charge.amount) : ''}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                      {row.total > 0 ? fmt(row.total) : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {row.bal > 0 ? (
                        <span className="text-red-700 font-bold">{fmt(row.bal)}</span>
                      ) : row.is_vacant ? '' : (
                        <span className="text-green-600 text-xs">–</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-mono text-xs text-muted-foreground">
                      {row.ref_no}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-muted-foreground">
                      {row.paid_date}
                    </td>
                  </tr>
                );
              })}

              {/* TOTALS row */}
              {totals && (
                <tr style={{ background: '#C8E6FF', fontWeight: 700 }}>
                  <td className="border border-gray-400 px-2 py-1.5 text-center font-bold">TOTAL</td>
                  <td className="border border-gray-400 px-2 py-1.5 text-right font-bold">{fmt(totals.rent_payable)}</td>
                  <td className="border border-gray-400 px-2 py-1.5" />
                  <td className="border border-gray-400 px-2 py-1.5 text-right font-bold">{fmt(totals.rent_paid)}</td>
                  <td className="border border-gray-400 px-2 py-1.5 text-right">
                    {totals.hse_deposit > 0 ? fmt(totals.hse_deposit) : '-'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-center">-</td>
                  <td className="border border-gray-400 px-2 py-1.5 text-right">
                    {totals.water_paid > 0 ? fmt(totals.water_paid) : '-'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-right">
                    {totals.water_bal > 0 ? <span className="text-red-700">{fmt(totals.water_bal)}</span> : '-'}
                  </td>
                  {extraCols.map(col => (
                    <td key={col} className="border border-gray-400 px-2 py-1.5 text-right">
                      {fmt(rows.reduce((s, r) => s + (r.extra_charges.find(e => e.label === col)?.amount ?? 0), 0))}
                    </td>
                  ))}
                  <td className="border border-gray-400 px-2 py-1.5 text-right font-bold">{fmt(totals.total)}</td>
                  <td className="border border-gray-400 px-2 py-1.5 text-right font-bold text-red-700">
                    {totals.bal > 0 ? fmt(totals.bal) : '-'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5" />
                  <td className="border border-gray-400 px-2 py-1.5" />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary cards */}
      {totals && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Rent payable', value: totals.rent_payable, color: 'text-foreground' },
            { label: 'Rent collected', value: totals.rent_paid, color: 'text-foreground' },
            { label: 'Water collected', value: totals.water_paid, color: 'text-[hsl(195_60%_32%)]' },
            {
              label: 'Total outstanding',
              value: totals.bal,
              color: totals.bal > 0 ? 'text-destructive' : 'text-foreground',
              icon: totals.bal > 0 ? AlertTriangle : undefined,
            },
          ].map(stat => (
            <div key={stat.label} className="bg-muted/30 rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-lg font-semibold ${stat.color}`}>{fmtFull(stat.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block" style={{ background: '#FFFF99', border: '1px solid #ccc' }} />
          Has outstanding balance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block" style={{ background: '#EBF5FF', border: '1px solid #ccc' }} />
          Paid / no balance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block" style={{ background: '#F5F5F5', border: '1px solid #ccc' }} />
          Vacant
        </span>
      </div>
    </div>
  );
};

export default PropertyCollectionStatement;
