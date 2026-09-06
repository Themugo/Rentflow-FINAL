import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
import { Badge } from '@/shared/components/ui/badge';
import { BookOpen, Smartphone, Building2, CreditCard, CheckCircle2 } from 'lucide-react';

interface PaymentInstructionsGuideProps {
  paybillNumber?: string | null;
  tillNumber?: string | null;
  accountReference?: string;
  bankName?: string;
  accountNumber?: string;
}

export const PaymentInstructionsGuide = ({
  paybillNumber,
  tillNumber,
  accountReference,
  bankName,
  accountNumber,
}: PaymentInstructionsGuideProps) => {
  const [openItem, setOpenItem] = useState<string | undefined>(
    paybillNumber ? 'mpesa-paybill' : tillNumber ? 'mpesa-till' : 'bank',
  );

  const hasPaybill = !!paybillNumber;
  const hasTill = !!tillNumber;
  const hasBank = !!bankName && !!accountNumber;

  if (!hasPaybill && !hasTill && !hasBank) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-warning" />
          Payment Instructions
        </CardTitle>
        <CardDescription>Step-by-step guide for making payments</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem}>
          {hasPaybill && (
            <AccordionItem value="mpesa-paybill" className="border rounded-lg px-4 mb-2">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-success" />
                  </div>
                  <span className="font-medium">M-Pesa Paybill</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Recommended
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ol className="space-y-3 ml-11">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      1
                    </span>
                    <span className="text-sm">
                      Open M-Pesa on your phone and select <strong>Lipa na M-Pesa</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      2
                    </span>
                    <span className="text-sm">
                      Select <strong>Paybill</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      3
                    </span>
                    <span className="text-sm">
                      Enter Business Number:{' '}
                      <strong className="font-mono bg-muted px-2 py-0.5 rounded">{paybillNumber}</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      4
                    </span>
                    <span className="text-sm">
                      Enter Account Number:{' '}
                      <strong className="font-mono bg-muted px-2 py-0.5 rounded">
                        {accountReference || 'Your Unit Number'}
                      </strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      5
                    </span>
                    <span className="text-sm">
                      Enter the <strong>Amount</strong> and your <strong>M-Pesa PIN</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="flex-shrink-0 h-6 w-6 text-success" />
                    <span className="text-sm text-success">
                      You'll receive a confirmation SMS once payment is successful
                    </span>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          )}

          {hasTill && (
            <AccordionItem value="mpesa-till" className="border rounded-lg px-4 mb-2">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-success" />
                  </div>
                  <span className="font-medium">M-Pesa Till (Buy Goods)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ol className="space-y-3 ml-11">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      1
                    </span>
                    <span className="text-sm">
                      Open M-Pesa on your phone and select <strong>Lipa na M-Pesa</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      2
                    </span>
                    <span className="text-sm">
                      Select <strong>Buy Goods and Services</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      3
                    </span>
                    <span className="text-sm">
                      Enter Till Number:{' '}
                      <strong className="font-mono bg-muted px-2 py-0.5 rounded">{tillNumber}</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      4
                    </span>
                    <span className="text-sm">
                      Enter the <strong>Amount</strong> and your <strong>M-Pesa PIN</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="flex-shrink-0 h-6 w-6 text-success" />
                    <span className="text-sm text-success">
                      You'll receive a confirmation SMS once payment is successful
                    </span>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          )}

          {hasBank && (
            <AccordionItem value="bank" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">Bank Transfer</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ol className="space-y-3 ml-11">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      1
                    </span>
                    <span className="text-sm">
                      Log in to your <strong>mobile banking app</strong> or visit your bank
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      2
                    </span>
                    <span className="text-sm">
                      Select <strong>Transfer</strong> or <strong>Send Money</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      3
                    </span>
                    <span className="text-sm">
                      Select bank: <strong>{bankName}</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      4
                    </span>
                    <span className="text-sm">
                      Enter Account Number:{' '}
                      <strong className="font-mono bg-muted px-2 py-0.5 rounded">{accountNumber}</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-warning text-warning text-sm font-medium flex items-center justify-center">
                      5
                    </span>
                    <span className="text-sm">
                      Enter the <strong>Amount</strong> and confirm the transfer
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="flex-shrink-0 h-6 w-6 text-success" />
                    <span className="text-sm text-success">Keep your transaction receipt as proof of payment</span>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
};
