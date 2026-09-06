import { format } from "date-fns";
import { Banknote, FileSpreadsheet } from "lucide-react";
import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import LandlordFinancialStatement from "@/features/landlord/components/LandlordFinancialStatement";
import { LandlordPayoutDialog } from "@/features/landlord/components/LandlordPayoutDialog";
import LandlordSettlementTransparency from "@/features/landlord/components/LandlordSettlementTransparency";
import { useLandlordPortfolio } from "@/features/landlord/hooks/useLandlordPortfolio";
import { useLandlordPayouts } from "@/features/landlord/hooks/useLandlordPayouts";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { formatKes } from "@/features/landlord/lib/formatKes";
import { payoutStatusTone } from "@/shared/lib/statusBadge";
import { statusBadgeClass } from "@/shared/lib/statusBadge";

export default function LandlordStatements() {
  const { properties, isLoading, isError, refetch } = useLandlordPortfolio();
  const { payouts, isLoading: payoutsLoading, isError: payoutsError, refetch: refetchPayouts } = useLandlordPayouts();

  return (
    <LandlordLayout
      title="Statements"
      description="Period statement for a property, plus payout requests. Collections are shown as totals — never as tenant names."
      actions={<LandlordPayoutDialog properties={properties} triggerLabel="New payout request" />}
    >
      {isError ? <ErrorState title="Couldn't load statements" onRetry={() => void refetch()} className="mb-6" /> : null}

      {isLoading ? (
        <Skeleton className="mb-8 h-64 w-full" />
      ) : properties.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No statement yet" description="Link a property first to view a period statement." />
      ) : (
        <LandlordFinancialStatement properties={properties} mode="statement" />
      )}

      <section className="mt-8">
        <LandlordSettlementTransparency />
      </section>

      <section className="mt-8">
        <h2 className="section-title mb-3">Payout requests</h2>
        {payoutsError ? (
          <ErrorState title="Couldn't load payouts" onRetry={() => void refetchPayouts()} />
        ) : payoutsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : payouts.length === 0 ? (
          <EmptyState icon={Banknote} title="No payout requests yet" description="Request a payout when collected rent is ready to transfer." />
        ) : (
          <Card className="border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">{payout.property_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(payout.period_start), "dd/MM")} – {format(new Date(payout.period_end), "dd/MM/yy")}
                      </TableCell>
                      <TableCell className="font-semibold">{formatKes(payout.amount)}</TableCell>
                      <TableCell>
                        <span className={statusBadgeClass(payoutStatusTone(payout.status))}>{payout.status}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(payout.created_at), "dd/MM/yy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </LandlordLayout>
  );
}
