import React, { useState } from "react";
import { Grid, Search, Plus, ExternalLink, CheckCircle2, Shield, Sparkles, Filter, RefreshCw, Star } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export interface AppIntegration {
  id: string;
  name: string;
  category: "Financial & Tax" | "Communications" | "Storage & Legal" | "CRM & Channels";
  description: string;
  version: string;
  isInstalled: boolean;
  status: "connected" | "disconnected" | "update_available";
  uptime: string;
  rating: number;
}

const MARKETPLACE_APPS: AppIntegration[] = [
  { id: "app-01", name: "Safaricom M-Pesa Daraja 2.0", category: "Financial & Tax", description: "Real-time automated rent collection via STK push & Paybill callback verification.", version: "v2.4.1", isInstalled: true, status: "connected", uptime: "99.99%", rating: 4.9 },
  { id: "app-02", name: "Africa's Talking SMS & WhatsApp", category: "Communications", description: "Automated payment reminder notifications & dispatch status alerts.", version: "v1.8.0", isInstalled: true, status: "connected", uptime: "99.85%", rating: 4.8 },
  { id: "app-03", name: "QuickBooks Online Accounting", category: "Financial & Tax", description: "Bi-directional journal entry synchronization for landlord payouts.", version: "v3.1.0", isInstalled: false, status: "disconnected", uptime: "99.90%", rating: 4.7 },
  { id: "app-04", name: "KRA eTIMS Tax Compliance", category: "Financial & Tax", description: "Instant generation of Electronic Tax Invoices required for rental tax filing.", version: "v1.0.2", isInstalled: true, status: "update_available", uptime: "99.95%", rating: 4.9 },
  { id: "app-05", name: "Supabase Vault Storage", category: "Storage & Legal", description: "Encrypted document storage for lease contracts and water meter photos.", version: "v2.0.0", isInstalled: true, status: "connected", uptime: "100%", rating: 5.0 },
  { id: "app-06", name: "Google Calendar & Booking Sync", category: "CRM & Channels", description: "Synchronize vacant unit property tour bookings automatically.", version: "v1.2.0", isInstalled: false, status: "disconnected", uptime: "99.9%", rating: 4.6 },
];

export function IntegrationMarketplace({ className }: { className?: string }) {
  const [apps, setApps] = useState<AppIntegration[]>(MARKETPLACE_APPS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const handleToggleInstall = (id: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isInstalled: !a.isInstalled, status: !a.isInstalled ? "connected" : "disconnected" } : a))
    );
  };

  const filteredApps = apps.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Grid className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Enterprise Integration Marketplace</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Discover, install, and manage official connectors for payments, tax compliance, CRM, and accounting.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search marketplace..."
              className="pl-8 text-xs h-8"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Categories</SelectItem>
              <SelectItem value="Financial & Tax" className="text-xs">Financial & Tax</SelectItem>
              <SelectItem value="Communications" className="text-xs">Communications</SelectItem>
              <SelectItem value="Storage & Legal" className="text-xs">Storage & Legal</SelectItem>
              <SelectItem value="CRM & Channels" className="text-xs">CRM & Channels</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between space-y-3 text-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[9px] font-semibold">
                    {app.category}
                  </Badge>
                  <span className="text-[10px] font-bold text-warning flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-500" /> {app.rating}
                  </span>
                </div>

                <h4 className="font-bold text-foreground text-xs">{app.name}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{app.description}</p>
              </div>

              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-mono">{app.version}</span>
                  <span className="text-[10px] text-success font-semibold">{app.uptime} Uptime</span>
                </div>

                <Button
                  size="sm"
                  variant={app.isInstalled ? "outline" : "default"}
                  onClick={() => handleToggleInstall(app.id)}
                  className="h-7 text-[11px] font-bold gap-1"
                >
                  {app.isInstalled ? "Configured" : "Install Connector"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
