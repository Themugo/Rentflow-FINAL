import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';

// Types for Financial Partners
export interface FinancialPartner {
  id: string;
  name: string;
  type: 'bank' | 'microfinance' | 'fintech' | 'investment';
  rating: number;
  reviewCount: number;
  totalLoans: number;
  activeLoans: number;
  location: string;
  interestRateRange: string;
  loanAmountRange: string;
  approvalRate: number;
  averageProcessingTime: string;
  verified: boolean;
  services: string[];
}

export interface LoanApplication {
  id: string;
  partnerId: string;
  partnerName: string;
  propertyId: string;
  propertyName: string;
  applicantName: string;
  amount: number;
  purpose: string;
  term: number;
  interestRate: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'repaid';
  submittedDate: Date;
  approvedDate?: Date;
  disbursedDate?: Date;
  repaymentStartDate?: Date;
  monthlyPayment: number;
  totalRepayment: number;
}

export interface PaymentProcessing {
  id: string;
  partnerId: string;
  partnerName: string;
  type: 'mpesa' | 'card' | 'bank_transfer' | 'mobile_money';
  status: 'active' | 'inactive' | 'pending';
  transactionFee: number;
  processingTime: string;
  dailyLimit: number;
  monthlyLimit: number;
  setupDate: Date;
  lastTransactionDate?: Date;
}

export interface PartnerPerformance {
  partnerId: string;
  partnerName: string;
  approvalRate: number;
  averageInterestRate: number;
  disbursementSpeed: string;
  customerSatisfaction: number;
  defaultRate: number;
  totalVolume: number;
}

