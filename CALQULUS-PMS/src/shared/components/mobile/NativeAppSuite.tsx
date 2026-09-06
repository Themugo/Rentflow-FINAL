import React, { useState } from "react";
import {
  Smartphone, User, Building, ShieldCheck, Wrench, Briefcase, TrendingUp, Sparkles, Wifi, QrCode, PenTool, CheckCircle2, DollarSign, Bell, MapPin, FileText, Download, ScanLine
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { OfflineHardwareBar } from "./OfflineHardwareBar";
import { NativeInspectionForm } from "./NativeInspectionForm";
import { DigitalSignaturePad } from "./DigitalSignaturePad";
import { cn } from "@/shared/lib/utils";

export function NativeAppSuite({ className }: { className?: string }) {
  const [activeApp, setActiveApp] = useState<"tenant" | "landlord" | "manager" | "maintenance" | "vendor" | "executive">("tenant");
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);
  const [stkPaid, setStkPaid] = useState(false);

  const handleSimulateStkPush = () => {
    setStkPaid(true);
    setTimeout(() => setStkPaid(false), 3000);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Banner */}
      <div className="p-4 rounded-xl border bg-gradient-to-r from-success/15 via-primary/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" /> Native Mobile & Field Ops Experience Suite
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] font-bold">
              DEMO / LAB ENVIRONMENT
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Simulated PWA frames and a fake STK animation. Not a shipped App Store or Play app. Tenant pay on the web portal is the live path.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isPhoneFrame ? "default" : "outline"}
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="h-8 text-xs font-bold gap-1.5"
          >
            <Smartphone className="h-3.5 w-3.5" />
            {isPhoneFrame ? "Standard View" : "Device Mockup Frame"}
          </Button>
        </div>
      </div>

      {/* Global Device Hardware & Offline Status Bar */}
      <OfflineHardwareBar />

      {/* Mobile App Selector Tabs */}
      <Tabs value={activeApp} onValueChange={(value) => setActiveApp(value as typeof activeApp)} className="space-y-4">
        <TabsList className="h-9 p-1 bg-muted/40 border grid grid-cols-3 sm:grid-cols-6 w-full">
          <TabsTrigger value="tenant" className="text-xs font-bold gap-1">
            <User className="h-3.5 w-3.5 text-primary" /> Tenant App
          </TabsTrigger>
          <TabsTrigger value="landlord" className="text-xs font-bold gap-1">
            <Building className="h-3.5 w-3.5 text-primary" /> Landlord App
          </TabsTrigger>
          <TabsTrigger value="manager" className="text-xs font-bold gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Manager App
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs font-bold gap-1">
            <Wrench className="h-3.5 w-3.5 text-primary" /> Maintenance
          </TabsTrigger>
          <TabsTrigger value="vendor" className="text-xs font-bold gap-1">
            <Briefcase className="h-3.5 w-3.5 text-primary" /> Vendor App
          </TabsTrigger>
          <TabsTrigger value="executive" className="text-xs font-bold gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Executive
          </TabsTrigger>
        </TabsList>

        <div className={cn(isPhoneFrame && "max-w-md mx-auto border-[8px] border-navy-primary rounded-[38px] p-2 bg-background shadow-lg")}>
          {/* TENANT MOBILE APP */}
          <TabsContent value="tenant" className="m-0 space-y-4">
            <Card className="border-border/80 bg-card shadow-sm space-y-4 p-4 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-success/10 text-success flex items-center justify-center font-bold">
                    T
                  </div>
                  <div>
                    <h4 className="font-extrabold text-foreground text-xs">Tenant desk</h4>
                    <p className="text-[10px] text-muted-foreground">Own unit only — no fabricated balances</p>
                  </div>
                </div>
                <Badge className="bg-success/10 text-success border-success/20 text-[9px] font-bold">
                  Structure
                </Badge>
              </div>

              {/* Balance & M-Pesa STK Payment */}
              <div className="p-4 rounded-xl bg-navy-primary text-white space-y-3">
                <div className="flex justify-between items-center text-[10px] text-white/70 font-bold uppercase">
                  <span>Rent balance</span>
                  <span>Live amount lives on /portal</span>
                </div>
                <strong className="text-2xl font-black block text-white">Amount</strong>

                <Button
                  onClick={handleSimulateStkPush}
                  className="w-full h-10 font-black text-xs gap-2 shadow-md"
                >
                  <DollarSign className="h-4 w-4" />
                  {stkPaid ? "STK preview sent" : "Pay rent (preview control)"}
                </Button>
              </div>

              {/* Digital Lease & Gate QR Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border rounded-xl bg-card space-y-2">
                  <span className="font-bold text-foreground text-xs block">Gate Access Pass</span>
                  <div className="flex items-center gap-3">
                    <div className="p-2 border rounded-lg bg-white shrink-0">
                      <QrCode className="h-10 w-10 text-navy-deep" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-foreground block">QR Key Active</span>
                      <p className="text-[10px] text-muted-foreground">Scan at gate barrier or intercom</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 border rounded-xl bg-card space-y-2">
                  <span className="font-bold text-foreground text-xs block">Digital Lease Signatures</span>
                  <p className="text-[10px] text-muted-foreground">Sign counter-signature via digital pad.</p>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold w-full gap-1">
                    <PenTool className="h-3 w-3 text-primary" /> View & Sign Lease
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* LANDLORD MOBILE APP */}
          <TabsContent value="landlord" className="m-0 space-y-4">
            <Card className="border-border/80 bg-card shadow-sm space-y-4 p-4 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-extrabold text-foreground text-xs">Landlord Revenue & Portfolio Mobile</h4>
                  <p className="text-[10px] text-muted-foreground">Guarded revenue performance & net payout sign-offs.</p>
                </div>
                <Badge className="bg-navy-mid/10 text-navy-mid border-navy-mid/20 text-[9px] font-bold">
                  REVENUE ONLY (NO TENANT PII)
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">Gross Collection</span>
                  <strong className="text-lg font-bold text-success">Collected</strong>
                </div>
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">Net Payout Approved</span>
                  <strong className="text-lg font-bold text-foreground">Payout</strong>
                </div>
              </div>

              {/* Digital Payout Approval Pad */}
              <DigitalSignaturePad signerName="Landlord Representative" signerRole="Owner" />
            </Card>
          </TabsContent>

          {/* MANAGER MOBILE APP */}
          <TabsContent value="manager" className="m-0 space-y-4">
            <NativeInspectionForm />
          </TabsContent>

          {/* MAINTENANCE APP */}
          <TabsContent value="maintenance" className="m-0 space-y-4">
            <Card className="border-border/80 bg-card shadow-sm p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-extrabold text-foreground text-xs">Field Technician Maintenance App</h4>
                  <p className="text-[10px] text-muted-foreground">Work order SLA tracking, before/after photos, and parts scan.</p>
                </div>
                <Badge className="bg-warning/10 text-warning border-warning/20 text-[9px] font-bold">
                  SLA Active (2h Left)
                </Badge>
              </div>

              <div className="p-3 border rounded-xl bg-warning/5 border-warning/20 space-y-2">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span>WO-882: Plumbing Leakage in Unit 12B</span>
                  <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning">HIGH PRIORITY</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Water main pressure regulator replacement required.</p>
                <div className="pt-2 flex gap-2">
                  <Button size="sm" className="h-7 text-[10px] font-bold bg-primary text-primary-foreground gap-1">
                    <ScanLine className="h-3 w-3" /> Scan Replacement Part Barcode
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* VENDOR APP */}
          <TabsContent value="vendor" className="m-0 space-y-4">
            <Card className="border-border/80 bg-card shadow-sm p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-extrabold text-foreground text-xs">Vendor & Contractor Mobile Portal</h4>
                  <p className="text-[10px] text-muted-foreground">Submit work bids, invoice camera scan & site QR check-in.</p>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold">
                  Verified Vendor
                </Badge>
              </div>

              <div className="p-3 border rounded-xl bg-card space-y-2">
                <span className="font-bold text-foreground text-xs block">Property QR Check-In</span>
                <p className="text-[11px] text-muted-foreground">Scan QR code at property entrance to log arrival timestamp on site.</p>
                <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold gap-1">
                  <QrCode className="h-3 w-3 text-primary" /> Scan Property Barrier QR
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* EXECUTIVE APP */}
          <TabsContent value="executive" className="m-0 space-y-4">
            <Card className="border-border/80 bg-card shadow-sm p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-extrabold text-foreground text-xs">Executive Strategic Dashboard</h4>
                  <p className="text-[10px] text-muted-foreground">Real-time portfolio metrics, yield projections, and digital board sign-offs.</p>
                </div>
                <Badge className="bg-navy-mid/10 text-navy-mid border-navy-mid/20 text-[9px] font-bold">
                  Executive Suite
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">Portfolio Occupancy</span>
                  <strong className="text-lg font-bold text-success">Occupancy</strong>
                </div>
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">Monthly Yield Rate</span>
                  <strong className="text-lg font-bold text-foreground">Yield</strong>
                </div>
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">Risk Score</span>
                  <strong className="text-lg font-bold text-success">Risk</strong>
                </div>
              </div>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
