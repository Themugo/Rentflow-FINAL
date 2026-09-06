import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';

// Types for Utility Providers
export interface UtilityProvider {
  id: string;
  name: string;
  type: 'electricity' | 'water' | 'gas' | 'internet' | 'waste';
  rating: number;
  reviewCount: number;
  totalConnections: number;
  activeConnections: number;
  location: string;
  rateRange: string;
  coverageArea: string;
  averageResponseTime: string;
  verified: boolean;
  services: string[];
}

export interface UtilityConnection {
  id: string;
  providerId: string;
  providerName: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  utilityType: string;
  connectionType: string;
  status: 'active' | 'pending' | 'disconnected' | 'suspended';
  connectionDate: Date;
  monthlyRate: number;
  currentReading: number;
  previousReading: number;
  lastBillingDate: Date | null;
  nextBillingDate: Date | null;
}

export interface UtilityBill {
  id: string;
  connectionId: string;
  providerId: string;
  providerName: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  utilityType: string;
  billingPeriod: string;
  consumption: number;
  rate: number;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'disputed';
  dueDate: Date;
  paidDate?: Date;
  generatedDate: Date;
}

export interface ProviderPerformance {
  providerId: string;
  providerName: string;
  reliability: number;
  averageResponseTime: string;
  customerSatisfaction: number;
  totalConnections: number;
  outageRate: number;
  resolutionTime: string;
}

