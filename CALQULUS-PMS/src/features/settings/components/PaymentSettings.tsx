import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Card, CardContent } from "@/shared/components/ui/card";
import { BankDetailsSettings } from "./BankDetailsSettings";
import { MpesaSettings } from "./MpesaSettings";
import { EWalletSettings } from "./EWalletSettings";
import {
  PropertyPaymentScopeSelector,
  type PropertyScope,
} from "./PropertyPaymentScopeSelector";
import { Banknote, Smartphone, Wallet } from "lucide-react";

export const PaymentSettings = () => {
  const [propertyScope, setPropertyScope] = useState<PropertyScope>(null);

  return (
    <div className="space-y-6">
      <Card className="border-amber-400/60/15 bg-muted/30">
        <CardContent className="pt-6">
          <PropertyPaymentScopeSelector
            value={propertyScope}
            onChange={setPropertyScope}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="mpesa" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bank" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Bank details
          </TabsTrigger>
          <TabsTrigger value="mpesa" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            M-Pesa
          </TabsTrigger>
          <TabsTrigger value="ewallet" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            E-Wallet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bank" className="mt-6">
          <BankDetailsSettings
            propertyId={propertyScope ?? undefined}
            defaultScopeOnly={propertyScope === null}
          />
        </TabsContent>

        <TabsContent value="mpesa" className="mt-6">
          <MpesaSettings propertyId={propertyScope} />
        </TabsContent>

        <TabsContent value="ewallet" className="mt-6">
          <EWalletSettings propertyId={propertyScope ?? undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
