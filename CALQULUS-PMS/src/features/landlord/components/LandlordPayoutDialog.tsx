import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Banknote } from "lucide-react";
import type { LandlordPropertySummary } from "@/features/landlord/lib/types";
import { useCreateLandlordPayout } from "@/features/landlord/hooks/useLandlordPayouts";

interface Props {
  properties: LandlordPropertySummary[];
  defaultPropertyId?: string;
  triggerLabel?: string;
}

export function LandlordPayoutDialog({ properties, defaultPropertyId = "", triggerLabel = "Request payout" }: Props) {
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(defaultPropertyId);
  const [amount, setAmount] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const createPayout = useCreateLandlordPayout(properties);

  const reset = () => {
    setPropertyId(defaultPropertyId);
    setAmount("");
    setPeriodStart("");
    setPeriodEnd("");
    setNotes("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && defaultPropertyId) setPropertyId(defaultPropertyId);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="btn-brand" disabled={properties.length === 0}>
          <Banknote className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a payout</DialogTitle>
          <DialogDescription>
            Your property manager reviews this request. Amounts are from collected rent, not tenant names.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="payout-property">Property</Label>
            <select
              id="payout-property"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">Select a property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="payout-start">Period start</Label>
              <Input id="payout-start" type="date" className="mt-1" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="payout-end">Period end</Label>
              <Input id="payout-end" type="date" className="mt-1" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="payout-amount">Amount (KES)</Label>
            <Input id="payout-amount" type="number" className="mt-1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="payout-notes">Notes (optional)</Label>
            <Textarea id="payout-notes" className="mt-1 resize-none" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="btn-brand"
            disabled={createPayout.isPending || !propertyId || !amount || !periodStart || !periodEnd}
            onClick={() => {
              createPayout.mutate(
                {
                  propertyId,
                  amount: Number(amount),
                  periodStart,
                  periodEnd,
                  notes,
                },
                { onSuccess: () => setOpen(false) },
              );
            }}
          >
            {createPayout.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
