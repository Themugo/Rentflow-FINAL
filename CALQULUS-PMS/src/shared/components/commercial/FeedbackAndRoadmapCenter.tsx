import React, { useState } from "react";
import {
  MessageSquare, ThumbsUp, Plus, Bug, Sparkles, Filter, CheckCircle2, Clock
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export interface FeedbackItem {
  id: string;
  title: string;
  category: "Feature Request" | "UX Enhancement" | "Integration";
  votes: number;
  status: "Under Review" | "Planned" | "In Development" | "Released";
  description: string;
}

const SAMPLE_FEEDBACK: FeedbackItem[] = [
  {
    id: "fb-1",
    title: "M-Pesa B2B Bulk Landlord Automated Payout Gateway",
    category: "Feature Request",
    votes: 142,
    status: "In Development",
    description: "One-click disbursement of net collected rent directly to landlord M-Pesa Till or Paybill numbers.",
  },
  {
    id: "fb-2",
    title: "AI Lease OCR Auto-Extraction from Scanned PDFs",
    category: "Feature Request",
    votes: 98,
    status: "Planned",
    description: "Upload scanned Kenyan physical lease documents and extract tenant names, national IDs, and rent amounts automatically.",
  },
  {
    id: "fb-3",
    title: "KPLC Smart Meter Token Auto-Purchase via WhatsApp",
    category: "Integration",
    votes: 76,
    status: "Under Review",
    description: "Allow tenants to buy KPLC sub-meter tokens via WhatsApp bot without leaving their chat screen.",
  },
];

export function FeedbackAndRoadmapCenter({ className }: { className?: string }) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>(SAMPLE_FEEDBACK);

  const handleVote = (id: string) => {
    setFeedback((prev) =>
      prev.map((item) => (item.id === id ? { ...item, votes: item.votes + 1 } : item))
    );
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-navy-mid" /> Centralized Product Feedback & Public Roadmap
            </h3>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] font-bold">
              DEMO / LAB ENVIRONMENT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Capture client feature requests, customer roadmap voting, beta testing opt-ins, and product iteration loops.
          </p>
        </div>

        <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Submit Feature Suggestion
        </Button>
      </div>

      <div className="space-y-3">
        {feedback.map((item) => (
          <Card key={item.id} className="border-border/80 bg-card p-4 space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-bold">
                  {item.category}
                </Badge>
                <Badge
                  className={cn(
                    "text-[8px] font-bold border-none",
                    item.status === "Released" ? "bg-success/10 text-success" :
                    item.status === "In Development" ? "bg-blue-500/10 text-blue-600" : "bg-warning/10 text-warning"
                  )}
                >
                  {item.status}
                </Badge>
              </div>
              <h4 className="font-extrabold text-foreground text-xs">{item.title}</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleVote(item.id)}
              className="h-8 text-xs font-bold gap-1.5 shrink-0 self-start sm:self-center"
            >
              <ThumbsUp className="h-3.5 w-3.5 text-navy-mid" />
              <span>{item.votes} Votes</span>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
