import { invoiceStatusLabel, invoiceStatusTone, statusBadgeClass } from './statusBadge';

export type InvoiceDisplayState = 'paid' | 'overdue' | 'due_today' | 'due_soon' | 'pending';

export function invoiceDisplayState(status: string, dueDate?: string | null, today = new Date()): InvoiceDisplayState {
  if (status === 'paid') return 'paid';
  if (status === 'overdue') return 'overdue';
  if (!dueDate) return 'pending';
  const due = new Date(`${dueDate}T00:00:00`);
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.ceil((due.getTime() - day.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due_today';
  if (diff <= 3) return 'due_soon';
  return 'pending';
}

export function invoiceDisplayBadge(status: string, dueDate?: string | null) {
  const state = invoiceDisplayState(status, dueDate);
  if (state === 'paid') return { label: 'Paid', className: statusBadgeClass('success' as const), iconTone: 'text-success' };
  if (state === 'overdue') return { label: 'Overdue', className: statusBadgeClass('danger' as const), iconTone: 'text-destructive' };
  if (state === 'due_today') return { label: 'Due today', className: statusBadgeClass('warning' as const), iconTone: 'text-warning' };
  if (state === 'due_soon') return { label: 'Due soon', className: statusBadgeClass('warning' as const), iconTone: 'text-warning' };
  return { label: invoiceStatusLabel(status), className: statusBadgeClass(invoiceStatusTone(status)), iconTone: 'text-muted-foreground' };
}
