import React, { useState } from "react";
import {
  ClipboardCheck, Camera, QrCode, MapPin, CheckCircle2, ShieldCheck, AlertCircle, Save, PenTool, Image as ImageIcon
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { DigitalSignaturePad } from "./DigitalSignaturePad";
import { cn } from "@/shared/lib/utils";

export function NativeInspectionForm({ className }: { className?: string }) {
  const [unitId, setUnitId] = useState("Unit 3B (Kilimani Heights)");
  const [inspectionType, setInspectionType] = useState("Pre-Move In Inspection");
  const [waterMeterReading, setWaterMeterReading] = useState("142.8 m³");
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [checklist, setChecklist] = useState([
    { id: "c1", label: "Water Plumbing & Fixtures", status: "Pass" },
    { id: "c2", label: "Electrical Outlets & Circuit Breakers", status: "Pass" },
    { id: "c3", label: "Wall Paint & Structural Integrity", status: "Needs Repair" },
    { id: "c4", label: "Door Lock & Window Latches", status: "Pass" },
  ]);

  const toggleStatus = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: item.status === "Pass" ? "Needs Repair" : "Pass" } : item
      )
    );
  };

  const handleCapturePhoto = () => {
    setPhotoCaptured(true);
  };

  const handleSubmitReport = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm space-y-4 text-xs", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Mobile Field Inspection & Audit Form</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Offline-first digital inspection checklist with camera photo tagging, water meter scan, and signature pad.
          </CardDescription>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-success/10 text-success border-success/20">
          GPS Geofenced (-1.286, 36.817)
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Inspection Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-foreground block">Target Unit / Asset</Label>
            <Input value={unitId} onChange={(e) => setUnitId(e.target.value)} className="h-8 text-xs" />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-foreground block">Inspection Category</Label>
            <Select value={inspectionType} onValueChange={setInspectionType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pre-Move In Inspection" className="text-xs">Pre-Move In Inspection</SelectItem>
                <SelectItem value="Move Out Audit" className="text-xs">Move Out Audit</SelectItem>
                <SelectItem value="Quarterly Maintenance" className="text-xs">Quarterly Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-foreground block">Water Meter Barcode Scan</Label>
            <div className="flex gap-2">
              <Input value={waterMeterReading} onChange={(e) => setWaterMeterReading(e.target.value)} className="h-8 text-xs font-mono" />
              <Button size="sm" variant="outline" className="h-8 px-2 shrink-0 text-[10px] gap-1">
                <QrCode className="h-3 w-3 text-primary" /> Scan
              </Button>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2 border rounded-xl p-3 bg-muted/20">
          <span className="font-bold text-foreground text-xs block">Unit Condition Checklist</span>
          <div className="space-y-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded bg-card border text-xs">
                <span className="font-medium text-foreground">{item.label}</span>
                <button
                  onClick={() => toggleStatus(item.id)}
                  className={cn(
                    "px-2.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
                    item.status === "Pass" ? "bg-success/10 text-success border border-success/20" : "bg-warning/10 text-warning border border-warning/20"
                  )}
                >
                  {item.status}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Photo Capture & Signature Pad */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-3 border rounded-xl bg-card space-y-2">
            <span className="font-bold text-foreground text-xs block flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-blue-500" /> Evidence Photo Capture
            </span>
            <div className="h-32 rounded-lg border border-dashed flex flex-col items-center justify-center p-3 text-center bg-muted/20 space-y-2">
              {photoCaptured ? (
                <div className="flex flex-col items-center gap-1 text-success">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="font-bold text-xs">Photo Captured with GPS Metadata</span>
                  <span className="text-[10px] text-muted-foreground font-mono">LAT: -1.28638 • LNG: 36.81722</span>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Tap to trigger device camera</span>
                  <Button size="sm" onClick={handleCapturePhoto} className="h-7 text-[10px] font-bold gap-1 bg-primary text-primary-foreground">
                    Snap Photo
                  </Button>
                </>
              )}
            </div>
          </div>

          <DigitalSignaturePad onSave={() => setSignatureSaved(true)} signerName="Field Inspector" signerRole="Inspector" />
        </div>

        <div className="pt-2 flex justify-end">
          <Button size="sm" onClick={handleSubmitReport} className="h-9 font-bold text-xs gap-1.5 bg-primary text-primary-foreground px-4">
            {submitted ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {submitted ? "Report Stored in Offline Queue" : "Submit Signed Field Report"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
