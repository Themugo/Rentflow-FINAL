import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Building2,
  Users,
  FileText,
  CreditCard,
  Wrench,
  Command,
  Star,
  Clock,
  ArrowRight,
  Droplets,
  FileSpreadsheet,
  Settings,
  UserPlus,
  BarChart3,
  Calendar,
} from "lucide-react";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useNavHistory, NavPage } from "@/shared/hooks/useNavHistory";
import { onActivateKey } from "@/shared/lib/a11y";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  type: "property" | "tenant" | "invoice" | "page";
  title: string;
  subtitle: string;
  route: string;
  icon?: any;
}

const ALL_PAGES: NavPage[] = [
  { name: "Dashboard", href: "/", category: "Overview" },
  { name: "Properties", href: "/properties", category: "Portfolio" },
  { name: "Units", href: "/units", category: "Portfolio" },
  { name: "Landlords", href: "/landlords", category: "Portfolio" },
  { name: "Leases", href: "/leases", category: "Occupancy" },
  { name: "Tenants", href: "/tenants", category: "Occupancy" },
  { name: "Tenant Screening", href: "/tenant-screening", category: "Occupancy" },
  { name: "Invites", href: "/invites", category: "Occupancy" },
  { name: "Vacation Notices", href: "/vacation-notices", category: "Occupancy" },
  { name: "Billing", href: "/billing", category: "Collections" },
  { name: "Water Billing", href: "/water-billing", category: "Collections" },
  { name: "Statements", href: "/statements", category: "Collections" },
  { name: "Payment History", href: "/payments", category: "Collections" },
  { name: "Maintenance", href: "/maintenance", category: "Operations" },
  { name: "Contracts", href: "/contracts", category: "Operations" },
  { name: "Reports", href: "/reports", category: "Operations" },
  { name: "Platform Billing", href: "/platform-billing", category: "Account" },
  { name: "Settings", href: "/settings", category: "Account" },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedPropertyIdsKey = assignedPropertyIds.join(',');
  const { favorites, recents, toggleFavorite, isFavorite } = useNavHistory();
  const [query, setQuery] = useState("");
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setDbResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setDbResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (!managerId) {
          setDbResults([]);
          return;
        }

        const searchTerm = `%${query.trim()}%`;
        let propertyQuery = supabase
          .from("properties")
          .select("id, name, address")
          .eq("manager_id", managerId)
          .ilike("name", searchTerm)
          .limit(4);

        let tenantQuery = supabase
          .from("tenants")
          .select("id, name, email, property, unit")
          .eq("manager_id", managerId)
          .ilike("name", searchTerm)
          .limit(4);

        const invoiceQuery = supabase
          .from("invoices")
          .select("id, invoice_number, description, amount, status")
          .eq("manager_id", managerId)
          .ilike("invoice_number", searchTerm)
          .limit(4);

        if (restrictToAssignedProperties && assignedPropertyIds.length > 0) {
          propertyQuery = propertyQuery.in("id", assignedPropertyIds);
          tenantQuery = tenantQuery.in("property_id", assignedPropertyIds);
        }

        const [properties, tenants, invoices] = await Promise.all([
          propertyQuery,
          tenantQuery,
          invoiceQuery,
        ]);

        const results: SearchResult[] = [
          ...(properties.data || []).map((p) => ({
            id: p.id,
            type: "property" as const,
            title: p.name,
            subtitle: p.address,
            route: `/properties/${p.id}`,
            icon: Building2,
          })),
          ...(tenants.data || []).map((t) => ({
            id: t.id,
            type: "tenant" as const,
            title: t.name,
            subtitle: `${t.property || "Property"} · Unit ${t.unit || "-"}`,
            route: `/tenants?highlight=${t.id}`,
            icon: Users,
          })),
          ...(invoices.data || []).map((i) => ({
            id: i.id,
            type: "invoice" as const,
            title: i.invoice_number,
            subtitle: `${i.status.toUpperCase()} · KES ${Number(i.amount).toLocaleString()}`,
            route: `/billing?invoice=${i.id}`,
            icon: CreditCard,
          })),
        ];

        setDbResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [assignedPropertyIds, managerId, query, restrictToAssignedProperties]);

  const filteredPages = ALL_PAGES.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.category?.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (route: string) => {
    navigate(route);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl border-border bg-popover shadow-2xl gap-0 overflow-hidden sm:rounded-xl">
        {/* Input Bar */}
        <div className="flex items-center px-4 border-b border-border/80">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, tenants, properties, or type a command..."
            className="h-12 border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-3 placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results Body */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-3">
          {/* Database Live Results */}
          {dbResults.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Database Records ({dbResults.length})
              </p>
              <div className="space-y-0.5 mt-1">
                {dbResults.map((item) => {
                  const Icon = item.icon || Building2;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.route)}
                      className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-muted/80 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Favorites & Recents (When query is empty) */}
          {!query && (
            <>
              {favorites.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3 text-primary fill-primary" /> Pinned Modules
                  </p>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {favorites.map((page) => (
                      <button
                        key={page.href}
                        onClick={() => handleSelect(page.href)}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left transition-colors"
                      >
                        <Star className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">{page.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recents.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-primary" /> Recently Visited
                  </p>
                  <div className="space-y-0.5 mt-1">
                    {recents.map((page) => (
                      <button
                        key={page.href}
                        onClick={() => handleSelect(page.href)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-left transition-colors text-xs"
                      >
                        <span className="font-medium text-foreground">{page.name}</span>
                        <span className="text-[10px] text-muted-foreground">{page.category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Matching Navigation Pages */}
          <div>
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {query ? `Matching Modules (${filteredPages.length})` : "All Modules & Features"}
            </p>
            <div className="space-y-0.5 mt-1">
              {filteredPages.map((page) => {
                const fav = isFavorite(page.href);
                return (
                  <div
                    key={page.href}
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/80 transition-colors group cursor-pointer"
                    onClick={() => handleSelect(page.href)}
                    onKeyDown={onActivateKey(() => handleSelect(page.href))}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary" />
                      <span className="text-xs font-semibold text-foreground truncate">{page.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {page.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(page);
                        }}
                        className="p-1 text-muted-foreground hover:text-primary"
                        title={fav ? "Unpin module" : "Pin module"}
                      >
                        <Star className={cn("h-3.5 w-3.5", fav && "text-primary fill-primary")} />
                      </button>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">Esc</kbd> Close</span>
          </div>
          <span className="font-semibold text-primary">CALQULUS Command Palette</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
