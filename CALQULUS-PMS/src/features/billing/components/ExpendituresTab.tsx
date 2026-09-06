/**
 * ExpendituresTab.tsx
 *
 * The full Expenditures tab content extracted from Billing.tsx.
 * Was ~280 lines of JSX inside the Billing component body.
 */

import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import {
  Zap, Droplets, Shield, Users, Receipt,
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet,
  Pencil, Save, X, Loader2,
} from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { formatDate } from "@/shared/lib/dateFormat";
import { useViewOnly } from "@/shared/contexts/ViewOnlyContext";
import { useSaveExpenditure } from "../hooks/useBillingData";
import type { BillingInvoice, BillingExpenditure } from "../hooks/useBillingData";

const EXPENDITURE_CATEGORIES = [
  { key: "electricity", label: "Electricity",     icon: Zap,      color: "text-warning" },
  { key: "water",       label: "Water",            icon: Droplets, color: "text-[hsl(195_60%_42%)]"   },
  { key: "security",    label: "Security",         icon: Shield,   color: "text-red-500"    },
  { key: "staff",       label: "Staff Salaries",   icon: Users,    color: "text-[hsl(218_58%_40%)]" },
  { key: "other",       label: "Other Expenses",   icon: Receipt,  color: "text-muted-foreground" },
] as const;

interface Props {
  invoices:     BillingInvoice[];
  expenditures: BillingExpenditure[];
  selectedMonth: string;                          // YYYY-MM
  onMonthChange: (month: string) => void;
}

