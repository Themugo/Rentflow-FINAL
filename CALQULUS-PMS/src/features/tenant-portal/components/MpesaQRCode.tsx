import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Smartphone, Download } from 'lucide-react';
import { toast } from '@/shared/hooks/use-toast';
import { downloadQrCodeAsPng } from '@/shared/lib/downloadQrCode';

interface MpesaQRCodeProps {
  paybillNumber?: string | null;
  tillNumber?: string | null;
  accountNumber?: string;
  amount?: number;
}

export const MpesaQRCode = ({ paybillNumber, tillNumber, accountNumber, amount }: MpesaQRCodeProps) => {
  if (!paybillNumber && !tillNumber) {
    return null;
  }

  // Generate M-Pesa QR code data
  // Format: Paybill/Till number with optional account reference
  const generateQRData = (type: 'paybill' | 'till', number: string) => {
    const lines = [`M-Pesa ${type === 'paybill' ? 'Paybill' : 'Till'} Payment`];
    lines.push(`${type === 'paybill' ? 'Business No' : 'Till No'}: ${number}`);
    if (type === 'paybill' && accountNumber) {
      lines.push(`Account: ${accountNumber}`);
    }
    if (amount) {
      lines.push(`Amount: KES ${amount.toLocaleString()}`);
    }
    return lines.join('\n');
  };

  const handleDownloadPaybill = () => {
    if (!paybillNumber) return;
    const ok = downloadQrCodeAsPng('mpesa-paybill-qr-code', `mpesa-paybill-${paybillNumber}.png`);
    if (ok) {
      toast({ title: 'Paybill QR code downloaded as PNG!' });
    } else {
      toast({ title: 'Failed to download Paybill QR code', variant: 'destructive' });
    }
  };

  const handleDownloadTill = () => {
    if (!tillNumber) return;
    const ok = downloadQrCodeAsPng('mpesa-till-qr-code', `mpesa-till-${tillNumber}.png`);
    if (ok) {
      toast({ title: 'Till QR code downloaded as PNG!' });
    } else {
      toast({ title: 'Failed to download Till QR code', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-success" />
          Scan to Pay
        </CardTitle>
        <CardDescription className="text-xs">
          Scan with your phone camera or download QR code as PNG image
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6 justify-center">
        {paybillNumber && (
          <div className="text-center space-y-2 flex flex-col items-center">
            <div className="p-3 bg-white rounded-lg inline-block shadow-sm border">
              <QRCodeSVG
                id="mpesa-paybill-qr-code"
                value={generateQRData('paybill', paybillNumber)}
                size={120}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Paybill: {paybillNumber}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadPaybill}
              className="h-7 text-[11px] px-2.5 gap-1.5 shadow-xs"
            >
              <Download className="h-3 w-3" />
              Download PNG
            </Button>
          </div>
        )}
        {tillNumber && (
          <div className="text-center space-y-2 flex flex-col items-center">
            <div className="p-3 bg-white rounded-lg inline-block shadow-sm border">
              <QRCodeSVG
                id="mpesa-till-qr-code"
                value={generateQRData('till', tillNumber)}
                size={120}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Till: {tillNumber}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadTill}
              className="h-7 text-[11px] px-2.5 gap-1.5 shadow-xs"
            >
              <Download className="h-3 w-3" />
              Download PNG
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
