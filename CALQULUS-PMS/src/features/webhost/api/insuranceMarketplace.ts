import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';

// Types for Insurance Marketplace
export interface InsuranceProvider {
  id: string;
  name: string;
  type: 'property' | 'liability' | 'health' | 'comprehensive';
  rating: number;
  reviewCount: number;
  totalPolicies: number;
  activePolicies: number;
  location: string;
  premiumRange: string;
  coverageRange: string;
  claimApprovalRate: number;
  averageClaimTime: string;
  verified: boolean;
  coverageTypes: string[];
}

export interface InsurancePolicy {
  id: string;
  providerId: string;
  providerName: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  policyType: string;
  coverageType: string;
  coverageAmount: number;
  premium: number;
  deductible: number;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  renewalDate: Date;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  policyNumber: string;
  providerId: string;
  providerName: string;
  propertyId: string;
  propertyName: string;
  claimType: string;
  description: string;
  claimAmount: number;
  approvedAmount?: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submittedDate: Date;
  approvedDate?: Date;
  paidDate?: Date;
  documents: string[];
}

export interface ProviderPerformance {
  providerId: string;
  providerName: string;
  claimApprovalRate: number;
  averageClaimTime: string;
  customerSatisfaction: number;
  totalClaims: number;
  totalPayout: number;
  responseTime: string;
}

