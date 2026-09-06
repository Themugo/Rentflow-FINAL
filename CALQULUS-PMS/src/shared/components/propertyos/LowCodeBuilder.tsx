import React, { useState } from "react";
import {
  Layout, Layers, Plus, Move, Sliders, Eye, CheckCircle2, Code2, Sparkles, FileText
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export function LowCodeBuilder({ className }: { className?: string }) {
  const [widgets, setWidgets] = useState([
    { id: "w1", title: "M-Pesa Collection Gauge", type: "KPI Metric", size: "1x1", enabled: true },
    { id: "w2", title: "Occupancy Heatmap Grid", type: "Visual Chart", size: "2x1", enabled: true },
    { id: "w3", title: "Water Leak Anomaly Alert Feed", type: "Live Telemetry", size: "2x2", enabled: true },
    { id: "w4", title: "Custom Tenant Onboarding Form", type: "Form Layout", size: "1x2", enabled: false },
  ]);

  const [saved, setSaved] = useState(false);

  const toggleWidget = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const handleSaveLayout = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Layout className="h-5 w-5 text-navy-mid" /> Low-Code Layout & Custom Page Studio
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            No-code drag-and-drop builder for custom manager dashboards, custom form fields, reports, and UI widgets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSaveLayout} className="h-8 text-xs font-bold gap-1">
            {saved ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Eye className="h-3.5 w-3.5" />}
            {saved ? "Layout Saved!" : "Preview Dashboard"}
          </Button>
          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> + Add Custom Widget
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map((w) => (
          <Card key={w.id} className="border-border/80 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="space-y-0.5">
                <span className="font-extrabold text-foreground text-xs block">{w.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Widget Type: {w.type} • Dimensions: {w.size}
                </span>
              </div>
              <Button
                size="sm"
                variant={w.enabled ? "default" : "outline"}
                onClick={() => toggleWidget(w.id)}
                className="h-7 text-[10px] font-bold"
              >
                {w.enabled ? "Active on Canvas" : "Disabled"}
              </Button>
            </div>

            <div className="p-3 rounded-xl border border-dashed bg-muted/20 flex items-center justify-center text-muted-foreground text-[11px] font-mono h-20">
              [ Drag & Drop Interactive Widget Canvas Node: {w.title} ]
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
