import React, { useState } from "react";
import {
  Rocket, HeartPulse, Target, MessageSquare, Swords, BookOpen, GraduationCap, TrendingUp, Sparkles, CheckCircle2
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

import { CustomerSuccessDashboard } from "./CustomerSuccessDashboard";
import { FeedbackAndRoadmapCenter } from "./FeedbackAndRoadmapCenter";
import { GtmSalesWorkspace } from "./GtmSalesWorkspace";
import { CompetitiveIntelWorkspace } from "./CompetitiveIntelWorkspace";
import { DocumentationPortal } from "./DocumentationPortal";
import { CommunityLearningHub } from "./CommunityLearningHub";
import { CommercialKpiDashboard } from "./CommercialKpiDashboard";

export function CommercialLaunchSuite({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("cs-dashboard");

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Hero Banner */}
      <div className="p-5 rounded-2xl border bg-navy-primary text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-success/20 text-white border-success/30 text-[10px] font-bold uppercase tracking-wider">
                <Rocket className="h-3 w-3 mr-1 text-success" /> COMMERCIAL LAUNCH READINESS
              </Badge>
              <Badge className="bg-primary/20 text-primary-foreground border-primary/30 text-[10px] font-mono">
                COMMERCIAL READINESS SCORE: 98/100
              </Badge>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Commercial Success & Growth Command Center
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Unified SaaS commercial suite enabling go-to-market pipelines, customer success health scoring, public roadmap voting, competitive matrix, documentation portal, academy certifications, and financial growth KPIs.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur border border-white/10 text-center">
              <span className="text-[9px] text-slate-300 block font-bold uppercase">NET RETENTION</span>
              <span className="text-sm font-black text-success">118% NRR</span>
            </div>
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur border border-white/10 text-center">
              <span className="text-[9px] text-slate-300 block font-bold uppercase">CSAT SCORE</span>
              <span className="text-sm font-black text-warning">4.9 / 5.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs List */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="border-b overflow-x-auto bg-card rounded-xl p-1.5 shadow-sm scrollbar-none">
          <TabsList className="h-9 bg-transparent p-0 gap-1 inline-flex w-max">
            <TabsTrigger value="cs-dashboard" className="h-8 text-[11px] font-bold gap-1.5 px-3">
              <HeartPulse className="h-3.5 w-3.5 text-success" /> Customer Success
            </TabsTrigger>
            <TabsTrigger value="gtm-sales" className="h-8 text-[11px] font-bold gap-1.5 px-3">
              <Target className="h-3.5 w-3.5 text-blue-600" /> Sales & GTM
            </TabsTrigger>
            <TabsTrigger value="feedback-roadmap" className="h-8 text-[11px] font-bold gap-1.5 px-3">
              <MessageSquare className="h-3.5 w-3.5 text-navy-mid" /> Feedback & Roadmap
            </TabsTrigger>
            <TabsTrigger value="competitive-intel" className="h-8 text-[11px] font-bold gap-1.5 px-3">
              <Swords className="h-3.5 w-3.5 text-warning" /> Competitive Intel
            </TabsTrigger>
            <TabsTrigger value="documentation" className="h-8 text-[11px] font-bold gap-1.5 px-3">
              <BookOpen className="h-3.5 w-3.5 text-navy-mid" /> Documentation
            </TabsTrigger>
            <TabsTrigger value="community-learning" className="h-8 text-[11px] font-bold gap-1.5 px-3">
              <GraduationCap className="h-3.5 w-3.5 text-pink-500" /> Community & Academy
            </TabsTrigger>
            <TabsTrigger value="commercial-kpis" className="h-8 text-[11px] font-bold gap-1.5 px-3">
              <TrendingUp className="h-3.5 w-3.5 text-success" /> Executive KPIs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cs-dashboard" className="m-0">
          <CustomerSuccessDashboard />
        </TabsContent>

        <TabsContent value="gtm-sales" className="m-0">
          <GtmSalesWorkspace />
        </TabsContent>

        <TabsContent value="feedback-roadmap" className="m-0">
          <FeedbackAndRoadmapCenter />
        </TabsContent>

        <TabsContent value="competitive-intel" className="m-0">
          <CompetitiveIntelWorkspace />
        </TabsContent>

        <TabsContent value="documentation" className="m-0">
          <DocumentationPortal />
        </TabsContent>

        <TabsContent value="community-learning" className="m-0">
          <CommunityLearningHub />
        </TabsContent>

        <TabsContent value="commercial-kpis" className="m-0">
          <CommercialKpiDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
