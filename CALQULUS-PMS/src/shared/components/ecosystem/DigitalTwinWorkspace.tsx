import React, { useState } from "react";
import {
  Layers, Cpu, Activity, Zap, Droplet, Thermometer, Radio, Eye, AlertTriangle, ShieldCheck, RefreshCw, BarChart3
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/shared/lib/utils";

export function DigitalTwinWorkspace({ className }: { className?: string }) {
  const [selectedFloor, setSelectedFloor] = useState("Floor 3 (Units 3A - 3D)");
  const [activeSensorFilter, setActiveSensorFilter] = useState<"All" | "Water" | "HVAC" | "Energy">("All");

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Header Banner */}
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Digital Twin CAD & IoT Sensor Telemetry
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time 2D/3D building CAD overlay, IoT energy/environmental telemetry, occupancy heatmaps, and predictive vibration analysis.
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
          Digital Twin Ready (BIM Standard)
        </Badge>
      </div>

      {/* IoT Sensors Live Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase">
            <span>Ambient Temp</span>
            <Thermometer className="h-3.5 w-3.5 text-warning" />
          </div>
          <strong className="text-xl font-black text-foreground">22.4 °C</strong>
          <span className="text-[9px] text-success font-bold block">Comfortable HVAC Target</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase">
            <span>Water Main Pressure</span>
            <Droplet className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <strong className="text-xl font-black text-foreground">3.8 Bar</strong>
          <span className="text-[9px] text-success font-bold block">Nominal Flow Rate</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase">
            <span>Solar Power Generation</span>
            <Zap className="h-3.5 w-3.5 text-warning" />
          </div>
          <strong className="text-xl font-black text-warning">42.8 kW</strong>
          <span className="text-[9px] text-muted-foreground block">82% Grid Offset</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase">
            <span>Occupancy Sensor Index</span>
            <Eye className="h-3.5 w-3.5 text-navy-mid" />
          </div>
          <strong className="text-xl font-black text-navy-mid">92% Active</strong>
          <span className="text-[9px] text-muted-foreground block">Common Areas Active</span>
        </Card>
      </div>

      {/* Digital Twin CAD Viewer Mock & Sensors Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* CAD Floor Plan Mock */}
        <Card className="lg:col-span-8 border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <Radio className="h-4 w-4 text-success" /> Building Floor Plan CAD Model
            </span>
            <Badge variant="outline" className="text-[9px] font-mono">
              {selectedFloor}
            </Badge>
          </div>

          {/* Interactive Interactive Visual Blueprint canvas representation */}
          <div className="h-64 rounded-xl border border-dashed bg-navy-deep p-4 relative overflow-hidden flex flex-col justify-between text-white">
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span className="font-mono">CAD BIM Layer: Architectural & Plumbing Wireframe</span>
              <Badge className="bg-success/20 text-success border-success/30 text-[8px]">
                LIVE IoT SENSORS (12 MAPPED)
              </Badge>
            </div>

            {/* Blueprint Grid Mock */}
            <div className="grid grid-cols-2 gap-3 my-auto text-[11px]">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">Unit 3A</span>
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">Temp: 22°C • Meter: 14 m³ • Normal</span>
              </div>

              <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">Unit 3B</span>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                </div>
                <span className="text-[10px] text-amber-300 block font-mono">Spike Detected: Water Flow +340%</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-2">
              <span>Zoom: 100% • 3D BIM Coordinates: (X: 142, Y: 98, Z: 3)</span>
              <span className="text-success font-bold">Predictive Failure Risk: Low</span>
            </div>
          </div>
        </Card>

        {/* Predictive Maintenance & Sensor Diagnostics */}
        <Card className="lg:col-span-4 border-border/80 bg-card p-4 space-y-3">
          <span className="font-bold text-foreground text-xs block">IoT Telemetry Alerts</span>

          <div className="space-y-2">
            <div className="p-2.5 border rounded-xl bg-warning/5 border-warning/20 space-y-1">
              <div className="flex items-center justify-between font-bold text-foreground">
                <span className="text-warning">Unit 3B Flow Anomaly</span>
                <Badge variant="outline" className="text-[8px] bg-warning/10 text-warning">P2 Priority</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Meter registered 42 m³ in 24h. AI model predicts plumbing pipe valve leak.
              </p>
            </div>

            <div className="p-2.5 border rounded-xl bg-success/5 border-success/20 space-y-1">
              <div className="flex items-center justify-between font-bold text-foreground">
                <span className="text-success">Booster Pump Motor Vibration</span>
                <Badge variant="outline" className="text-[8px] bg-success/10 text-success">Optimal</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Vibration frequency 48 Hz within manufacturer tolerance window.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
