import { useState } from "react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

const TENANT_COLUMNS = ["Tenant", "Property / Unit", "Lease", "Rent", "Balance", "Status"] as const;
const LEASE_COLUMNS = ["Tenant", "Property", "Unit", "Start date", "Expiry", "Rent", "Status"] as const;
const DETAIL_TABS = ["Overview", "Lease", "Financial", "Payments", "Maintenance", "Documents", "Activity"] as const;
const LEASE_STATUSES = ["Active", "Expiring soon", "Expired"] as const;

type Surface = "tenants" | "detail" | "leases";

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

export function ManagerTenantsPreview() {
  const [surface, setSurface] = useState<Surface>("tenants");

  return (
    <div className="min-w-0 bg-background text-foreground" data-preview="manager-tenants">
      <p className="mb-4 text-xs text-muted-foreground">
        Layout preview — columns match live tenant, lease, invoice, and date records. This canvas does not invent balances or expiry.
      </p>

      <div role="tablist" aria-label="Tenants surfaces" className="mb-5 flex flex-wrap gap-1">
        {([
          ["tenants", "Tenants"],
          ["detail", "Tenant detail"],
          ["leases", "Leases"],
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

      {surface === "tenants" && (
        <div>
          <PageHeader
            title="Tenants"
            description="Who lives where, what they owe, and which lease needs action."
            className="px-0 pb-5"
            actions={
              <>
                <Button size="sm" className="min-h-11" type="button">Invite tenant</Button>
                <Button size="sm" variant="outline" className="min-h-11" type="button">View leases</Button>
              </>
            }
          />
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground">Search</span>
            <span className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground">Filter</span>
          </div>
          <SlotTable columns={TENANT_COLUMNS} empty="Rows populate from tenants, leases, and unpaid invoices." />
        </div>
      )}

      {surface === "detail" && (
        <div>
          <PageHeader
            title="Tenant"
            description="Property and unit from the tenant record."
            className="px-0 pb-5"
            status={<span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Status</span>}
            actions={<Button size="sm" className="min-h-11" type="button">View statement</Button>}
          />
          <div className="mb-4 flex flex-wrap gap-1">
            {DETAIL_TABS.map((tab) => (
              <span key={tab} className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground">
                {tab}
              </span>
            ))}
          </div>
          <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            Overview starts with identity. Employment, emergency, occupancy, and risk stay on nested sections. Extra records (payers, notices, portal) remain available.
          </div>
        </div>
      )}

      {surface === "leases" && (
        <div>
          <PageHeader
            title="Leases"
            description="Tenant, property, unit, dates, rent, and status from live lease records."
            className="px-0 pb-5"
            actions={<Button size="sm" className="min-h-11" type="button">Create lease</Button>}
          />
          <div className="mb-4 flex flex-wrap gap-2">
            {LEASE_STATUSES.map((status) => (
              <span key={status} className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground">
                {status}
              </span>
            ))}
          </div>
          <SlotTable columns={LEASE_COLUMNS} empty="Rows populate from leases and tenant records. Expiry uses the stored end date." />
        </div>
      )}
    </div>
  );
}
