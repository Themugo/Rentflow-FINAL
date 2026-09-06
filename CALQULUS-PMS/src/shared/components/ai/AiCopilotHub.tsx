import React, { useState } from "react";
import { Sparkles, Bot, Terminal, ShieldCheck, Zap, Layers, BarChart3, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { AiCommandBar } from "./AiCommandBar";
import { AiAssistantDrawer } from "./AiAssistantDrawer";
import { SmartSummaryGrid } from "./SmartSummaryCards";
import { cn } from "@/shared/lib/utils";

export function AiCopilotHub({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Banner */}
      <div className="p-4 rounded-xl border bg-gradient-to-r from-primary/15 via-primary/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Calqulus AI Copilot & Operational Intelligence
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permission-gated AI assistant for natural language command execution, risk detection, lease summaries, and communication drafting.
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
          User-Assisted Model (Non-Replacing)
        </Badge>
      </div>

      {/* Interactive Global Command Bar */}
      <AiCommandBar />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 p-1 bg-muted/40 border">
          <TabsTrigger value="overview" className="text-xs font-bold gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> AI Summaries & Insights
          </TabsTrigger>
          <TabsTrigger value="assistant" className="text-xs font-bold gap-1.5">
            <Bot className="h-3.5 w-3.5" /> Interactive Copilot Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="m-0 space-y-4">
          <SmartSummaryGrid />
        </TabsContent>

        <TabsContent value="assistant" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <AiAssistantDrawer />
            </div>

            <div className="lg:col-span-4 space-y-3">
              <Card className="border-border/80 bg-card p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  <span>Permission Safeguards</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  All AI Copilot recommendations adhere strictly to user RBAC rules. Financial actions (like triggering landlord payouts) require explicit human manager authorization.
                </p>
              </Card>

              <Card className="border-border/80 bg-card p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Suggested Workflow Shortcuts</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground pt-1">
                  <li className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <span>Draft M-Pesa Arrears SMS</span>
                    <ArrowRight className="h-3 w-3 text-primary" />
                  </li>
                  <li className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <span>Summarize Water Readings</span>
                    <ArrowRight className="h-3 w-3 text-primary" />
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
