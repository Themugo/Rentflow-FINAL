// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { BRAND_CHART_COLORS } from "@/shared/lib/chartColors";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { Button } from "@/shared/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  Building2,
  PieChartIcon,
} from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useState, useMemo } from "react";

type RequestStatus = "open" | "in_progress" | "completed" | "cancelled";

interface MaintenanceRequest {
  id: string;
  title: string;
  property_name: string;
  status: RequestStatus;
  priority: string;
  category: string;
  budget: number | null;
  completion_date: string | null;
}

interface MaintenanceBudgetDashboardProps {
  requests: MaintenanceRequest[];
}

const COLORS = BRAND_CHART_COLORS;

export function MaintenanceBudgetDashboard({
  requests,
}: MaintenanceBudgetDashboardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { formatCurrency } = useCurrency();

  // Calculate budget data by property
  const budgetByProperty = useMemo(() => {
    const propertyBudgets: Record<string, { allocated: number; spent: number; pending: number }> = {};

    requests.forEach((req) => {
      const property = req.property_name || "Unknown";
      if (!propertyBudgets[property]) {
        propertyBudgets[property] = { allocated: 0, spent: 0, pending: 0 };
      }

      if (req.budget) {
        propertyBudgets[property].allocated += req.budget;
        if (req.status === "completed") {
          propertyBudgets[property].spent += req.budget;
        } else if (req.status !== "cancelled") {
          propertyBudgets[property].pending += req.budget;
        }
      }
    });

    return Object.entries(propertyBudgets)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        fullName: name,
        allocated: data.allocated,
        spent: data.spent,
        pending: data.pending,
      }))
      .sort((a, b) => b.allocated - a.allocated)
      .slice(0, 8);
  }, [requests]);

  // Calculate budget by category
  const budgetByCategory = useMemo(() => {
    const categoryBudgets: Record<string, number> = {};

    requests.forEach((req) => {
      const category = req.category || "Other";
      if (req.budget) {
        categoryBudgets[category] = (categoryBudgets[category] || 0) + req.budget;
      }
    });

    return Object.entries(categoryBudgets)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [requests]);

  // Calculate totals
  const totalAllocated = requests.reduce((sum, r) => sum + (r.budget || 0), 0);
  const totalSpent = requests
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (r.budget || 0), 0);
  const totalPending = requests
    .filter((r) => r.status === "open" || r.status === "in_progress")
    .reduce((sum, r) => sum + (r.budget || 0), 0);
  
  const spentPercentage = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  if (totalAllocated === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <Card className="bg-card border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">Budget Dashboard</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(totalSpent)} spent of {formatCurrency(totalAllocated)} allocated
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    {spentPercentage}% utilized
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" aria-label={isOpen ? "Collapse" : "Expand"}>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-amber-400/10 border border-amber-400/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">Total Allocated</span>
                </div>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">Spent</span>
                </div>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalSpent)}</p>
              </div>
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">Pending</span>
                </div>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalPending)}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-500/10 border border-slate-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <PieChartIcon className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-400">Utilization</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-foreground">{spentPercentage}%</p>
                  <Progress value={spentPercentage} className="flex-1 h-2" />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Budget by Property Bar Chart */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Budget by Property
                </h3>
                {budgetByProperty.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={budgetByProperty} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === "spent" ? "Spent" : name === "pending" ? "Pending" : "Allocated"
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend />
                      <Bar dataKey="spent" name="Spent" fill="hsl(142, 71%, 45%)" stackId="a" />
                      <Bar dataKey="pending" name="Pending" fill="hsl(45, 93%, 47%)" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No budget data available
                  </div>
                )}
              </div>

              {/* Budget by Category Pie Chart */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" />
                  Budget by Category
                </h3>
                {budgetByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={budgetByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {budgetByCategory.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No category data available
                  </div>
                )}
              </div>
            </div>

            {/* Property Budget Details Table */}
            {budgetByProperty.length > 0 && (
              <div className="mt-6 rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Property</th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Allocated</th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Spent</th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Pending</th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetByProperty.map((property, index) => {
                      const utilization = property.allocated > 0 
                        ? Math.round((property.spent / property.allocated) * 100) 
                        : 0;
                      return (
                        <tr key={index} className="border-t border-border">
                          <td className="p-3 text-sm font-medium text-foreground">{property.fullName}</td>
                          <td className="p-3 text-sm text-right text-muted-foreground">{formatCurrency(property.allocated)}</td>
                          <td className="p-3 text-sm text-right text-green-500">{formatCurrency(property.spent)}</td>
                          <td className="p-3 text-sm text-right text-warning">{formatCurrency(property.pending)}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={utilization} className="w-16 h-2" />
                              <span className="text-sm text-muted-foreground w-10">{utilization}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
