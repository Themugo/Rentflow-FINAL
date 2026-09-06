import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Receipt, Download, CheckCircle, Users, Percent, Search, Calendar, Filter } from 'lucide-react';
import { generateManagerReceipt } from '@/features/billing/lib/managerReceiptPdfExport';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

interface Manager {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
}

interface ManagerInvoice {
  id: string;
  manager_user_id: string;
  invoice_number: string;
  amount: number;
  description: string | null;
  status: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
  property_count: number;
  rate_per_property: number;
  invoice_type: string;
  net_collection: number;
  commission_rate: number;
}

interface ManagerReceiptsProps {
  managers: Manager[] | undefined;
  invoices: ManagerInvoice[] | undefined;
  isLoading: boolean;
}

const ManagerReceipts: React.FC<ManagerReceiptsProps> = ({ managers, invoices, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'registration' | 'subscription'>('all');
  const [filterMonth, setFilterMonth] = useState('all');

  // Generate month options for the last 12 months
  const monthOptions = React.useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  // Apply filters
  const filteredReceipts = React.useMemo(() => {
    // Filter to only show paid invoices (receipts)
    const paidInvoices = invoices?.filter(inv => inv.status === 'paid') || [];
    return paidInvoices.filter(invoice => {
      // Search filter
      const manager = managers?.find(m => m.user_id === invoice.manager_user_id);
      const searchMatch = 
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (manager?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (manager?.email?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Type filter
      const typeMatch = filterType === 'all' || invoice.invoice_type === filterType;

      // Month filter
      let monthMatch = true;
      if (filterMonth !== 'all' && invoice.paid_date) {
        const invoiceMonth = format(parseISO(invoice.paid_date), 'yyyy-MM');
        monthMatch = invoiceMonth === filterMonth;
      }

      return searchMatch && typeMatch && monthMatch;
    });
  }, [invoices, managers, searchTerm, filterType, filterMonth]);

  const getManagerName = (userId: string) => {
    const manager = managers?.find(m => m.user_id === userId);
    return manager?.full_name || manager?.email || 'Unknown';
  };

  const getManagerEmail = (userId: string) => {
    const manager = managers?.find(m => m.user_id === userId);
    return manager?.email || '';
  };

  const getInvoiceTypeBadge = (type: string) => {
    if (type === 'registration') {
      return (
        <Badge className="bg-[hsl(214_73%_45%/0.2)] text-[hsl(214_73%_58%)] border-[hsl(214_73%_45%/0.3)]">
          <Users className="h-3 w-3 mr-1" />
          Registration
        </Badge>
      );
    }
    return (
      <Badge className="bg-warning/12 text-warning border-warning/20">
        <Percent className="h-3 w-3 mr-1" />
        Subscription
      </Badge>
    );
  };

  const handleDownloadReceipt = (invoice: ManagerInvoice) => {
    const manager = managers?.find(m => m.user_id === invoice.manager_user_id);
    generateManagerReceipt(invoice, {
      full_name: manager?.full_name || null,
      email: manager?.email || '',
    });
  };

  // Calculate summary stats
  const stats = React.useMemo(() => {
    const totalCollected = filteredReceipts.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const registrationTotal = filteredReceipts
      .filter(inv => inv.invoice_type === 'registration')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    const subscriptionTotal = filteredReceipts
      .filter(inv => inv.invoice_type === 'subscription')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    
    return { totalCollected, registrationTotal, subscriptionTotal, count: filteredReceipts.length };
  }, [filteredReceipts]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Total Collected</p>
                <p className="text-2xl font-bold text-foreground">KES {stats.totalCollected.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[hsl(214_73%_48%/0.2)] flex items-center justify-center">
                <Users className="h-6 w-6 text-[hsl(214_73%_58%)]" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Registration Fees</p>
                <p className="text-2xl font-bold text-foreground">KES {stats.registrationTotal.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[hsl(218_58%_50%/0.2)] flex items-center justify-center">
                <Percent className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Subscriptions</p>
                <p className="text-2xl font-bold text-foreground">KES {stats.subscriptionTotal.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Total Receipts</p>
                <p className="text-2xl font-bold text-foreground">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receipts Table */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Receipt className="h-5 w-5 text-warning" />
                Payment Receipts
              </CardTitle>
              <CardDescription className="text-warning/70">
                Completed payments and downloadable receipts
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warning" />
                <Input
                  placeholder="Search receipts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-card border-warning/20 text-foreground w-48"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="bg-card border-warning/20 text-foreground w-40">
                  <Filter className="h-4 w-4 mr-2 text-warning" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-warning/20">
                  <SelectItem value="all" className="text-foreground">All Types</SelectItem>
                  <SelectItem value="registration" className="text-foreground">Registration</SelectItem>
                  <SelectItem value="subscription" className="text-foreground">Subscription</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="bg-card border-warning/20 text-foreground w-44">
                  <Calendar className="h-4 w-4 mr-2 text-warning" />
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="bg-card border-warning/20">
                  <SelectItem value="all" className="text-foreground">All Time</SelectItem>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-foreground">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-secondary-background rounded"></div>
              ))}
            </div>
          ) : filteredReceipts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-warning/12 hover:bg-transparent">
                  <TableHead className="text-warning/70">Receipt #</TableHead>
                  <TableHead className="text-warning/70">Type</TableHead>
                  <TableHead className="text-warning/70">Manager</TableHead>
                  <TableHead className="text-warning/70">Amount</TableHead>
                  <TableHead className="text-warning/70">Paid Date</TableHead>
                  <TableHead className="text-warning/70">Net Collection</TableHead>
                  <TableHead className="text-warning/70 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((invoice) => (
                  <TableRow key={invoice.id} className="border-warning/12 hover:bg-[hsl(218_58%_16%/0.2)]">
                    <TableCell className="text-foreground font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell>{getInvoiceTypeBadge(invoice.invoice_type || 'subscription')}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-warning/80">{getManagerName(invoice.manager_user_id)}</p>
                        <p className="text-xs text-warning">{getManagerEmail(invoice.manager_user_id)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground font-semibold">KES {Number(invoice.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-warning/70">
                      {invoice.paid_date ? format(new Date(invoice.paid_date), 'dd/MM/yy') : '-'}
                    </TableCell>
                    <TableCell className="text-warning/70">
                      {invoice.invoice_type === 'subscription' && invoice.net_collection > 0
                        ? `KES ${Number(invoice.net_collection).toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadReceipt(invoice)}
                        className="text-success hover:text-success hover:bg-success/15"
                        title="Download Receipt"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-warning">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No receipts found</p>
              {(searchTerm || filterType !== 'all' || filterMonth !== 'all') && (
                <p className="text-sm mt-2">Try adjusting your filters</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerReceipts;
