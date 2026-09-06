import React, { useState, useEffect } from "react";
import { Search, Sparkles, Command, ArrowRight, Zap, AlertTriangle, ShieldCheck, FileText, Wrench, Send, Building } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { onActivateKey } from "@/shared/lib/a11y";

export interface SuggestedActionItem {
  id: string;
  label: string;
  category: "Tenant" | "Billing" | "Maintenance" | "Lease";
  prompt: string;
  permissionRequired?: string;
}

const SAMPLE_SUGGESTED_ACTIONS: SuggestedActionItem[] = [
  { id: "sa-1", label: "Draft arrears notice for Kilimani Heights Apt 3B", category: "Billing", prompt: "Draft polite M-Pesa payment reminder SMS for James Makena" },
  { id: "sa-2", label: "Predict water utility anomaly in Lavington Block B", category: "Maintenance", prompt: "Analyze meter reading spike for Unit 12 water consumption" },
  { id: "sa-3", label: "Summarize pending lease renewal risks for next 30 days", category: "Lease", prompt: "Generate lease renewal summary and escalation risk factors" },
  { id: "sa-4", label: "Prioritize open emergency maintenance work orders", category: "Maintenance", prompt: "Prioritize plumbing repair tickets by SLA risk score" },
];

export function AiCommandBar({
  onSelectAction,
  className,
}: {
  onSelectAction?: (action: SuggestedActionItem) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Global Keyboard Shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={cn("relative w-full", className)}>
      {/* Quick Access Command Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={onActivateKey(() => setIsOpen(true))}
        className="flex items-center justify-between p-2.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all text-xs"
      >
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span>Ask Calqulus AI Copilot or search anything...</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[10px]">
          <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] font-mono bg-background">
            Ctrl + K
          </Badge>
        </div>
      </div>

      {/* Modal / Expanded Command Bar overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div
            className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Header */}
            <div className="p-3 border-b flex items-center gap-2 bg-muted/20">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command, ask a query, or search tenants, leases, invoices..."
                className="border-none shadow-none focus-visible:ring-0 text-xs font-medium h-9 bg-transparent"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)} className="h-7 text-[11px] font-bold">
                ESC
              </Button>
            </div>

            {/* Content Suggestions */}
            <div className="p-4 space-y-3 text-xs max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Suggested AI Copilot Actions
                </span>
                <span>Permission-Gated</span>
              </div>

              <div className="space-y-2">
                {SAMPLE_SUGGESTED_ACTIONS.map((action) => (
                  <div
                    key={action.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (onSelectAction) onSelectAction(action);
                      setIsOpen(false);
                    }}
                    onKeyDown={onActivateKey(() => {
                      if (onSelectAction) onSelectAction(action);
                      setIsOpen(false);
                    })}
                    className="p-3 rounded-xl border bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-semibold">
                          {action.category}
                        </Badge>
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {action.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{action.prompt}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
