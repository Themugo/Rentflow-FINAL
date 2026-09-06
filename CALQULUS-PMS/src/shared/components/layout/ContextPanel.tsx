import { useState } from "react";
import { X, Activity, CheckSquare, FileText, Bell, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { cn } from "@/shared/lib/utils";

interface ContextPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
}

export function ContextPanel({ open, onClose, title = "Workspace Context", children }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState("activity");

  if (!open) return null;

  return (
    <>
      {/* Drawer Overlay for Mobile/Tablet */}
      <div
        className="fixed inset-0 z-40 bg-muted backdrop-blur-xs lg:hidden transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Right Context Panel */}
      <aside
        aria-label="Workspace Context Panel"
        className={cn(
          "fixed top-0 right-0 z-40 h-screen w-full sm:w-96 bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out animate-in slide-in-from-right",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
            onClick={onClose}
            aria-label="Close context panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Custom Children or Contextual Tabs */}
        {children ? (
          <ScrollArea className="flex-1 p-4">{children}</ScrollArea>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3 border-b border-border/60 shrink-0 bg-background/50">
              <TabsList className="w-full grid grid-cols-3 h-8 bg-muted/60 p-0.5 text-xs">
                <TabsTrigger value="activity" className="text-xs gap-1.5 py-1">
                  <Activity className="h-3 w-3" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs gap-1.5 py-1">
                  <CheckSquare className="h-3 w-3" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs gap-1.5 py-1">
                  <FileText className="h-3 w-3" />
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="activity" className="flex-1 m-0 p-0 overflow-hidden">
              <ScrollArea className="h-full px-4 py-3">
                <div className="space-y-4 text-xs">
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-[11px]">
                      SYS
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">Automatic Rent Reconciliation</p>
                      <p className="text-muted-foreground">Processed 14 M-Pesa transactions via Paybill gateway.</p>
                      <p className="text-[10px] text-muted-foreground/70 font-mono">Today at 08:42 AM</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0 font-semibold text-[11px]">
                      LEA
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">Lease Agreement Executed</p>
                      <p className="text-muted-foreground">Unit B-402 signed digital agreement (Tenant: Kamau W.).</p>
                      <p className="text-[10px] text-muted-foreground/70 font-mono">Yesterday at 04:15 PM</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-navy-mid/10 text-navy-mid flex items-center justify-center shrink-0 font-semibold text-[11px]">
                      MNT
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">Maintenance Ticket Raised</p>
                      <p className="text-muted-foreground">Plumbing repair requested for Westlands Plaza #12.</p>
                      <p className="text-[10px] text-muted-foreground/70 font-mono">Jul 28, 2026</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 m-0 p-0 overflow-hidden">
              <ScrollArea className="h-full px-4 py-3">
                <div className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg border border-border/70 bg-card hover:border-border transition-colors flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">Review Water Meter Billing</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Verify July sub-meter readings for Block C.</p>
                    </div>
                    <Badge variant="warning" className="text-[10px]">High</Badge>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border/70 bg-card hover:border-border transition-colors flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">Landlord Payout Approval</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Approve net rent disbursements for 5 properties.</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Normal</Badge>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="notes" className="flex-1 m-0 p-0 overflow-hidden">
              <ScrollArea className="h-full px-4 py-3">
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Property Inspections</span>
                      <span className="text-[10px] text-muted-foreground font-mono">Saved</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Quarterly HVAC and fire safety checks scheduled for all Nairobi properties on Aug 15.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* Panel Footer */}
        <div className="p-3 border-t border-border/80 bg-muted/20 shrink-0 text-center text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-primary font-medium">
            <Sparkles className="h-3 w-3" />
            CALQULUS Assistant
          </span>
          <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono">
            Esc to close
          </kbd>
        </div>
      </aside>
    </>
  );
}
