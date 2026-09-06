/**
 * Invoice Due Date Logic
 * 
 * - Reminders start 5 days before due date
 * - Invoice becomes overdue 1 day AFTER the due date
 */

/**
 * Check if an invoice is overdue (1+ days past due date)
 */
const CLOSED_INVOICE_STATUSES = new Set(['paid', 'cancelled', 'failed', 'refunded']);

export const isInvoiceOverdue = (dueDate: string, status: string): boolean => {
  if (CLOSED_INVOICE_STATUSES.has(status)) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  // Calculate difference in days
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Overdue if more than 1 day past due date
  return diffDays > 1;
};

/**
 * Get days until due date (negative means past due)
 */
export const getDaysUntilDue = (dueDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if invoice should trigger a reminder (5 days before due or less)
 */
export const shouldSendReminder = (dueDate: string, status: string): boolean => {
  if (CLOSED_INVOICE_STATUSES.has(status)) return false;
  
  const daysUntilDue = getDaysUntilDue(dueDate);
  
  // Send reminders starting 5 days before due date
  return daysUntilDue <= 5;
};

/**
 * Get invoice status label based on due date logic
 */
export const getInvoiceDisplayStatus = (
  dueDate: string, 
  status: string
): 'paid' | 'pending' | 'overdue' | 'cancelled' | 'partially_paid' | 'failed' | 'refunded' => {
  if (status === 'paid' || status === 'cancelled' || status === 'failed' || status === 'refunded') {
    return status;
  }
  if (status === 'partially_paid' && !isInvoiceOverdue(dueDate, status)) {
    return 'partially_paid';
  }
  
  // Check if overdue (1+ days past due)
  if (isInvoiceOverdue(dueDate, status)) {
    return 'overdue';
  }
  
  return 'pending';
};

/**
 * Get reminder type based on days until due
 */
export const getReminderType = (dueDate: string): 
  'overdue' | 'due_today' | 'due_tomorrow' | 'upcoming_5_days' | 'upcoming_3_days' | null => {
  const daysUntilDue = getDaysUntilDue(dueDate);
  
  if (daysUntilDue < -1) return 'overdue'; // More than 1 day past due
  if (daysUntilDue === 0) return 'due_today';
  if (daysUntilDue === 1) return 'due_tomorrow';
  if (daysUntilDue <= 3) return 'upcoming_3_days';
  if (daysUntilDue <= 5) return 'upcoming_5_days';
  
  return null; // Not yet time for reminder
};
