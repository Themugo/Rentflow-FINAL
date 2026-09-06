import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';

// Types for Contractor Marketplace
export interface Contractor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  availability: 'available' | 'busy' | 'unavailable';
  verified: boolean;
  certified: boolean;
  responseTime: string;
  location: string;
  totalJobs: number;
  completedJobs: number;
}

export interface WorkOrder {
  id: string;
  contractorId: string | null;
  contractorName: string | null;
  propertyId: string;
  propertyName: string;
  unit: string;
  category: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  budget: number;
  estimatedCost: number | null;
  actualCost?: number;
  scheduledDate: Date | null;
  completedDate?: Date;
  createdDate: Date;
}

export interface Bid {
  id: string;
  workOrderId: string;
  contractorId: string;
  contractorName: string;
  contractorRating: number;
  proposedAmount: number;
  estimatedDuration: string;
  status: 'pending' | 'accepted' | 'rejected';
  submittedDate: Date;
  notes?: string;
}

export interface ContractorPerformance {
  contractorId: string;
  contractorName: string;
  onTimeCompletion: number;
  qualityScore: number;
  averageResponseTime: string;
  totalJobs: number;
  completedJobs: number;
  customerSatisfaction: number;
}

// Contractor Marketplace API Service
export const contractorMarketplaceService = {
  /**
   * Fetch all contractors with optional filtering
   */
  async getContractors(filters?: {
    specialty?: string;
    availability?: string;
    location?: string;
  }): Promise<Contractor[]> {
    let query = supabase
      .from('contractors')
      .select('*');

    if (filters?.specialty) {
      query = query.eq('specialty', filters.specialty);
    }
    if (filters?.availability) {
      query = query.eq('availability', filters.availability);
    }
    if (filters?.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    const { data, error } = await query;

    if (error) {
      logError('Error fetching contractors:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Fetch a single contractor by ID
   */
  async getContractorById(id: string): Promise<Contractor | null> {
    const { data, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logError('Error fetching contractor:', error);
      return null;
    }

    return data;
  },

  /**
   * Fetch all work orders with optional filtering
   */
  async getWorkOrders(filters?: {
    status?: string;
    priority?: string;
    propertyId?: string;
  }): Promise<WorkOrder[]> {
    let query = supabase
      .from('work_orders')
      .select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.propertyId) {
      query = query.eq('property_id', filters.propertyId);
    }

    const { data, error } = await query.order('created_date', { ascending: false });

    if (error) {
      logError('Error fetching work orders:', error);
      return [];
    }

    return (data || []).map(wo => ({
      ...wo,
      scheduledDate: wo.scheduled_date ? new Date(wo.scheduled_date) : null,
      completedDate: wo.completed_date ? new Date(wo.completed_date) : undefined,
      createdDate: new Date(wo.created_date),
    }));
  },

  /**
   * Create a new work order
   */
  async createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'createdDate'>): Promise<WorkOrder | null> {
    const { data, error } = await supabase.rpc('save_work_order_atomic', { p_work_order_id: null, p_contractor_id: workOrder.contractorId,
      p_property_id: workOrder.propertyId, p_unit: workOrder.unit, p_category: workOrder.category, p_description: workOrder.description,
      p_priority: workOrder.priority, p_budget: workOrder.budget, p_estimated_cost: workOrder.estimatedCost,
      p_scheduled_date: workOrder.scheduledDate?.toISOString() ?? null, p_status: workOrder.status });
    if (error) { logError('Error creating work order:', error); return null; }
    return data as any;
  },
  /**
   * Update a work order
   */
  async updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | null> {
    const { data, error } = await supabase.rpc('save_work_order_atomic', { p_work_order_id: id, p_contractor_id: updates.contractorId ?? null,
      p_property_id: updates.propertyId ?? null, p_unit: updates.unit ?? null, p_category: updates.category ?? null,
      p_description: updates.description ?? null, p_priority: updates.priority ?? 'medium', p_budget: updates.budget ?? 0,
      p_estimated_cost: updates.estimatedCost ?? 0, p_scheduled_date: updates.scheduledDate?.toISOString() ?? null,
      p_status: updates.status ?? 'pending' });
    if (error) { logError('Error updating work order:', error); return null; }
    return data as any;
  },
  /**
   * Fetch bids for a specific work order
   */
  async getBidsForWorkOrder(workOrderId: string): Promise<Bid[]> {
    const { data, error } = await supabase
      .from('contractor_bids')
      .select('*')
      .eq('work_order_id', workOrderId);

    if (error) {
      logError('Error fetching bids:', error);
      return [];
    }

    return (data || []).map(bid => ({
      ...bid,
      workOrderId: bid.work_order_id,
      contractorId: bid.contractor_id,
      submittedDate: new Date(bid.submitted_date),
    }));
  },

  /**
   * Create a new bid
   */
  async createBid(bid: Omit<Bid, 'id' | 'submittedDate'>): Promise<Bid | null> {
    const { data, error } = await supabase.rpc('create_contractor_bid_atomic', { p_work_order_id: bid.workOrderId,
      p_contractor_id: bid.contractorId, p_proposed_amount: bid.proposedAmount,
      p_estimated_duration: bid.estimatedDuration, p_notes: bid.notes ?? null });
    if (error) { logError('Error creating bid:', error); return null; }
    return data as any;
  },
  /**
   * Get contractor performance metrics
   */
  async getContractorPerformance(contractorId: string): Promise<ContractorPerformance | null> {
    // This would typically be a computed view or RPC call
    // For now, we'll fetch the contractor and calculate basic metrics
    const { data: contractor, error } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', contractorId)
      .single();

    if (error) {
      logError('Error fetching contractor performance:', error);
      return null;
    }

    // Fetch completed work orders for this contractor
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('*')
      .eq('contractor_id', contractorId)
      .eq('status', 'completed');

    const totalJobs = workOrders?.length || 0;

    return {
      contractorId: contractor.id,
      contractorName: contractor.name,
      onTimeCompletion: 85, // Placeholder - would be calculated from actual data
      qualityScore: contractor.rating,
      averageResponseTime: contractor.responseTime,
      totalJobs: contractor.totalJobs,
      completedJobs: totalJobs,
      customerSatisfaction: contractor.rating,
    };
  },

  /**
   * Accept a bid for a work order
   */
  async acceptBid(bidId: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_contractor_bid_atomic', { p_bid_id: bidId, p_target_status: 'accepted' });
    if (error) { logError('Error transitioning bid:', error); return false; }
    return true;
  },
  /**
   * Reject a bid for a work order
   */
  async rejectBid(bidId: string): Promise<boolean> {
    const { error } = await supabase.rpc('transition_contractor_bid_atomic', { p_bid_id: bidId, p_target_status: 'rejected' });
    if (error) { logError('Error transitioning bid:', error); return false; }
    return true;
  }
};
