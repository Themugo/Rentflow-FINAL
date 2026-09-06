import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { FileText, Calendar } from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { Link } from "react-router-dom";
import { leaseStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";

interface Lease {
  id: string;
  tenant_id: string | null;
  unit: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  status: string;
  deposit: number | null;
}

interface Tenant {
  id: string;
  name: string;
}

interface PropertyLeasesTabProps {
  leases: Lease[];
  tenants: Tenant[];
}

function nextLeaseAction(status: string): { href: string; label: string } {
  if (status === "active" || status === "expiring") {
    return { href: "/billing", label: "Invoice / collect" };
  }
  return { href: "/leases", label: "Manage lease" };
}

export function PropertyLeasesTab({ leases, tenants }: PropertyLeasesTabProps) {
  const { formatCurrency } = useCurrency();

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return "—";
    return tenants.find(t => t.id === tenantId)?.name || "Unknown";
  };

  const totalMonthlyRent = leases
    .filter(l => l.status === "active")
    .reduce((sum, l) => sum + l.monthly_rent, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Leases
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {leases.length} total • Active monthly rent: {formatCurrency(totalMonthlyRent)}
          </p>
        </div>
        <Link to="/leases">
          <Button variant="outline" size="sm">Manage Leases</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {leases.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No leases for this property</p>
            <Link to="/leases">
              <Button variant="outline" className="mt-4" size="sm">Create Lease</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.map((lease) => {
                const next = nextLeaseAction(lease.status);
                return (
                  <TableRow key={lease.id}>
                    <TableCell>
                      <span className={statusBadgeClass(leaseStatusTone(lease.status))}>
                        {lease.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{getTenantName(lease.tenant_id)}</TableCell>
                    <TableCell>{lease.unit}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {formatCurrency(lease.monthly_rent)}/mo
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(lease.start_date), "dd/MM/yy")} – {format(new Date(lease.end_date), "dd/MM/yy")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={next.href} className="text-sm text-primary hover:underline">
                        {next.label}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