export function ExpendituresTab({
  invoices,
  expenditures,
  selectedMonth,
  onMonthChange,
}: Props) {
  const { formatCurrency } = useCurrency();
  const { isViewOnly } = useViewOnly();
  const saveExpenditure = useSaveExpenditure();

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // ── Derived numbers ──────────────────────────────────────────────────────

  const [year, month] = selectedMonth.split("-").map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth   = new Date(year, month, 0);

  const monthlyPaidInvoices = invoices.filter(inv => {
    if (inv.status !== "paid" || !inv.paid_date) return false;
    const d = new Date(inv.paid_date);
    return d >= startOfMonth && d <= endOfMonth;
  });

  const monthlyIncome = monthlyPaidInvoices.reduce((s, i) => s + i.amount, 0);

  const getAmount = (category: string) =>
    expenditures.find(e => e.category === category)?.amount ?? 0;

  const totalExpenditures = EXPENDITURE_CATEGORIES.reduce(
    (s, c) => s + getAmount(c.key),
    0,
  );

  const netProfit = monthlyIncome - totalExpenditures;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const startEditing = (category: string) => {
    setEditingCategory(category);
    setEditValues(prev => ({ ...prev, [category]: getAmount(category).toString() }));
  };

  const cancelEditing = (category: string) => {
    setEditingCategory(null);
    setEditValues(prev => ({ ...prev, [category]: getAmount(category).toString() }));
  };

  const handleSave = (category: string, label: string) => {
    const amount      = parseFloat(editValues[category] ?? "0");
    const existing    = expenditures.find(e => e.category === category);

    saveExpenditure.mutate(
      { category, amount, month: selectedMonth, existingId: existing?.id, label },
      { onSuccess: () => setEditingCategory(null) },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-4">
        <Label htmlFor="month-select">Select Month:</Label>
        <Input
          id="month-select"
          type="month"
          value={selectedMonth}
          onChange={e => onMonthChange(e.target.value)}
          className="w-48 bg-card border-border"
        />
      </div>

      {/* Summary stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            icon: <ArrowUpRight className="h-6 w-6 text-[hsl(214_73%_48%)]" />,
            bg: "bg-[hsl(214_73%_48%/0.08)]",
            label: "Income (Payments)",
            value: formatCurrency(monthlyIncome),
            color: "text-[hsl(214_73%_48%)]",
          },
          {
            icon: <ArrowDownRight className="h-6 w-6 text-[hsl(215_20%_45%)]" />,
            bg: "bg-[hsl(215_20%_45%/0.06)]",
            label: "Total Expenditures",
            value: formatCurrency(totalExpenditures),
            color: "text-[hsl(222_47%_11%)]",
          },
          {
            icon: netProfit >= 0
              ? <TrendingUp className="h-6 w-6 text-[hsl(214_73%_48%)]" />
              : <TrendingDown className="h-6 w-6 text-[hsl(0_72%_51%)]" />,
            bg: netProfit >= 0 ? "bg-[hsl(214_73%_48%/0.08)]" : "bg-[hsl(0_72%_51%/0.05)]",
            label: `Net ${netProfit >= 0 ? "Profit" : "Loss"}`,
            value: formatCurrency(Math.abs(netProfit)),
            color: netProfit >= 0 ? "text-[hsl(214_73%_48%)]" : "text-[hsl(222_47%_11%)]",
          },
          {
            icon: <Wallet className="h-6 w-6 text-[hsl(214_73%_48%)]" />,
            bg: "bg-[hsl(214_73%_48%/0.1)]",
            label: "Payments Received",
            value: monthlyPaidInvoices.length.toString(),
            color: "text-foreground",
          },
        ].map(({ icon, bg, label, value, color }, i) => (
          <Card key={label} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`rounded-full p-3 ${bg}`}>{icon}</div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Income table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[hsl(214_73%_48%)]">
            <ArrowUpRight className="h-5 w-5" />
            Income (Payments Received)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyPaidInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No payments received this month
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-heading font-semibold">Invoice</TableHead>
                    <TableHead className="font-heading font-semibold">Tenant</TableHead>
                    <TableHead className="font-heading font-semibold">Property</TableHead>
                    <TableHead className="font-heading font-semibold">Paid Date</TableHead>
                    <TableHead className="font-heading font-semibold text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyPaidInvoices.map(inv => (
                    <TableRow key={inv.id} className="hover:bg-muted/30 border-border">
                      <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.tenants?.name ?? "N/A"}</TableCell>
                      <TableCell>
                        {inv.leases?.property ?? "N/A"}{" "}
                        {inv.leases?.unit}
                      </TableCell>
                      <TableCell>
                        {inv.paid_date ? formatDate(inv.paid_date) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[hsl(214_73%_48%)]">
                        +{formatCurrency(inv.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="hover:bg-transparent bg-[hsl(214_73%_48%/0.04)] border-border">
                    <TableCell colSpan={4} className="font-bold">Total Income</TableCell>
                    <TableCell className="text-right font-bold text-lg text-[hsl(214_73%_48%)]">
                      {formatCurrency(monthlyIncome)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenditure editable cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <ArrowDownRight className="h-5 w-5" />
            Expenditures (Outgoing)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            {EXPENDITURE_CATEGORIES.map((cat, i) => {
              const Icon       = cat.icon;
              const isEditing  = editingCategory === cat.key;
              const isSaving   = saveExpenditure.isPending && editingCategory === cat.key;
              const current    = getAmount(cat.key);

              return (
                <Card
                  key={cat.key}
                  className="animate-fade-in border-dashed"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${cat.color}`} />
                        {cat.label}
                      </div>
                      {!isViewOnly && (
                        isEditing ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              aria-label="Save category"
                              onClick={() => handleSave(cat.key, cat.label)}
                              disabled={isSaving}
                            >
                              {isSaving
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Save className="h-4 w-4 text-[hsl(214_73%_48%)]" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              aria-label="Cancel editing"
                              onClick={() => cancelEditing(cat.key)}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            aria-label="Edit category"
                            onClick={() => startEditing(cat.key)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          KSh
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editValues[cat.key] ?? "0"}
                          onChange={e =>
                            setEditValues(prev => ({ ...prev, [cat.key]: e.target.value }))
                          }
                          className="pl-12 text-lg font-semibold"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <p className="text-2xl font-bold text-muted-foreground">
                        -{formatCurrency(current)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly summary table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Monthly Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-heading font-semibold">Description</TableHead>
                  <TableHead className="font-heading font-semibold text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-muted/30 bg-[hsl(214_73%_48%/0.04)] border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-[hsl(214_73%_48%)]" />
                      <span className="font-medium">Total Income (Payments)</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-[hsl(214_73%_48%)]">
                    +{formatCurrency(monthlyIncome)}
                  </TableCell>
                </TableRow>

                {EXPENDITURE_CATEGORIES.map(cat => {
                  const Icon   = cat.icon;
                  const amount = getAmount(cat.key);
                  if (amount === 0) return null;
                  return (
                    <TableRow key={cat.key} className="hover:bg-muted/30 border-border">
                      <TableCell>
                        <div className="flex items-center gap-2 pl-4">
                      <Icon className={`h-4 w-4 ${cat.color}`} />
                      <span>{cat.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-muted-foreground">
                    -{formatCurrency(amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}

                <TableRow className="hover:bg-muted/30 border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Total Expenditures</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-muted-foreground">
                    -{formatCurrency(totalExpenditures)}
                  </TableCell>
                </TableRow>

                <TableRow
                  className={`hover:bg-transparent border-border ${netProfit >= 0 ? "bg-[hsl(214_73%_48%/0.04)]" : "bg-[hsl(0_72%_51%/0.04)]"}`}
                >
                  <TableCell className="font-bold text-lg">
                    Net {netProfit >= 0 ? "Profit" : "Loss"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold text-xl ${netProfit >= 0 ? "text-[hsl(214_73%_48%)]" : "text-[hsl(222_47%_11%)]"}`}
                  >
                    {netProfit >= 0 ? "+" : "-"}{formatCurrency(Math.abs(netProfit))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
