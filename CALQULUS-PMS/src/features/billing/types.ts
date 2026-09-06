export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  description?: string;
  status: "pending" | "paid";
  due_date: string;
  paid_date?: string;
  created_at: string;
}

export interface PaymentPayload {
  invoiceId: string;
  amount: number;
  description: string;
}

export type PaymentMethod = "mpesa" | "stripe";