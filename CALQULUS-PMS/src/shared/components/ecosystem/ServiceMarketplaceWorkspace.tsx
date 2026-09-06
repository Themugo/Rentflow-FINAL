import React, { useState } from "react";
import {
  ShoppingBag, Star, ShieldCheck, Search, Filter, Wrench, Shield, Sparkles, Truck, Wifi, Leaf, Bug, Zap, Droplet, Scale, FileText, Calculator, CheckCircle2, ArrowRight
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

export interface VendorMarketplaceItem {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  verifiedBadge: boolean;
  startingPrice: string;
  description: string;
  slaHours: string;
}

const SAMPLE_MARKETPLACE_VENDORS: VendorMarketplaceItem[] = [
  {
    id: "vm-1",
    name: "Safari Security & Gate Automation Ltd",
    category: "Security",
    rating: 4.9,
    reviewCount: 128,
    verifiedBadge: true,
    startingPrice: "KES 15,000 / month",
    description: "24/7 biometric access controls, CCTV monitoring, and electric fence maintenance.",
    slaHours: "< 2 hours SLA",
  },
  {
    id: "vm-2",
    name: "HydroPlumb Kenya Services",
    category: "Plumbing",
    rating: 4.8,
    reviewCount: 94,
    verifiedBadge: true,
    startingPrice: "KES 3,500 / callout",
    description: "Emergency leak detection, booster pump overhauls, and solar water heater repairs.",
    slaHours: "< 1 hour SLA",
  },
  {
    id: "vm-3",
    name: "CleanSpace Commercial Janitorial",
    category: "Cleaning",
    rating: 4.7,
    reviewCount: 210,
    verifiedBadge: true,
    startingPrice: "KES 22,000 / month",
    description: "Deep carpet cleaning, stairwell sanitation, and post-tenancy move-out scrubbing.",
    slaHours: "Scheduled Daily",
  },
  {
    id: "vm-4",
    name: "Nairobi Legal & Conveyancing Advocates",
    category: "Legal",
    rating: 5.0,
    reviewCount: 42,
    verifiedBadge: true,
    startingPrice: "KES 12,000 / lease audit",
    description: "Drafting commercial lease deeds, tenant dispute mediation, and eviction notices.",
    slaHours: "24 hours SLA",
  },
  {
    id: "vm-5",
    name: "AIG Property & Fire Underwriters",
    category: "Insurance",
    rating: 4.9,
    reviewCount: 88,
    verifiedBadge: true,
    startingPrice: "From 0.15% Sum Insured",
    description: "Comprehensive property damage, rent loss indemnification, and liability cover.",
    slaHours: "Instant Quote",
  },
];

export function ServiceMarketplaceWorkspace({ className }: { className?: string }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [requestedVendor, setRequestedVendor] = useState<string | null>(null);

  const categories = [
    "All", "Maintenance", "Cleaning", "Security", "Moving Services",
    "Internet Providers", "Landscaping", "Pest Control", "Electrical", "Plumbing", "Legal", "Insurance", "Accounting"
  ];

  const filteredVendors = SAMPLE_MARKETPLACE_VENDORS.filter((v) => {
    const matchesCategory = selectedCategory === "All" || v.category === selectedCategory;
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleRequestQuote = (vendorName: string) => {
    setRequestedVendor(vendorName);
    setTimeout(() => setRequestedVendor(null), 2500);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Header Banner */}
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> PropTech B2B Service Marketplace
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Discover, compare, and contract verified maintenance, legal, insurance, security, and utility service providers.
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
          100% Vetted Contractors
        </Badge>
      </div>

      {/* Category Pills & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search providers by service name, specialty, or SLA..."
            className="h-9 text-xs w-full sm:w-80"
          />

          <div className="text-[11px] text-muted-foreground font-semibold">
            Showing {filteredVendors.length} Verified Partners
          </div>
        </div>

        {/* Category Filter Pills */}
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

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className="border-border/80 bg-card p-4 space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                  {vendor.category}
                </Badge>
                <div className="flex items-center gap-1 text-warning font-bold text-[11px]">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-warning" />
                  <span>{vendor.rating}</span>
                  <span className="text-muted-foreground font-normal text-[10px]">({vendor.reviewCount})</span>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-foreground text-xs flex items-center gap-1.5">
                  {vendor.name}
                  {vendor.verifiedBadge && <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{vendor.description}</p>
              </div>
            </div>

            <div className="pt-3 border-t space-y-2 shrink-0">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-semibold">Pricing: <strong className="text-foreground">{vendor.startingPrice}</strong></span>
                <Badge className="bg-blue-500/10 text-blue-600 border-none text-[8px] font-bold">{vendor.slaHours}</Badge>
              </div>

              <Button
                size="sm"
                onClick={() => handleRequestQuote(vendor.name)}
                className="w-full h-8 text-[11px] font-bold gap-1 bg-primary text-primary-foreground"
              >
                {requestedVendor === vendor.name ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {requestedVendor === vendor.name ? "Quote Request Sent!" : "Request Service Quote"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
