import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Wallet, Building2, Settings2 } from "lucide-react";
import { BankDetailsSettings } from "@/features/settings/components/BankDetailsSettings";
import { MpesaSettings } from "@/features/settings/components/MpesaSettings";
import { EWalletSettings } from "@/features/settings/components/EWalletSettings";
import { PropertyDeductionsManager } from "./PropertyDeductionsManager";

interface Props {
  propertyId: string;
  propertyName: string;
}

export function PropertySettingsTab({ propertyId, propertyName }: Props) {
  return (
    <Tabs defaultValue="payments" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="payments" className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Payment Accounts
        </TabsTrigger>
        <TabsTrigger value="deductions" className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Deductions & Amenities
        </TabsTrigger>
      </TabsList>

      <TabsContent value="payments">
        <div className="space-y-6">
          <BankDetailsSettings propertyId={propertyId} />
          <MpesaSettings propertyId={propertyId} propertyName={propertyName} />
          <EWalletSettings propertyId={propertyId} propertyName={propertyName} />
        </div>
      </TabsContent>

      <TabsContent value="deductions">
        <PropertyDeductionsManager propertyId={propertyId} propertyName={propertyName} />
      </TabsContent>
    </Tabs>
  );
}
