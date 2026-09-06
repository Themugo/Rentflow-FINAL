import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Plus, Trash2, Calculator, Users, FileText, Loader2 } from 'lucide-react';
import { addDays, format } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  property: string | null;
  unit: string | null;
  monthly_rent: number | null;
}

interface Lease {
  id: string;
  property: string;
  unit: string;
  monthly_rent: number;
  tenant_id: string | null;
  tenants: {
    id: string;
    name: string;
    email: string;
    photo_url: string | null;
  } | null;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface TenantInvoiceFormProps {
  tenants: Tenant[];
  leases: Lease[];
  onSubmit: (data: {
    tenant_id: string | null;
    lease_id: string | null;
    amount: number;
    description: string;
    due_date: string;
    send_notification: boolean;
  }) => Promise<void>;
  isPending: boolean;
  onCancel: () => void;
}

const TenantInvoiceForm: React.FC<TenantInvoiceFormProps> = ({
  tenants,
  leases,
  onSubmit,
  isPending,
  onCancel,
}) => {
  const [invoiceFor, setInvoiceFor] = useState<'tenant' | 'lease'>('tenant');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedLease, setSelectedLease] = useState('');
  const [invoiceType, setInvoiceType] = useState<'rent' | 'custom'>('rent');
  const [dueInDays, setDueInDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  
  // Line items for custom invoice
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  // Get selected entity data
  const selectedTenantData = useMemo(() => 
    tenants.find(t => t.id === selectedTenant),
    [tenants, selectedTenant]
  );

  const selectedLeaseData = useMemo(() => 
    leases.find(l => l.id === selectedLease),
    [leases, selectedLease]
  );

  // Calculate automatic amount for rent invoice
  const rentAmount = useMemo(() => {
    if (invoiceFor === 'tenant' && selectedTenantData?.monthly_rent) {
      return selectedTenantData.monthly_rent;
    }
    if (invoiceFor === 'lease' && selectedLeaseData?.monthly_rent) {
      return selectedLeaseData.monthly_rent;
    }
    return 0;
  }, [invoiceFor, selectedTenantData, selectedLeaseData]);

  // Calculate total from line items
  const lineItemsTotal = useMemo(() => 
    lineItems.reduce((sum, item) => sum + item.amount, 0),
    [lineItems]
  );

  const totalAmount = invoiceType === 'custom' ? lineItemsTotal : rentAmount;

  // Generate description - for custom invoices, include line items as JSON for receipt parsing
  const generateDescription = () => {
    const monthYear = format(new Date(), 'MMMM yyyy');
    
    if (invoiceType === 'rent') {
      if (invoiceFor === 'tenant' && selectedTenantData) {
        return `${monthYear} Rent - ${selectedTenantData.property || ''} ${selectedTenantData.unit || ''}`.trim();
      }
      if (invoiceFor === 'lease' && selectedLeaseData) {
        return `${monthYear} Rent - ${selectedLeaseData.property} ${selectedLeaseData.unit}`;
      }
      return `${monthYear} Rent`;
    } else {
      // For custom invoices, store line items as JSON for receipt breakdown
      const validItems = lineItems
        .filter(item => item.description && item.amount > 0)
        .map(({ description, quantity, rate, amount }) => ({
          description,
          quantity,
          rate,
          amount,
        }));
      
      const itemDescriptions = validItems.map(item => item.description).join(', ');
      const displayText = notes ? `${notes} - ${itemDescriptions}` : itemDescriptions || 'Custom Invoice';
      
      // Encode line items as JSON marker at the end
      const lineItemsJson = JSON.stringify(validItems);
      return `${displayText}<!--LINE_ITEMS:${lineItemsJson}-->`;
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: 1, rate: 0, amount: 0 }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setLineItems(lineItems.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Recalculate amount if quantity or rate changes
      if (field === 'quantity' || field === 'rate') {
        updated.amount = Number(updated.quantity) * Number(updated.rate);
      }
      
      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasSelection = (invoiceFor === 'tenant' && selectedTenant) || 
                          (invoiceFor === 'lease' && selectedLease);
    if (!hasSelection) return;

    const dueDate = addDays(new Date(), parseInt(dueInDays));

    await onSubmit({
      tenant_id: invoiceFor === 'tenant' ? selectedTenant : (selectedLeaseData?.tenant_id || null),
      lease_id: invoiceFor === 'lease' ? selectedLease : null,
      amount: totalAmount,
      description: generateDescription(),
      due_date: dueDate.toISOString().split('T')[0],
      send_notification: sendNotification,
    });
  };

  const hasValidSelection = (invoiceFor === 'tenant' && selectedTenant) || 
                             (invoiceFor === 'lease' && selectedLease);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Invoice For Selection */}
      <div className="space-y-2">
        <Label className="text-foreground">Invoice For *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant={invoiceFor === 'tenant' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => {
              setInvoiceFor('tenant');
              setSelectedLease('');
            }}
          >
            <Users className="h-4 w-4 mr-2" />
            Tenant
          </Button>
          <Button
            type="button"
            variant={invoiceFor === 'lease' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => {
              setInvoiceFor('lease');
              setSelectedTenant('');
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            From Lease
          </Button>
        </div>
      </div>

      {/* Tenant/Lease Selection */}
      <div className="space-y-2">
        <Label className="text-foreground">
          {invoiceFor === 'tenant' ? 'Select Tenant *' : 'Select Lease *'}
        </Label>
        {invoiceFor === 'tenant' ? (
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Choose a tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.length === 0 ? (
                <SelectItem value="none" disabled>No active tenants</SelectItem>
              ) : (
                tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={tenant.photo_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {tenant.name?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span>{tenant.name} {tenant.property ? `- ${tenant.property}` : ''} {tenant.unit || ''}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedLease} onValueChange={setSelectedLease}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Choose a lease" />
            </SelectTrigger>
            <SelectContent>
              {leases.length === 0 ? (
                <SelectItem value="none" disabled>No active leases</SelectItem>
              ) : (
                leases.map((lease) => (
                  <SelectItem key={lease.id} value={lease.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={lease.tenants?.photo_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {lease.tenants?.name?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span>{lease.tenants?.name || 'No Tenant'} - {lease.property} {lease.unit}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Invoice Type Selection */}
      <div className="space-y-2">
        <Label className="text-foreground">Invoice Type</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant={invoiceType === 'rent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInvoiceType('rent')}
          >
            Monthly Rent
          </Button>
          <Button
            type="button"
            variant={invoiceType === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInvoiceType('custom')}
          >
            Custom
          </Button>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="font-semibold w-16 text-center">Qty</TableHead>
              <TableHead className="font-semibold w-28 text-right">Rate (KES)</TableHead>
              <TableHead className="font-semibold w-28 text-right">Amount</TableHead>
              {invoiceType === 'custom' && (
                <TableHead className="w-10"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceType !== 'custom' ? (
              // Auto-calculated row for rent
              <TableRow>
                <TableCell className="font-medium">
                  {format(new Date(), 'MMMM yyyy')} Rent
                  {invoiceFor === 'tenant' && selectedTenantData && (
                    <span className="text-muted-foreground ml-1">
                      - {selectedTenantData.property || ''} {selectedTenantData.unit || ''}
                    </span>
                  )}
                  {invoiceFor === 'lease' && selectedLeaseData && (
                    <span className="text-muted-foreground ml-1">
                      - {selectedLeaseData.property} {selectedLeaseData.unit}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">1</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {rentAmount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {rentAmount.toLocaleString()}
                </TableCell>
              </TableRow>
            ) : (
              // Editable line items for custom invoice
              lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="p-1">
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder="Enter description"
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      className="h-9 text-center"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      className="h-9 text-right"
                    />
                  </TableCell>
                  <TableCell className="p-1 text-right">
                    <div className="bg-muted/50 border rounded-md px-3 py-1.5 font-semibold">
                      {item.amount.toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
                      onClick={() => removeLineItem(item.id)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
            
            {/* Add Row Button (for custom) */}
            {invoiceType === 'custom' && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full border border-dashed text-muted-foreground hover:text-foreground"
                    onClick={addLineItem}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {/* Total Row */}
            <TableRow className="bg-amber-400/10 hover:bg-amber-400/10 font-semibold">
              <TableCell colSpan={invoiceType === 'custom' ? 3 : 3} className="text-right">
                Total:
              </TableCell>
              <TableCell className="text-right font-bold text-lg" colSpan={invoiceType === 'custom' ? 2 : 1}>
                KES {totalAmount.toLocaleString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Due Date & Notes Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground">Due In</Label>
          <Select value={dueInDays} onValueChange={setDueInDays}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Due: {format(addDays(new Date(), parseInt(dueInDays)), 'dd/MM/yy')}
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            className="h-[76px] resize-none"
          />
        </div>
      </div>

      {/* Send Notification Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="sendNotification"
          checked={sendNotification}
          onCheckedChange={(checked) => setSendNotification(checked as boolean)}
        />
        <Label htmlFor="sendNotification" className="text-sm font-normal cursor-pointer">
          Send invoice notification email to tenant
        </Label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={isPending || !hasValidSelection || totalAmount <= 0}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Create Invoice - KES {totalAmount.toLocaleString()}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default TenantInvoiceForm;
