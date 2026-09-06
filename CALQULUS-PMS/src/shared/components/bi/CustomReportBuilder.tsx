import React, { useState } from "react";
import {
  FileSpreadsheet, Filter, Layers, BarChart2, Save, Calendar, Play, Download,
  Sliders, Plus, Trash2, CheckCircle, PieChart, LineChart, Table as TableIcon,
  Sparkles, RefreshCw
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  BarChart, Bar, LineChart as ReLineChart, Line, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { cn } from "@/shared/lib/utils";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";

const MODULE_OPTIONS = [
  { id: "invoices", name: "Financial & Invoices", fields: ["amount", "paid_amount", "balance_due", "status", "due_date", "property_name"] },
  { id: "properties", name: "Property & Portfolio", fields: ["name", "units", "occupied", "vacancy_rate", "total_revenue", "city"] },
  { id: "leases", name: "Leases & Tenants", fields: ["tenant_name", "rent_amount", "start_date", "end_date", "status", "deposit"] },
  { id: "maintenance", name: "Maintenance & Repairs", fields: ["title", "priority", "status", "cost", "vendor", "created_at"] },
];

const AGGREGATION_TYPES = ["SUM", "AVERAGE", "COUNT", "MAX", "MIN"];
const CHART_TYPES = ["Bar Chart", "Line Chart", "Donut Chart", "Data Grid"];

export function CustomReportBuilder() {
  const [selectedModule, setSelectedModule] = useState("invoices");
  const [reportTitle, setReportTitle] = useState("Custom Performance Report");
  const [selectedFields, setSelectedFields] = useState<string[]>(["amount", "paid_amount", "status"]);
  const [selectedAggregation, setSelectedAggregation] = useState("SUM");
  const [chartType, setChartType] = useState("Bar Chart");
  const [filters, setFilters] = useState<{ field: string; operator: string; value: string }[]>([
    { field: "status", operator: "equals", value: "paid" },
  ]);
  const [isPreviewGenerated, setIsPreviewGenerated] = useState(true);

  const currentModuleObj = MODULE_OPTIONS.find((m) => m.id === selectedModule) || MODULE_OPTIONS[0];

  const handleToggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter((f) => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleAddFilter = () => {
    setFilters([...filters, { field: currentModuleObj.fields[0], operator: "equals", value: "" }]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  // Mock preview data based on selections
  const previewChartData = [
    { label: "Q1", Billed: 450000, Collected: 420000, Arrears: 30000 },
    { label: "Q2", Billed: 520000, Collected: 490000, Arrears: 30000 },
    { label: "Q3", Billed: 610000, Collected: 580000, Arrears: 30000 },
    { label: "Q4", Billed: 680000, Collected: 650000, Arrears: 30000 },
  ];

  return (
    <Card className="border-border/80 bg-card shadow-sm">
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Interactive Report & Analytics Builder</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Configure custom data dimensions, aggregations, filters, and visualization engines.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save Template
          </Button>
          <Button size="sm" className="h-8 text-xs font-bold gap-1.5 bg-primary">
            <Play className="h-3.5 w-3.5" /> Generate Query
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Config Column */}
          <div className="space-y-4 lg:col-span-1 border-r border-border/60 pr-0 lg:pr-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Report Identifier / Title</label>
              <Input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Source Module</label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Select Metrics & Dimensions</label>
              <div className="grid grid-cols-2 gap-1.5 p-2 bg-muted/20 border rounded-lg max-h-36 overflow-y-auto">
                {currentModuleObj.fields.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      id={`field-${f}`}
                      checked={selectedFields.includes(f)}
                      onCheckedChange={() => handleToggleField(f)}
                    />
                    <label htmlFor={`field-${f}`} className="capitalize font-medium text-muted-foreground text-[11px] cursor-pointer truncate">
                      {f.replace("_", " ")}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Aggregation & Chart Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Aggregation</label>
                <Select value={selectedAggregation} onValueChange={setSelectedAggregation}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_TYPES.map((a) => (
                      <SelectItem key={a} value={a} className="text-xs">
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Chart Layout</label>
                <Select value={chartType} onValueChange={setChartType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Rules */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Query Filters</label>
                <Button size="sm" variant="ghost" onClick={handleAddFilter} className="h-6 text-[10px] gap-1 text-primary">
                  <Plus className="h-3 w-3" /> Add Filter
                </Button>
              </div>

              <div className="space-y-2">
                {filters.map((flt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Select
                      value={flt.field}
                      onValueChange={(v) => {
                        const updated = [...filters];
                        updated[idx].field = v;
                        setFilters(updated);
                      }}
                    >
                      <SelectTrigger className="h-7 text-[10px] w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentModuleObj.fields.map((f) => (
                          <SelectItem key={f} value={f} className="text-xs">
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={flt.value}
                      placeholder="Value"
                      onChange={(e) => {
                        const updated = [...filters];
                        updated[idx].value = e.target.value;
                        setFilters(updated);
                      }}
                      className="h-7 text-[10px] flex-1"
                    />

                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove filter"
                      onClick={() => handleRemoveFilter(idx)}
                      className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visualization & Live Preview Column */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20">
                  {chartType}
                </Badge>
                <span className="text-xs font-bold text-foreground">{reportTitle}</span>
              </div>

              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 font-semibold">
                <Download className="h-3 w-3" /> Export Dataset
              </Button>
            </div>

            {/* Render Selected Chart */}
            <div className="bg-muted/10 border border-border/80 rounded-xl p-4 min-h-[280px] flex items-center justify-center">
              {chartType === "Bar Chart" && (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={previewChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Billed" fill={CALQULUS_COLOR.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Collected" fill={CALQULUS_COLOR.success} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Arrears" fill={CALQULUS_COLOR.danger} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {chartType === "Line Chart" && (
                <ResponsiveContainer width="100%" height={260}>
                  <ReLineChart data={previewChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Billed" stroke={CALQULUS_COLOR.primary} strokeWidth={2} />
                    <Line type="monotone" dataKey="Collected" stroke={CALQULUS_COLOR.success} strokeWidth={2} />
                  </ReLineChart>
                </ResponsiveContainer>
              )}

              {(chartType === "Donut Chart" || chartType === "Data Grid") && (
                <div className="w-full text-center space-y-2 py-8">
                  <TableIcon className="h-8 w-8 text-primary mx-auto opacity-70" />
                  <p className="text-xs font-bold text-foreground">Data Grid & Summary Preview Generated</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    Aggregated {selectedAggregation} query active across {selectedFields.length} selected fields.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
