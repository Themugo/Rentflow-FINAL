// IntaSend M-Pesa Payment Types

// Supported currencies
export type SupportedCurrency = 'KES' | 'USD';

// Platform/System interfaces
export interface PaymentConfig {
  publishableKey: string;
  isLive: boolean;
  currency: SupportedCurrency;
  minAmount: number;
  maxAmount: number;
}

export interface PaymentTransaction {
  id: string;
  invoiceId: string;
  amount: number;
  currency: SupportedCurrency;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: 'mpesa' | 'stripe';
  phoneNumber?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  stripePaymentId?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface WebhookPayload {
  invoice_id: string;
  state: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
  checkout_id: string;
  mpesa_reference?: string;
  failed_reason?: string;
  created_at: string;
  updated_at: string;
}

// Tenant interfaces
export interface TenantPaymentRequest {
  invoiceId: string;
  amount: number;
  currency: SupportedCurrency;
  phoneNumber?: string;
  tenantId: string;
  tenantEmail: string;
  description: string;
  paymentMethod: 'mpesa' | 'stripe';
}

export interface TenantPaymentHistory {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  paymentDate?: string;
  mpesaReceiptNumber?: string;
  property: string;
  unit: string;
}

export interface TenantInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  description?: string;
  property: string;
  unit: string;
}

// Landlord/Manager interfaces
export interface LandlordPaymentSummary {
  totalCollected: number;
  pendingPayments: number;
  overdueAmount: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  collectionRate: number; // percentage
}

export interface LandlordPaymentReport {
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  property: string;
  unit: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'paid' | 'pending' | 'overdue';
  mpesaReceiptNumber?: string;
}

export interface LandlordTenantBalance {
  tenantId: string;
  tenantName: string;
  property: string;
  unit: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string;
}

// IntaSend API response types
export interface IntaSendCheckoutResponse {
  id: string;
  invoice_id: string;
  state: string;
  url?: string;
  signature: string;
}

export interface IntaSendSTKPushResponse {
  invoice: {
    invoice_id: string;
    state: string;
  };
  customer: {
    phone_number: string;
  };
}

export interface IntaSendError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}
