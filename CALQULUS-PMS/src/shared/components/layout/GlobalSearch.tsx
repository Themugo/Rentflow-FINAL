import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Building2, Users, FileText, CreditCard, Wrench, Command } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useManagerScope } from "@/shared/hooks/useManagerScope";

interface SearchResult {
  id: string;
  type: "property" | "tenant" | "invoice" | "lease" | "maintenance";
  title: string;
  subtitle: string;
  route: string;
}

const typeConfig = {
  property: { icon: Building2, color: "text-navy-mid", label: "Property" },
  tenant: { icon: Users, color: "text-navy-mid", label: "Tenant" },
  invoice: { icon: CreditCard, color: "text-primary", label: "Invoice" },
  lease: { icon: FileText, color: "text-navy-mid", label: "Lease" },
  maintenance: { icon: Wrench, color: "text-navy-mid", label: "Maintenance" },
};

export function GlobalSearch() {
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedPropertyIdsKey = assignedPropertyIds.join(',');
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cmd+K / Ctrl+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (!managerId) {
          setResults([]);
          setIsOpen(false);
          return;
        }
        if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
          setResults([]);
          setIsOpen(false);
          return;
        }

        const searchTerm = `%${query.trim()}%`;
        let propertyQuery = supabase
          .from("properties")
          .select("id, name, address")
          .eq("manager_id", managerId)
          .ilike("name", searchTerm)
          .limit(5);

        let tenantQuery = supabase
          .from("tenants")
          .select("id, name, email, property, unit")
          .eq("manager_id", managerId)
          .ilike("name", searchTerm)
          .limit(5);

        let invoiceQuery = supabase
          .from("invoices")
          .select("id, invoice_number, description, amount, status, tenant_id")
          .eq("manager_id", managerId)
          .ilike("invoice_number", searchTerm)
          .limit(5);

        if (restrictToAssignedProperties) {
          propertyQuery = propertyQuery.in("id", assignedPropertyIds);
          tenantQuery = tenantQuery.in("property_id", assignedPropertyIds);

          const { data: scopedTenants } = await supabase
            .from("tenants")
            .select("id")
            .eq("manager_id", managerId)
            .in("property_id", assignedPropertyIds);
          const scopedTenantIds = (scopedTenants || []).map((tenant) => tenant.id);

          if (scopedTenantIds.length === 0) {
            const [properties, tenants] = await Promise.all([propertyQuery, tenantQuery]);
            const searchResults: SearchResult[] = [
              ...(properties.data || []).map((p) => ({
                id: p.id,
                type: "property" as const,
                title: p.name,
                subtitle: p.address,
                route: `/properties/${p.id}`,
              })),
              ...(tenants.data || []).map((t) => ({
                id: t.id,
                type: "tenant" as const,
                title: t.name,
                subtitle: `${t.property || ""} · ${t.unit || ""}`,
                route: `/tenants?highlight=${t.id}`,
              })),
            ];
            setResults(searchResults);
            setIsOpen(true);
            return;
          }
          invoiceQuery = invoiceQuery.in("tenant_id", scopedTenantIds);
        }

        const [properties, tenants, invoices] = await Promise.all([
          propertyQuery,
          tenantQuery,
          invoiceQuery,
        ]);

        const searchResults: SearchResult[] = [
          ...(properties.data || []).map((p) => ({
            id: p.id,
            type: "property" as const,
            title: p.name,
            subtitle: p.address,
            route: `/properties/${p.id}`,
          })),
          ...(tenants.data || []).map((t) => ({
            id: t.id,
            type: "tenant" as const,
            title: t.name,
            subtitle: `${t.property || ""} · Unit ${t.unit || ""}`,
            route: `/tenants?highlight=${t.id}`,
          })),
          ...(invoices.data || []).map((i) => ({
            id: i.id,
            type: "invoice" as const,
            title: i.invoice_number,
            subtitle: `${i.status} · KES ${Number(i.amount).toLocaleString()}${
              i.description ? ` · ${i.description}` : ""
            }`,
            route: `/billing?invoice=${i.id}`,
          })),
        ];

        setResults(searchResults);
        setIsOpen(true);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [assignedPropertyIdsKey, managerId, query, restrictToAssignedProperties]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.route);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative hidden md:block" ref={containerRef}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="Search tenants, properties, invoices..."
          className="w-64 lg:w-72 pl-9 pr-12 h-8 text-xs bg-muted/40 border-border/60 hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background transition-all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || query.length >= 2) setIsOpen(true);
          }}
        />
        {query ? (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-muted/60 px-1.5 font-mono text-[10px] text-muted-foreground font-medium pointer-events-none">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in-0 duration-150">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Searching records...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {query.length < 2 ? "Type at least 2 characters" : "No matching records found"}
            </div>
          ) : (
            <div className="py-1 max-h-80 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                Search Results ({results.length})
              </div>
              {results.map((result) => {
                const config = typeConfig[result.type];
                const Icon = config.icon;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/80 transition-colors border-b border-border/30 last:border-0"
                    onClick={() => handleSelect(result)}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted shrink-0">
                      <Icon className={cn("h-3.5 w-3.5", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{result.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
