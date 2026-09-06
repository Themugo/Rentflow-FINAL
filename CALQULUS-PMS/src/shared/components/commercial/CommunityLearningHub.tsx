import React, { useState } from "react";
import {
  Users, GraduationCap, Award, MessageSquare, Calendar, Sparkles, ExternalLink, CheckCircle2
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function CommunityLearningHub({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-success" /> Property OS Academy & Community Network
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Certified Property Manager training courses, developer forums, partner accreditation, and community meetups.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          420 CERTIFIED MANAGERS
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-extrabold text-foreground text-xs flex items-center gap-2">
              <Award className="h-4 w-4 text-warning" /> Professional Certification Tracks
            </h4>
            <Badge variant="outline" className="text-[9px] font-bold">CPMS Accredited</Badge>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="p-2.5 rounded-xl border bg-muted/20 flex justify-between items-center">
              <div>
                <strong className="text-foreground font-bold block">Certified Property Operating Specialist (CPOS)</strong>
                <span className="text-[10px] text-muted-foreground">3 Modules • M-Pesa Recon & IoT Meters</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold">Enroll</Button>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/20 flex justify-between items-center">
              <div>
                <strong className="text-foreground font-bold block">Property OS Developer & Integration Engineer</strong>
                <span className="text-[10px] text-muted-foreground">REST APIs, Webhooks & Extension SDKs</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold">Enroll</Button>
            </div>
          </div>
        </Card>

        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-extrabold text-foreground text-xs flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Upcoming Community Webinars
            </h4>
            <Badge variant="outline" className="text-[9px] font-bold">Live Events</Badge>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="p-2.5 rounded-xl border bg-muted/20 flex justify-between items-center">
              <div>
                <strong className="text-foreground font-bold block">Nairobi PropTech Summit 2026</strong>
                <span className="text-[10px] text-muted-foreground">Aug 15, 2026 • Radisson Blu Upperhill</span>
              </div>
              <Button size="sm" className="h-7 text-[10px] font-bold bg-primary text-primary-foreground">Register</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
