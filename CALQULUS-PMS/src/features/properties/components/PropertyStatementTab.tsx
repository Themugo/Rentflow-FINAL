import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Download, FileSpreadsheet, Loader2, Settings2 } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { downloadPropertyStatementPDF } from "@/features/properties/lib/propertyStatementPdfExport";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { PropertyDeductionsManager } from "./PropertyDeductionsManager";

interface Props {
  propertyId: string;
  propertyName: string;
}

export function PropertyStatementTab({ propertyId, propertyName }: Props) {
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const monthDate = new Date(selectedMonth + "-01");
      await downloadPropertyStatementPDF(propertyId, monthDate, currency);
      toast({ title: "Downloaded", description: "Monthly statement PDF generated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate statement", variant: "destructive" });
    }
    setIsGenerating(false);
  };

  return (
    <Tabs defaultValue="generate" className="space-y-4">
      <TabsList>
        <TabsTrigger value="generate" className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Generate Statement
        </TabsTrigger>
        <TabsTrigger value="deductions" className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Deductions & Amenities
        </TabsTrigger>
      </TabsList>

      <TabsContent value="generate">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Collection Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a property-level monthly statement showing rent collection per unit, water billing, amenity charges, deductions, and net amount due to landlord.
            </p>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label>Select Month</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download Statement
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="deductions">
        <PropertyDeductionsManager propertyId={propertyId} propertyName={propertyName} />
      </TabsContent>
    </Tabs>
  );
}