// Utility Providers API Service
export const utilityProvidersService = {
  /**
   * Fetch all utility providers with optional filtering
   */
  async getUtilityProviders(filters?: {
    type?: string;
    location?: string;
  }): Promise<UtilityProvider[]> {
    let query = supabase
      .from('utility_providers')
      .select('*');

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    const { data, error } = await query;

    if (error) {
      logError('Error fetching utility providers:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Fetch a single utility provider by ID
   */
  async getUtilityProviderById(id: string): Promise<UtilityProvider | null> {
    const { data, error } = await supabase
      .from('utility_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logError('Error fetching utility provider:', error);
      return null;
    }

    return data;
  },

  /**
   * Fetch all utility connections with optional filtering
   */
  async getUtilityConnections(filters?: {
    status?: string;
    providerId?: string;
    propertyId?: string;
  }): Promise<UtilityConnection[]> {
    let query = supabase
      .from('utility_connections')
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

    const { data, error } = await query.order('connection_date', { ascending: false });

    if (error) {
      logError('Error fetching utility connections:', error);
      return [];
    }

    return (data || []).map(conn => ({
      ...conn,
      providerId: conn.provider_id,
      propertyId: conn.property_id,
      connectionDate: new Date(conn.connection_date),
      lastBillingDate: conn.last_billing_date ? new Date(conn.last_billing_date) : null,
      nextBillingDate: conn.next_billing_date ? new Date(conn.next_billing_date) : null,
    }));
  },

  /**
   * Create a new utility connection
   */
  async createUtilityConnection(connection: Omit<UtilityConnection, 'id'>): Promise<UtilityConnection | null> {
    const { data, error } = await supabase.rpc('save_utility_connection_atomic', { p_id: null, p_payload: { provider_id: connection.providerId, property_id: connection.propertyId, unit: connection.unit, utility_type: connection.utilityType, connection_type: connection.connectionType, status: connection.status, connection_date: connection.connectionDate.toISOString(), monthly_rate: connection.monthlyRate, current_reading: connection.currentReading, previous_reading: connection.previousReading, last_billing_date: connection.lastBillingDate?.toISOString(), next_billing_date: connection.nextBillingDate?.toISOString() } });

    if (error) {
      logError('Error creating utility connection:', error);
      return null;
    }

    return data ? {
      ...data,
      providerId: data.provider_id,
      propertyId: data.property_id,
      connectionDate: new Date(data.connection_date),
      lastBillingDate: data.last_billing_date ? new Date(data.last_billing_date) : null,
      nextBillingDate: data.next_billing_date ? new Date(data.next_billing_date) : null,
    } : null;
  },

  /**
   * Update a utility connection
   */
  async updateUtilityConnection(id: string, updates: Partial<UtilityConnection>): Promise<UtilityConnection | null> {
    const { data, error } = await supabase.rpc('save_utility_connection_atomic', { p_id: id, p_payload: { status: updates.status, current_reading: updates.currentReading, previous_reading: updates.previousReading, last_billing_date: updates.lastBillingDate?.toISOString(), next_billing_date: updates.nextBillingDate?.toISOString() } });

    if (error) {
      logError('Error updating utility connection:', error);
      return null;
    }

    return data ? {
      ...data,
      providerId: data.provider_id,
      propertyId: data.property_id,
      connectionDate: new Date(data.connection_date),
      lastBillingDate: data.last_billing_date ? new Date(data.last_billing_date) : null,
      nextBillingDate: data.next_billing_date ? new Date(data.next_billing_date) : null,
    } : null;
  },

  /**
   * Fetch utility bills with optional filtering
   */
  async getUtilityBills(filters?: {
    status?: string;
    providerId?: string;
    connectionId?: string;
  }): Promise<UtilityBill[]> {
    let query = supabase
      .from('utility_bills')
      .select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.providerId) {
      query = query.eq('provider_id', filters.providerId);
    }
    if (filters?.connectionId) {
      query = query.eq('connection_id', filters.connectionId);
    }

    const { data, error } = await query.order('generated_date', { ascending: false });

    if (error) {
      logError('Error fetching utility bills:', error);
      return [];
    }

    return (data || []).map(bill => ({
      ...bill,
      connectionId: bill.connection_id,
      providerId: bill.provider_id,
      propertyId: bill.property_id,
      dueDate: new Date(bill.due_date),
      paidDate: bill.paid_date ? new Date(bill.paid_date) : undefined,
      generatedDate: new Date(bill.generated_date),
    }));
  },

  /**
   * Create a new utility bill
   */
  async createUtilityBill(bill: Omit<UtilityBill, 'id' | 'generatedDate'>): Promise<UtilityBill | null> {
    const { data, error } = await supabase.rpc('save_utility_bill_atomic', { p_id: null, p_payload: { connection_id: bill.connectionId, provider_id: bill.providerId, property_id: bill.propertyId, unit: bill.unit, utility_type: bill.utilityType, billing_period: bill.billingPeriod, consumption: bill.consumption, rate: bill.rate, amount: bill.amount, status: bill.status, due_date: bill.dueDate.toISOString(), paid_date: bill.paidDate?.toISOString() } });

    if (error) {
      logError('Error creating utility bill:', error);
      return null;
    }

    return data ? {
      ...data,
      connectionId: data.connection_id,
      providerId: data.provider_id,
      propertyId: data.property_id,
      dueDate: new Date(data.due_date),
      paidDate: data.paid_date ? new Date(data.paid_date) : undefined,
      generatedDate: new Date(data.generated_date),
    } : null;
  },

  /**
   * Update a utility bill
   */
  async updateUtilityBill(id: string, updates: Partial<UtilityBill>): Promise<UtilityBill | null> {
    const { data, error } = await supabase.rpc('save_utility_bill_atomic', { p_id: id, p_payload: { status: updates.status, paid_date: updates.paidDate?.toISOString() } });

    if (error) {
      logError('Error updating utility bill:', error);
      return null;
    }

    return data ? {
      ...data,
      connectionId: data.connection_id,
      providerId: data.provider_id,
      propertyId: data.property_id,
      dueDate: new Date(data.due_date),
      paidDate: data.paid_date ? new Date(data.paid_date) : undefined,
      generatedDate: new Date(data.generated_date),
    } : null;
  },

  /**
   * Get provider performance metrics
   */
  async getProviderPerformance(providerId: string): Promise<ProviderPerformance | null> {
    const { data, error } = await supabase
      .from('utility_providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (error) {
      logError('Error fetching provider performance:', error);
      return null;
    }

    // Fetch connections for this provider
    const { data: connections } = await supabase
      .from('utility_connections')
      .select('*')
      .eq('provider_id', providerId);

    const totalConnections = connections?.length || 0;
    const activeConnections = connections?.filter(c => c.status === 'active').length || 0;

    return {
      providerId: data.id,
      providerName: data.name,
      reliability: 95, // Placeholder - would be calculated from actual data
      averageResponseTime: data.average_response_time,
      customerSatisfaction: data.rating,
      totalConnections,
      outageRate: 2.5, // Placeholder - would be calculated from actual data
      resolutionTime: '24 hours', // Placeholder
    };
  },

  /**
   * Activate a utility connection
   */
  async activateUtilityConnection(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('save_utility_connection_atomic', { p_id: id, p_payload: { status: 'active' } });

    if (error) {
      logError('Error activating utility connection:', error);
      return false;
    }

    return true;
  },

  /**
   * Mark a utility bill as paid
   */
  async markBillAsPaid(id: string): Promise<boolean> {
    const { error } = await supabase.rpc('save_utility_bill_atomic', { p_id: id, p_payload: { status: 'paid', paid_date: new Date().toISOString() } });

    if (error) {
      logError('Error marking bill as paid:', error);
      return false;
    }

    return true;
  },
};
