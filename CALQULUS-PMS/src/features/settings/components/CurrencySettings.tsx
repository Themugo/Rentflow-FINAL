import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useCurrency, CURRENCIES, CurrencyCode } from "@/shared/hooks/useCurrency";
import { Loader2, Globe } from "lucide-react";

export function CurrencySettings() {
  const { currency, setCurrency, loading } = useCurrency();

  if (loading) {
    return (
      <Card className="card-shadow animate-fade-in">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow animate-fade-in">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Currency Settings
        </CardTitle>
        <CardDescription>
          Choose your preferred currency for displaying amounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currency">Default Currency</Label>
          <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
            <SelectTrigger id="currency" className="w-full md:w-[280px]">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{curr.symbol}</span>
                    <span>{curr.name}</span>
                    <span className="text-muted-foreground">({curr.code})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This currency will be used for invoices, receipts, and reports
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
