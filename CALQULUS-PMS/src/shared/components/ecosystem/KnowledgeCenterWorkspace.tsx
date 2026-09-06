import React, { useState } from "react";
import {
  BookOpen, Search, Bookmark, FileText, Video, HelpCircle, Shield, CheckCircle2, ChevronRight, Sparkles, Folder
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface ArticleItem {
  id: string;
  title: string;
  category: "Policy" | "SOP" | "Legal" | "Tenant Guide" | "Maintenance";
  readTime: string;
  summary: string;
  bookmarked: boolean;
}

const SAMPLE_ARTICLES: ArticleItem[] = [
  {
    id: "art-1",
    title: "M-Pesa Reconciliation & Rent Escalation Standard Operating Procedure",
    category: "SOP",
    readTime: "4 min read",
    summary: "Step-by-step manager guide for handling M-Pesa Paybill C2B callbacks, manual ledger matching, and annual escalation notices.",
    bookmarked: true,
  },
  {
    id: "art-2",
    title: "Landlord-Tenant Dispute Resolution & Legal Eviction Compliance",
    category: "Legal",
    readTime: "7 min read",
    summary: "Statutory requirements under Kenyan Rent Restriction Act for tribunal filings, notice periods, and security deposit refunds.",
    bookmarked: false,
  },
  {
    id: "art-3",
    title: "Emergency Plumbing & Lift Breakdown Protocol",
    category: "Maintenance",
    readTime: "3 min read",
    summary: "Escalation pathways for field technicians and vendors during off-hours water pump failures or elevator entrapments.",
    bookmarked: true,
  },
  {
    id: "art-4",
    title: "Tenant Onboarding & Mobile Gate Access Card Issuance",
    category: "Tenant Guide",
    readTime: "5 min read",
    summary: "Instructions for inviting new tenants, configuring phone numbers, and generating digital gate access QR pass keys.",
    bookmarked: false,
  },
];

export function KnowledgeCenterWorkspace({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [articles, setArticles] = useState<ArticleItem[]>(SAMPLE_ARTICLES);

  const toggleBookmark = (id: string) => {
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, bookmarked: !a.bookmarked } : a))
    );
  };

  const categories = ["All", "SOP", "Policy", "Legal", "Tenant Guide", "Maintenance"];

  const filtered = articles.filter((a) => {
    const matchesCat = selectedCategory === "All" || a.category === selectedCategory;
    const matchesQuery = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Header Banner */}
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Centralized PropTech Knowledge Hub & Operational SOPs
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Internal policies, legal procedures, role-specific onboarding guides, training manuals, and FAQs.
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
          Knowledge Base v3.2
        </Badge>
      </div>

      {/* Search Bar & Category Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SOPs, legal guides, tenant policies, or maintenance protocols..."
            className="h-9 text-xs w-full sm:w-96"
          />

          <span className="text-[11px] text-muted-foreground font-semibold">
            {filtered.length} Articles Found
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="h-7 text-[11px] font-bold shrink-0 rounded-full"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Articles Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((art) => (
          <Card key={art.id} className="border-border/80 bg-card p-4 space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                  {art.category}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{art.readTime}</span>
                  <button onClick={() => toggleBookmark(art.id)} className="p-1 hover:text-primary transition-colors">
                    <Bookmark className={cn("h-4 w-4", art.bookmarked ? "fill-primary text-primary" : "text-muted-foreground")} />
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-foreground text-xs leading-snug">{art.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{art.summary}</p>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end shrink-0">
              <Button size="sm" variant="ghost" className="h-7 text-[11px] font-bold gap-1 text-primary">
                Read Full SOP <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