// Insurance Marketplace API Service
export const insuranceMarketplaceService = {
  /**
   * Fetch all insurance providers with optional filtering
   */
  async getInsuranceProviders(filters?: {
    type?: string;
    location?: string;
  }): Promise<InsuranceProvider[]> {
    let query = supabase
      .from('insurance_providers')
      .select('*');

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    const { data, error } = await query;

    if (error) {
      logError('Error fetching insurance providers:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Fetch a single insurance provider by ID
   */
  async getInsuranceProviderById(id: string): Promise<InsuranceProvider | null> {
    const { data, error } = await supabase
      .from('insurance_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logError('Error fetching insurance provider:', error);
      return null;
    }

    return data;
  },

  /**
   * Fetch all insurance policies with optional filtering
   */
  async getInsurancePolicies(filters?: {
    status?: string;
    providerId?: string;
    propertyId?: string;
  }): Promise<InsurancePolicy[]> {
    let query = supabase
      .from('insurance_policies')
      .select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.providerId) {
      query = query.eq('provider_id', filters.providerId);
    }
    if (filters?.propertyId) {
      query = query.eq('property_id', filters.propertyId);
    }

    const { data, error } = await query.order('start_date', { ascending: false });

    if (error) {
      logError('Error fetching insurance policies:', error);
      return [];
    }

    return (data || []).map(policy => ({
      ...policy,
      providerId: policy.provider_id,
      propertyId: policy.property_id,
      startDate: new Date(policy.start_date),
      endDate: new Date(policy.end_date),
      renewalDate: new Date(policy.renewal_date),
    }));
  },

  /**
   * Create a new insurance policy
   */
  async createInsurancePolicy(policy: Omit<InsurancePolicy, 'id'>): Promise<InsurancePolicy | null> {
    const { data, error } = await supabase.rpc('save_insurance_policy_atomic', {
      p_policy_id: null, p_provider_id: policy.providerId, p_property_id: policy.propertyId,
      p_unit: policy.unit, p_policy_type: policy.policyType, p_coverage_type: policy.coverageType,
      p_coverage_amount: policy.coverageAmount, p_premium: policy.premium, p_deductible: policy.deductible,
      p_status: policy.status, p_start_date: policy.startDate.toISOString(), p_end_date: policy.endDate.toISOString(),
      p_renewal_date: policy.renewalDate.toISOString(),
    });
    if (error) { logError('Error creating insurance policy:', error); return null; }
    const row = data as any;
    return row ? { ...row, providerId: row.provider_id, propertyId: row.property_id, startDate: new Date(row.start_date), endDate: new Date(row.end_date), renewalDate: new Date(row.renewal_date) } : null;
  },
  /**
   * Update an insurance policy
   */
  async updateInsurancePolicy(id: string, updates: Partial<InsurancePolicy>): Promise<InsurancePolicy | null> {
    const { data, error } = await supabase.rpc('save_insurance_policy_atomic', {
      p_policy_id: id, p_provider_id: updates.providerId ?? null, p_property_id: updates.propertyId ?? null,
      p_unit: updates.unit ?? null, p_policy_type: updates.policyType ?? null, p_coverage_type: updates.coverageType ?? null,
      p_coverage_amount: updates.coverageAmount ?? 0, p_premium: updates.premium ?? 0, p_deductible: updates.deductible ?? 0,
      p_status: updates.status ?? 'active', p_start_date: updates.startDate?.toISOString() ?? null,
      p_end_date: updates.endDate?.toISOString() ?? null, p_renewal_date: updates.renewalDate?.toISOString() ?? null,
    });
    if (error) { logError('Error updating insurance policy:', error); return null; }
    const row = data as any;
    return row ? { ...row, providerId: row.provider_id, propertyId: row.property_id, startDate: new Date(row.start_date), endDate: new Date(row.end_date), renewalDate: new Date(row.renewal_date) } : null;
  },
  /**
   * Fetch insurance claims with optional filtering
   */
  async getInsuranceClaims(filters?: {
    status?: string;
    providerId?: string;
    policyId?: string;
  }): Promise<InsuranceClaim[]> {
    let query = supabase
      .from('insurance_claims')
      .select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.providerId) {
      query = query.eq('provider_id', filters.providerId);
    }
    if (filters?.policyId) {
      query = query.eq('policy_id', filters.policyId);
    }

    const { data, error } = await query.order('submitted_date', { ascending: false });

    if (error) {
      logError('Error fetching insurance claims:', error);
      return [];
    }

    return (data || []).map(claim => ({
      ...claim,
      policyId: claim.policy_id,
      providerId: claim.provider_id,
      propertyId: claim.property_id,
      submittedDate: new Date(claim.submitted_date),
      approvedDate: claim.approved_date ? new Date(claim.approved_date) : undefined,
      paidDate: claim.paid_date ? new Date(claim.paid_date) : undefined,
    }));
  },

  /**
   * Create a new insurance claim
   */
  async createInsuranceClaim(claim: Omit<InsuranceClaim, 'id' | 'submittedDate'>): Promise<InsuranceClaim | null> {
    const { data, error } = await supabase.rpc('create_insurance_claim_atomic' as never, {
      p_policy_id: claim.policyId,
      p_provider_id: claim.providerId,
      p_property_id: claim.propertyId,
      p_claim_type: claim.claimType,
      p_description: claim.description,
      p_claim_amount: claim.claimAmount,
      p_documents: claim.documents ?? null,
    });

    if (error) {
      logError('Error creating insurance claim:', error);
      return null;
    }

    return data ? {
      ...data,
      policyId: data.policy_id,
      providerId: data.provider_id,
      propertyId: data.property_id,
      submittedDate: new Date(data.submitted_date),
      approvedDate: data.approved_date ? new Date(data.approved_date) : undefined,
      paidDate: data.paid_date ? new Date(data.paid_date) : undefined,
    } : null;
  },

  /**
   * Update an insurance claim
   */
  async updateInsuranceClaim(id: string, updates: Partial<InsuranceClaim>): Promise<InsuranceClaim | null> {
    const targetStatus = updates.status || 'under_review';
    const { data, error } = await supabase.rpc('transition_insurance_claim_atomic' as never, {
      p_claim_id: id,
      p_target_status: targetStatus,
      p_approved_amount: updates.approvedAmount ?? null,
    });

    if (error) {
      logError('Error updating insurance claim:', error);
      return null;
    }

    return data ? {
      ...data,
      policyId: data.policy_id,
      providerId: data.provider_id,
      propertyId: data.property_id,
      submittedDate: new Date(data.submitted_date),
      approvedDate: data.approved_date ? new Date(data.approved_date) : undefined,
      paidDate: data.paid_date ? new Date(data.paid_date) : undefined,
    } : null;
  },

  /**
   * Get provider performance metrics
   */
  async getProviderPerformance(providerId: string): Promise<ProviderPerformance | null> {
    const { data, error } = await supabase
      .from('insurance_providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (error) {
      logError('Error fetching provider performance:', error);
      return null;
    }

    // Fetch claims for this provider
    const { data: claims } = await supabase
      .from('insurance_claims')
      .select('*')
      .eq('provider_id', providerId);

    const totalClaims = claims?.length || 0;
    const approvedClaims = claims?.filter(c => c.status === 'approved').length || 0;

    return {
      providerId: data.id,
      providerName: data.name,
      claimApprovalRate: data.claim_approval_rate,
      averageClaimTime: data.average_claim_time,
      customerSatisfaction: data.rating,
      totalClaims,
      totalPayout: totalClaims * 50000, // Placeholder calculation
      responseTime: '24 hours', // Placeholder
    };
  },

  /**
   * Approve an insurance claim
   */
  async approveInsuranceClaim(id: string, approvedAmount: number): Promise<boolean> {
    const { error } = await supabase.rpc('transition_insurance_claim_atomic', { p_claim_id: id, p_target_status: 'approved', p_approved_amount: approvedAmount });
    if (error) { logError('Error transitioning insurance claim:', error); return false; }
    return true;
  },
  /**
   * Reject an insurance claim
   */
  async rejectInsuranceClaim(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_insurance_claim_atomic', { p_claim_id: id, p_target_status: 'rejected', p_approved_amount: null });
    if (error) { logError('Error transitioning insurance claim:', error); return false; }
    return true;
  },
  /**
   * Mark a claim as paid
   */
  async markClaimAsPaid(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_insurance_claim_atomic', { p_claim_id: id, p_target_status: 'paid', p_approved_amount: null });
    if (error) { logError('Error transitioning insurance claim:', error); return false; }
    return true;
  }
};
