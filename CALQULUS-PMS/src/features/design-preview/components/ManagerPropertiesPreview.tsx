import { useState } from "react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

const PROPERTY_COLUMNS = ["Property", "Category", "Units", "Occupancy", "Tenants", "Revenue"] as const;
const UNIT_COLUMNS = ["Unit", "Property", "Tenant", "Status", "Rent", "Lease", "Balance"] as const;
const DETAIL_METRICS = ["Units", "Occupancy", "Rent", "Outstanding", "Maintenance"] as const;
const DETAIL_TABS = ["Overview", "Units", "Tenants", "Leases", "Billing", "Maintenance", "Documents"] as const;

type Surface = "properties" | "detail" | "units";

function SlotTable({ columns, empty }: { columns: readonly string[]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card card-shadow">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-3 py-2 font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-4 text-muted-foreground" colSpan={columns.length}>
              {empty}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ManagerPropertiesPreview() {
  const [surface, setSurface] = useState<Surface>("properties");

  return (
    <div className="min-w-0 bg-background text-foreground" data-preview="manager-properties">
      <p className="mb-4 text-xs text-muted-foreground">
        Layout preview — columns match live records. This canvas does not invent occupancy, rent, or balances.
      </p>

      <div role="tablist" aria-label="Properties surfaces" className="mb-5 flex flex-wrap gap-1">
        {([
          ["properties", "Properties"],
          ["detail", "Property detail"],
          ["units", "Units"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={surface === id}
            onClick={() => setSurface(id)}
            className={cn(
              "min-h-11 rounded-xl px-3 text-sm",
              surface === id ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {surface === "properties" && (
        <div>
          <PageHeader
            title="Properties"
            description="Buildings, units, and occupancy — open a property to manage tenants and leases."
            className="px-0 pb-5"
            actions={
              <>
                <Button size="sm" className="min-h-11" type="button">Add property</Button>
                <Button size="sm" variant="outline" className="min-h-11" type="button">View units</Button>
              </>
            }
          />
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground">Search</span>
            <span className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground">Filter</span>
            <span className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground">View</span>
          </div>
          <SlotTable columns={PROPERTY_COLUMNS} empty="Rows populate from the manager's properties." />
        </div>
      )}

      {surface === "detail" && (
        <div>
          <PageHeader
            title="Property name"
            description="Location from the property record."
            className="px-0 pb-5"
            status={<span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Status</span>}
            actions={<Button size="sm" className="min-h-11" type="button">Add tenant</Button>}
          />
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {DETAIL_METRICS.map((label) => (
              <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-3.5 card-shadow">
                <p className="meta-text uppercase tracking-wider">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">Live value</p>
              </div>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-1">
            {DETAIL_TABS.map((tab) => (
              <span key={tab} className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground">
                {tab}
              </span>
            ))}
          </div>
          <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            Existing units, tenants, leases, billing, maintenance, and documents stay on their tabs. Extra records (water, vacation, statement, landlord, settings, history) remain available.
          </div>
        </div>
      )}

      {surface === "units" && (
        <div>
          <PageHeader
            title="Units"
            description="Unit, property, tenant, status, rent, lease, and balance from live records."
            className="px-0 pb-5"
            actions={<Button size="sm" variant="outline" className="min-h-11" type="button">View properties</Button>}
          />
          <SlotTable columns={UNIT_COLUMNS} empty="Rows populate from units, tenants, leases, and unpaid invoices." />
        </div>
      )}
    </div>
  );
}
