import { useState } from 'react';
import { useAuditLogs, AuditLog } from '@/shared/hooks/useAuditLogs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { format } from 'date-fns';
import { Search, Filter, Eye, Shield, FileText, CreditCard, Settings, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { isTenantEntityType } from '@/features/webhost/lib/adminSecurity';
import { stringifyMasked } from '@/features/webhost/lib/secrets';

const resourceTypeIcons: Record<string, React.ReactNode> = {
  contract: <FileText className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  invoice: <FileText className="h-4 w-4" />,
  mpesa_settings: <Settings className="h-4 w-4" />,
};

const webhostVisibleResourceTypes = ['contract', 'payment', 'invoice', 'mpesa_settings'];

const actionColors: Record<string, string> = {
  create: 'bg-success/10 text-success',
  update: 'bg-primary/10 text-primary',
  delete: 'bg-destructive/15 text-destructive',
  view: 'bg-muted text-muted-foreground',
  export: 'bg-warning/15 text-warning',
  download: 'bg-warning/10 text-warning',
};

export function SecurityAuditLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  const queryClient = useQueryClient();
  
  const { data: logs, isLoading, error } = useAuditLogs({
    resourceType: resourceFilter !== 'all' ? resourceFilter : undefined,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    limit: 500,
  });

  const visibleLogs = logs?.filter(log => !isTenantEntityType(log.entity_type));

  const filteredLogs = visibleLogs?.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.actor_email?.toLowerCase().includes(query) ||
      log.entity_type.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      (typeof log.metadata === 'object' && stringifyMasked(log.metadata as Record<string, unknown>).toLowerCase().includes(query))
    );
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Audit Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading audit logs. You may not have permission to view this data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Audit Logs
            </CardTitle>
            <CardDescription>
              Track platform-sensitive access and changes without exposing tenant records.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, resource, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="contract">Contracts</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="mpesa_settings">M-Pesa Settings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="export">Export</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {webhostVisibleResourceTypes.map((type) => {
            const count = visibleLogs?.filter(l => l.entity_type === type).length || 0;
            return (
              <div key={type} className="bg-secondary-background rounded-lg p-3 text-center">
                <div className="flex justify-center mb-1">
                  {resourceTypeIcons[type]}
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}</p>
              </div>
            );
          })}
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
              <p className="text-sm">Activity will appear here as users interact with sensitive data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss')}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={log.actor_email || ''}>
                      {log.actor_email || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColors[log.action] || 'bg-secondary-background'}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {resourceTypeIcons[log.entity_type]}
                        <span className="capitalize">{log.entity_type.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {log.metadata ? `${stringifyMasked(log.metadata as Record<string, unknown>).slice(0, 50)}…` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Audit Log Details</DialogTitle>
                          </DialogHeader>
                          {selectedLog && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Timestamp</p>
                                  <p className="font-medium">
                                    {format(new Date(selectedLog.created_at), 'PPpp')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">User</p>
                                  <p className="font-medium">{selectedLog.actor_email || 'Unknown'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Action</p>
                                  <Badge className={actionColors[selectedLog.action]}>
                                    {selectedLog.action}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Resource Type</p>
                                  <p className="font-medium capitalize">
                                    {selectedLog.entity_type?.replace('_', ' ') || 'N/A'}
                                  </p>
                                </div>
                                {selectedLog.entity_id && (
                                  <div className="col-span-2">
                                    <p className="text-muted-foreground">Resource ID</p>
                                    <p className="font-mono text-xs">{selectedLog.entity_id}</p>
                                  </div>
                                )}
                                {selectedLog.property_id && (
                                  <div>
                                    <p className="text-muted-foreground">Property ID</p>
                                    <p className="font-mono text-xs">{selectedLog.property_id}</p>
                                  </div>
                                )}
                                {selectedLog.entity_label && (
                                  <div>
                                    <p className="text-muted-foreground">Label</p>
                                    <p className="font-medium">{selectedLog.entity_label}</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-2">Details</p>
                                <pre className="bg-secondary-background p-3 rounded-md text-xs overflow-x-auto">
                                  {stringifyMasked(selectedLog.metadata as Record<string, unknown>)}
                                </pre>
                              </div>
                              {selectedLog.actor_role && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Actor Role</p>
                                  <p className="text-xs text-muted-foreground break-all">
                                    {selectedLog.actor_role}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredLogs?.length || 0} of {visibleLogs?.length || 0} visible audit log entries
        </div>
      </CardContent>
    </Card>
  );
}