// Financial Partners API Service
export const financialPartnersService = {
  /**
   * Fetch all financial partners with optional filtering
   */
  async getFinancialPartners(filters?: {
    type?: string;
    location?: string;
  }): Promise<FinancialPartner[]> {
    let query = supabase
      .from('financial_partners')
      .select('*');

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    const { data, error } = await query;

    if (error) {
      logError('Error fetching financial partners:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Fetch a single financial partner by ID
   */
  async getFinancialPartnerById(id: string): Promise<FinancialPartner | null> {
    const { data, error } = await supabase
      .from('financial_partners')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logError('Error fetching financial partner:', error);
      return null;
    }

    return data;
  },

  /**
   * Fetch all loan applications with optional filtering
   */
  async getLoanApplications(filters?: {
    status?: string;
    partnerId?: string;
    propertyId?: string;
  }): Promise<LoanApplication[]> {
    let query = supabase
      .from('loan_applications')
      .select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.partnerId) {
      query = query.eq('partner_id', filters.partnerId);
    }
    if (filters?.propertyId) {
      query = query.eq('property_id', filters.propertyId);
    }

    const { data, error } = await query.order('submitted_date', { ascending: false });

    if (error) {
      logError('Error fetching loan applications:', error);
      return [];
    }

    return (data || []).map(app => ({
      ...app,
      partnerId: app.partner_id,
      propertyId: app.property_id,
      submittedDate: new Date(app.submitted_date),
      approvedDate: app.approved_date ? new Date(app.approved_date) : undefined,
      disbursedDate: app.disbursed_date ? new Date(app.disbursed_date) : undefined,
      repaymentStartDate: app.repayment_start_date ? new Date(app.repayment_start_date) : undefined,
    }));
  },

  /**
   * Create a new loan application
   */
  async createLoanApplication(application: Omit<LoanApplication, 'id' | 'submittedDate'>): Promise<LoanApplication | null> {
    const { data, error } = await supabase.rpc('create_loan_application_atomic', {
      p_payload: { partner_id: application.partnerId, property_id: application.propertyId, applicant_name: application.applicantName, amount: application.amount, purpose: application.purpose, term: application.term, interest_rate: application.interestRate, monthly_payment: application.monthlyPayment, total_repayment: application.totalRepayment },
    });

    if (error) {
      logError('Error creating loan application:', error);
      return null;
    }

    return data ? {
      ...data,
      partnerId: data.partner_id,
      propertyId: data.property_id,
      submittedDate: new Date(data.submitted_date),
      approvedDate: data.approved_date ? new Date(data.approved_date) : undefined,
      disbursedDate: data.disbursed_date ? new Date(data.disbursed_date) : undefined,
      repaymentStartDate: data.repayment_start_date ? new Date(data.repayment_start_date) : undefined,
    } : null;
  },

  /**
   * Update a loan application
   */
  async updateLoanApplication(id: string, updates: Partial<LoanApplication>): Promise<LoanApplication | null> {
    const { data, error } = await supabase.rpc('transition_loan_application_atomic', {
      p_id: id, p_status: updates.status ?? 'pending',
    });

    if (error) {
      logError('Error updating loan application:', error);
      return null;
    }

    return data ? {
      ...data,
      partnerId: data.partner_id,
      propertyId: data.property_id,
      submittedDate: new Date(data.submitted_date),
      approvedDate: data.approved_date ? new Date(data.approved_date) : undefined,
      disbursedDate: data.disbursed_date ? new Date(data.disbursed_date) : undefined,
      repaymentStartDate: data.repayment_start_date ? new Date(data.repayment_start_date) : undefined,
    } : null;
  },

  /**
   * Fetch payment processing providers
   */
  async getPaymentProcessing(): Promise<PaymentProcessing[]> {
    const { data, error } = await supabase
      .from('payment_processing')
      .select('*');

    if (error) {
      logError('Error fetching payment processing:', error);
      return [];
    }

    return (data || []).map(pp => ({
      ...pp,
      partnerId: pp.partner_id,
      setupDate: new Date(pp.setup_date),
      lastTransactionDate: pp.last_transaction_date ? new Date(pp.last_transaction_date) : undefined,
    }));
  },

  /**
   * Activate a payment processing provider
   */
  async activatePaymentProcessing(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_payment_processing_atomic', { p_id: id, p_status: 'active' });

    if (error) {
      logError('Error activating payment processing:', error);
      return false;
    }

    return true;
  },

  /**
   * Deactivate a payment processing provider
   */
  async deactivatePaymentProcessing(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_payment_processing_atomic', { p_id: id, p_status: 'inactive' });

    if (error) {
      logError('Error deactivating payment processing:', error);
      return false;
    }

    return true;
  },

  /**
   * Get partner performance metrics
   */
  async getPartnerPerformance(partnerId: string): Promise<PartnerPerformance | null> {
    // This would typically be a computed view or RPC call
    const { data, error } = await supabase
      .from('financial_partners')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (error) {
      logError('Error fetching partner performance:', error);
      return null;
    }

    // Fetch loan applications for this partner
    const { data: applications } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('partner_id', partnerId);

    const totalApplications = applications?.length || 0;
    const approvedApplications = applications?.filter(a => a.status === 'approved').length || 0;

    return {
      partnerId: data.id,
      partnerName: data.name,
      approvalRate: data.approval_rate,
      averageInterestRate: 14, // Placeholder - would be calculated from actual data
      disbursementSpeed: data.average_processing_time,
      customerSatisfaction: data.rating,
      defaultRate: 3.5, // Placeholder - would be calculated from actual data
      totalVolume: data.total_loans * 50000, // Placeholder calculation
    };
  },

  /**
   * Accept a loan application
   */
  async acceptLoanApplication(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_loan_application_atomic', { p_id: id, p_status: 'approved' });

    if (error) {
      logError('Error accepting loan application:', error);
      return false;
    }

    return true;
  },

  /**
   * Reject a loan application
   */
  async rejectLoanApplication(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_loan_application_atomic', { p_id: id, p_status: 'rejected' });

    if (error) {
      logError('Error rejecting loan application:', error);
      return false;
    }

    return true;
  },
};
