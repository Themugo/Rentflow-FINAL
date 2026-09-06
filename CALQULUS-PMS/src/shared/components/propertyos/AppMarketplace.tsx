import React, { useState } from "react";
import {
  ShoppingBag, Star, Download, ShieldCheck, CheckCircle2, Sparkles, Sliders, ExternalLink, RefreshCw, Filter, Search, Tag, ArrowRight
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

export interface AppMarketplaceItem {
  id: string;
  title: string;
  publisher: string;
  category: string;
  rating: number;
  reviews: number;
  installed: boolean;
  featured: boolean;
  price: string;
  description: string;
  permissions: string[];
}

const SAMPLE_MARKETPLACE_APPS: AppMarketplaceItem[] = [
  {
    id: "app-101",
    title: "M-Pesa Express Instant Reconciliation Engine",
    publisher: "Safaricom B2C Labs",
    category: "Financials & Payments",
    rating: 4.9,
    reviews: 312,
    installed: true,
    featured: true,
    price: "Free Included",
    description: "Automated real-time C2B ledger matching, STK push callbacks, and M-Pesa B2C landlord disbursements.",
    permissions: ["Read Financial Ledgers", "Write Payment Receipts", "Webhooks"],
  },
  {
    id: "app-102",
    title: "QuickBooks & Xero Auto-Sync Bridge",
    publisher: "Intuit Enterprise",
    category: "Accounting & ERP",
    rating: 4.8,
    reviews: 184,
    installed: true,
    featured: true,
    price: "KES 4,500/mo",
    description: "Bi-directional chart of accounts sync, automated tax invoice generation, and bank reconciliation feeds.",
    permissions: ["Read Invoices", "Write Journal Entries"],
  },
  {
    id: "app-103",
    title: "IoT Water Meter & Smart Valve Controller",
    publisher: "AquaTech IoT Solutions",
    category: "Utilities & Energy",
    rating: 4.7,
    reviews: 96,
    installed: false,
    featured: false,
    price: "KES 2,000/unit",
    description: "Remote water sub-meter readings, automatic valve shutdown on leak detection, and tenant prepaid water tokens.",
    permissions: ["Read Meter Sensors", "Write Valve Relay State"],
  },
  {
    id: "app-104",
    title: "Metropol & TransUnion CRB Tenant Screening",
    publisher: "Metropol Credit Bureau",
    category: "Risk & Identity",
    rating: 4.9,
    reviews: 142,
    installed: false,
    featured: true,
    price: "KES 500/check",
    description: "Instant Kenyan National ID verification, credit bureau scoring, default history check, and CRB reporting.",
    permissions: ["Read Tenant PII (Consent-Gated)", "Query CRB API"],
  },
];

export function AppMarketplace({ className }: { className?: string }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [apps, setApps] = useState<AppMarketplaceItem[]>(SAMPLE_MARKETPLACE_APPS);

  const toggleInstall = (id: string) => {
    setApps((prev) =>
      prev.map((app) => (app.id === id ? { ...app, installed: !app.installed } : app))
    );
  };

  const categories = ["All", "Financials & Payments", "Accounting & ERP", "Utilities & Energy", "Risk & Identity"];

  const filteredApps = apps.filter((app) => {
    const matchCat = selectedCategory === "All" || app.category === selectedCategory;
    const matchQuery = app.title.toLowerCase().includes(searchQuery.toLowerCase()) || app.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Header */}
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Enterprise App Marketplace
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Extend your Property Operating System with certified enterprise applications, utility connectors, and AI models.
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
          Certified Ecosystem Apps
        </Badge>
      </div>

      {/* Filters & Categories */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps by keyword, publisher, or capability..."
            className="h-9 text-xs w-full sm:w-80"
          />
          <div className="text-[11px] text-muted-foreground font-semibold">
            {filteredApps.length} Ecosystem Apps Available
          </div>
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

      {/* Grid of Apps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredApps.map((app) => (
          <Card key={app.id} className="border-border/80 bg-card p-4 space-y-3 flex flex-col justify-between hover:border-primary/40 transition-all">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                  {app.category}
                </Badge>
                <div className="flex items-center gap-1 text-warning font-bold text-[11px]">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-warning" />
                  <span>{app.rating}</span>
                  <span className="text-muted-foreground font-normal text-[10px]">({app.reviews})</span>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-foreground text-xs flex items-center gap-1.5">
                  {app.title}
                  {app.featured && <Sparkles className="h-3.5 w-3.5 text-warning" />}
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">By {app.publisher}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{app.description}</p>
              </div>

              <div className="pt-1 flex flex-wrap gap-1">
                {app.permissions.map((perm) => (
                  <Badge key={perm} variant="secondary" className="text-[8px] font-mono">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t flex justify-between items-center text-[10px] shrink-0">
              <span className="font-bold text-foreground">{app.price}</span>
              <Button
                size="sm"
                variant={app.installed ? "outline" : "default"}
                onClick={() => toggleInstall(app.id)}
                className="h-7 text-[10px] font-bold gap-1"
              >
                {app.installed ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Download className="h-3.5 w-3.5" />}
                {app.installed ? "Installed & Active" : "Install Application"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
