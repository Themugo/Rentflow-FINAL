/**
 * Generated types plus hand-patched RPCs that exist in migrations
 * but are not yet in `supabase gen types` output (landlord finance, dashboard, log_activity).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_activations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          admin_level: Database["public"]["Enums"]["admin_level"]
          can_create_webhosts: boolean
          can_manage_billing: boolean
          can_manage_managers: boolean
          can_manage_properties: boolean
          can_view_activity_logs: boolean
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_level?: Database["public"]["Enums"]["admin_level"]
          can_create_webhosts?: boolean
          can_manage_billing?: boolean
          can_manage_managers?: boolean
          can_manage_properties?: boolean
          can_view_activity_logs?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_level?: Database["public"]["Enums"]["admin_level"]
          can_create_webhosts?: boolean
          can_manage_billing?: boolean
          can_manage_managers?: boolean
          can_manage_properties?: boolean
          can_view_activity_logs?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          manager_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          manager_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          manager_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bank_details: {
        Row: {
          account_label: string | null
          account_name: string
          account_number: string
          bank_name: string
          branch_name: string | null
          created_at: string
          id: string
          is_default: boolean | null
          manager_id: string
          paybill_number: string | null
          property_id: string | null
          swift_code: string | null
          till_number: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          account_name: string
          account_number: string
          bank_name: string
          branch_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          manager_id: string
          paybill_number?: string | null
          property_id?: string | null
          swift_code?: string | null
          till_number?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          account_name?: string
          account_number?: string
          bank_name?: string
          branch_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          manager_id?: string
          paybill_number?: string | null
          property_id?: string | null
          swift_code?: string | null
          till_number?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_details_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          manager_user_id: string | null
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
          brand_primary_hex: string | null
          white_label_enabled: boolean
          brand_config: Json
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          manager_user_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
          brand_primary_hex?: string | null
          white_label_enabled?: boolean
          brand_config?: Json
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          manager_user_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
          brand_primary_hex?: string | null
          white_label_enabled?: boolean
          brand_config?: Json
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          manager_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          manager_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          manager_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_confirmed_at: string | null
          deletion_confirmed_by: string | null
          deletion_reason: string | null
          id: string
          lease_id: string | null
          manager_signature: string | null
          manager_signed_at: string | null
          pending_approval: boolean
          property_id: string | null
          rejection_reason: string | null
          status: string
          template_id: string | null
          tenant_id: string | null
          tenant_ip_address: string | null
          tenant_signature: string | null
          tenant_signed_at: string | null
          title: string
          unit_id: string | null
          updated_at: string
          uploaded_contract_url: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_confirmed_at?: string | null
          deletion_confirmed_by?: string | null
          deletion_reason?: string | null
          id?: string
          lease_id?: string | null
          manager_signature?: string | null
          manager_signed_at?: string | null
          pending_approval?: boolean
          property_id?: string | null
          rejection_reason?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          tenant_ip_address?: string | null
          tenant_signature?: string | null
          tenant_signed_at?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
          uploaded_contract_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_confirmed_at?: string | null
          deletion_confirmed_by?: string | null
          deletion_reason?: string | null
          id?: string
          lease_id?: string | null
          manager_signature?: string | null
          manager_signed_at?: string | null
          pending_approval?: boolean
          property_id?: string | null
          rejection_reason?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          tenant_ip_address?: string | null
          tenant_signature?: string | null
          tenant_signed_at?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
          uploaded_contract_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_deductions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deduction_type: string
          description: string
          id: string
          maintenance_request_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deduction_type?: string
          description: string
          id?: string
          maintenance_request_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deduction_type?: string
          description?: string
          id?: string
          maintenance_request_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_deductions_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_deductions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_refunds: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string
          final_balance: number
          id: string
          move_out_date: string
          mpesa_number: string | null
          notes: string | null
          original_deposit: number
          processed_at: string | null
          processed_by: string | null
          refund_amount: number
          refund_method: string
          refund_reference: string | null
          status: string
          tenant_id: string
          total_deductions: number
          updated_at: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          final_balance: number
          id?: string
          move_out_date: string
          mpesa_number?: string | null
          notes?: string | null
          original_deposit: number
          processed_at?: string | null
          processed_by?: string | null
          refund_amount: number
          refund_method?: string
          refund_reference?: string | null
          status?: string
          tenant_id: string
          total_deductions?: number
          updated_at?: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          final_balance?: number
          id?: string
          move_out_date?: string
          mpesa_number?: string | null
          notes?: string | null
          original_deposit?: number
          processed_at?: string | null
          processed_by?: string | null
          refund_amount?: number
          refund_method?: string
          refund_reference?: string | null
          status?: string
          tenant_id?: string
          total_deductions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenditures: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          manager_id: string
          month: string
          property_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id: string
          month?: string
          property_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string
          month?: string
          property_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenditures_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          lease_id: string | null
          manager_id: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          lease_id?: string | null
          manager_id?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          lease_id?: string | null
          manager_id?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          created_at: string
          deposit: number | null
          document_url: string | null
          end_date: string
          id: string
          monthly_rent: number
          property: string
          property_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          tenant_id: string | null
          terms: string | null
          unit: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit?: number | null
          document_url?: string | null
          end_date: string
          id?: string
          monthly_rent: number
          property: string
          property_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id?: string | null
          terms?: string | null
          unit: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit?: number | null
          document_url?: string | null
          end_date?: string
          id?: string
          monthly_rent?: number
          property?: string
          property_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id?: string | null
          terms?: string | null
          unit?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          assigned_provider_id: string | null
          assigned_to: string | null
          budget: number | null
          category: string | null
          completion_date: string | null
          created_at: string
          created_by_role: string | null
          deduct_from_deposit: boolean | null
          deposit_deducted_at: string | null
          deposit_deduction_amount: number | null
          description: string
          expenditure_amount: number | null
          expenditure_recorded_at: string | null
          expected_completion_date: string | null
          id: string
          manager_id: string | null
          priority: Database["public"]["Enums"]["request_priority"]
          property_name: string
          provider_completed_at: string | null
          provider_notes: string | null
          provider_started_at: string | null
          quoted_amount: number | null
          agreed_amount: number | null
          manager_rating: number | null
          tenant_rating: number | null
          requested_date: string
          status: Database["public"]["Enums"]["request_status"]
          tenant_email: string
          tenant_name: string
          title: string
          unit_id: string | null
          unit_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_provider_id?: string | null
          assigned_to?: string | null
          budget?: number | null
          category?: string | null
          completion_date?: string | null
          created_at?: string
          created_by_role?: string | null
          deduct_from_deposit?: boolean | null
          deposit_deducted_at?: string | null
          deposit_deduction_amount?: number | null
          description: string
          expenditure_amount?: number | null
          expenditure_recorded_at?: string | null
          expected_completion_date?: string | null
          id?: string
          manager_id?: string | null
          priority?: Database["public"]["Enums"]["request_priority"]
          property_name: string
          provider_completed_at?: string | null
          provider_notes?: string | null
          provider_started_at?: string | null
          quoted_amount?: number | null
          agreed_amount?: number | null
          manager_rating?: number | null
          tenant_rating?: number | null
          requested_date?: string
          status?: Database["public"]["Enums"]["request_status"]
          tenant_email: string
          tenant_name: string
          title: string
          unit_id?: string | null
          unit_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_provider_id?: string | null
          assigned_to?: string | null
          budget?: number | null
          category?: string | null
          completion_date?: string | null
          created_at?: string
          created_by_role?: string | null
          deduct_from_deposit?: boolean | null
          deposit_deducted_at?: string | null
          deposit_deduction_amount?: number | null
          description?: string
          expenditure_amount?: number | null
          expenditure_recorded_at?: string | null
          expected_completion_date?: string | null
          id?: string
          manager_id?: string | null
          priority?: Database["public"]["Enums"]["request_priority"]
          property_name?: string
          provider_completed_at?: string | null
          provider_notes?: string | null
          provider_started_at?: string | null
          quoted_amount?: number | null
          agreed_amount?: number | null
          manager_rating?: number | null
          tenant_rating?: number | null
          requested_date?: string
          status?: Database["public"]["Enums"]["request_status"]
          tenant_email?: string
          tenant_name?: string
          title?: string
          unit_id?: string | null
          unit_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_contracts: {
        Row: {
          contract_type: string | null
          created_at: string
          description: string | null
          id: string
          manager_email: string
          manager_name: string | null
          manager_user_id: string
          parsed_content: Json | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signature_url: string | null
          signed_at: string | null
          status: string | null
          title: string
          updated_at: string
          uploaded_contract_url: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          contract_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          manager_email: string
          manager_name?: string | null
          manager_user_id: string
          parsed_content?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string | null
          title: string
          updated_at?: string
          uploaded_contract_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          contract_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          manager_email?: string
          manager_name?: string | null
          manager_user_id?: string
          parsed_content?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          uploaded_contract_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      manager_ewallet_settings: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          is_enabled: boolean
          manager_user_id: string
          property_id: string | null
          provider: string
          unit_id: string | null
          updated_at: string
          wallet_id: string | null
          wallet_name: string | null
          wallet_phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          manager_user_id: string
          property_id?: string | null
          provider?: string
          unit_id?: string | null
          updated_at?: string
          wallet_id?: string | null
          wallet_name?: string | null
          wallet_phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          manager_user_id?: string
          property_id?: string | null
          provider?: string
          unit_id?: string | null
          updated_at?: string
          wallet_id?: string | null
          wallet_name?: string | null
          wallet_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_ewallet_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_ewallet_settings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_payment_transactions: {
        Row: {
          id: string
          manager_invoice_id: string
          manager_user_id: string
          provider: string
          payment_method: string
          reference: string
          provider_session_id: string | null
          provider_payment_intent_id: string | null
          amount: number
          currency: string
          status: string
          failure_reason: string | null
          metadata: Json
          initiated_at: string
          completed_at: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          manager_invoice_id: string
          manager_user_id: string
          provider?: string
          payment_method?: string
          reference: string
          provider_session_id?: string | null
          provider_payment_intent_id?: string | null
          amount: number
          currency?: string
          status?: string
          failure_reason?: string | null
          metadata?: Json
          initiated_at?: string
          completed_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          manager_invoice_id?: string
          manager_user_id?: string
          provider?: string
          payment_method?: string
          reference?: string
          provider_session_id?: string | null
          provider_payment_intent_id?: string | null
          amount?: number
          currency?: string
          status?: string
          failure_reason?: string | null
          metadata?: Json
          initiated_at?: string
          completed_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      manager_invoices: {
        Row: {
          amount: number
          commission_rate: number | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          invoice_type: string | null
          manager_user_id: string
          net_collection: number | null
          paid_date: string | null
          property_count: number | null
          rate_per_property: number | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          invoice_type?: string | null
          manager_user_id: string
          net_collection?: number | null
          paid_date?: string | null
          property_count?: number | null
          rate_per_property?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          invoice_type?: string | null
          manager_user_id?: string
          net_collection?: number | null
          paid_date?: string | null
          property_count?: number | null
          rate_per_property?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      manager_mpesa_settings: {
        Row: {
          consumer_key: string | null
          consumer_secret: string | null
          created_at: string
          id: string
          is_live: boolean
          manager_user_id: string
          paybill_account_reference: string | null
          paybill_enabled: boolean
          paybill_passkey: string | null
          paybill_shortcode: string | null
          property_id: string | null
          till_enabled: boolean
          till_passkey: string | null
          till_shortcode: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          manager_user_id: string
          paybill_account_reference?: string | null
          paybill_enabled?: boolean
          paybill_passkey?: string | null
          paybill_shortcode?: string | null
          property_id?: string | null
          till_enabled?: boolean
          till_passkey?: string | null
          till_shortcode?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          manager_user_id?: string
          paybill_account_reference?: string | null
          paybill_enabled?: boolean
          paybill_passkey?: string | null
          paybill_shortcode?: string | null
          property_id?: string | null
          till_enabled?: boolean
          till_passkey?: string | null
          till_shortcode?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_mpesa_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_mpesa_settings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_submanagers: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          submanager_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          submanager_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          submanager_user_id?: string
        }
        Relationships: []
      }
      manager_subscriptions: {
        Row: {
          amount: number
          created_at: string
          id: string
          manager_user_id: string
          payment_method: string | null
          payment_reference: string | null
          phone_number: string | null
          property_count: number
          status: string
          stripe_subscription_id: string | null
          subscription_end: string | null
          subscription_start: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          manager_user_id: string
          payment_method?: string | null
          payment_reference?: string | null
          phone_number?: string | null
          property_count?: number
          status?: string
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          tier: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          manager_user_id?: string
          payment_method?: string | null
          payment_reference?: string | null
          phone_number?: string | null
          property_count?: number
          status?: string
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string
          receipt_url: string
          reference_number: string | null
          rejection_reason: string | null
          status: string
          tenant_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date: string
          payment_method: string
          receipt_url: string
          reference_number?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_url?: string
          reference_number?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          callback_secret: string | null
          checkout_request_id: string | null
          completed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          initiated_at: string
          invoice_id: string | null
          manager_id: string | null
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          payment_type: string
          phone_number: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          callback_secret?: string | null
          checkout_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          invoice_id?: string | null
          manager_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          payment_type: string
          phone_number: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          callback_secret?: string | null
          checkout_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          invoice_id?: string | null
          manager_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          payment_type?: string
          phone_number?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          currency: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          created_at: string
          house_label_prefix: string | null
          house_number: string | null
          id: string
          image_url: string | null
          manager_id: string | null
          name: string
          number_of_floors: number | null
          occupied: number
          payment_details: string | null
          property_type: string | null
          rent_per_house: number | null
          revenue: number
          status: string
          units: number
          updated_at: string
        }
        Insert: {
          address: string
          agency_id?: string | null
          created_at?: string
          house_label_prefix?: string | null
          house_number?: string | null
          id?: string
          image_url?: string | null
          manager_id?: string | null
          name: string
          number_of_floors?: number | null
          occupied?: number
          payment_details?: string | null
          property_type?: string | null
          rent_per_house?: number | null
          revenue?: number
          status?: string
          units?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          house_label_prefix?: string | null
          house_number?: string | null
          id?: string
          image_url?: string | null
          manager_id?: string | null
          name?: string
          number_of_floors?: number | null
          occupied?: number
          payment_details?: string | null
          property_type?: string | null
          rent_per_house?: number | null
          revenue?: number
          status?: string
          units?: number
          updated_at?: string
        }
        Relationships: []
      }
      property_amenity_charges: {
        Row: {
          amount: number
          charge_label: string
          charge_type: string
          created_at: string
          id: string
          is_active: boolean
          manager_id: string
          property_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          charge_label: string
          charge_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id: string
          property_id: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_label?: string
          charge_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string
          property_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenity_charges_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenity_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_deductions: {
        Row: {
          amount: number
          created_at: string
          deduction_name: string
          deduction_type: string
          id: string
          is_active: boolean
          is_recurring: boolean
          manager_id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deduction_name: string
          deduction_type?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          manager_id: string
          property_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deduction_name?: string
          deduction_type?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          manager_id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_deductions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_history: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          description: string
          details: Json | null
          id: string
          property_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          description: string
          details?: Json | null
          id?: string
          property_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          description?: string
          details?: Json | null
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_settings: {
        Row: {
          auto_send_receipts: boolean
          created_at: string
          footer_message: string | null
          id: string
          include_logo: boolean | null
          manager_user_id: string
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          auto_send_receipts?: boolean
          created_at?: string
          footer_message?: string | null
          id?: string
          include_logo?: boolean | null
          manager_user_id: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          auto_send_receipts?: boolean
          created_at?: string
          footer_message?: string | null
          id?: string
          include_logo?: boolean | null
          manager_user_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      submanager_permissions: {
        Row: {
          can_view_activity_logs: boolean
          can_view_contracts: boolean
          can_view_invoices: boolean
          can_view_leases: boolean
          can_view_maintenance: boolean
          can_view_properties: boolean
          can_view_tenants: boolean
          created_at: string
          id: string
          manager_id: string
          restrict_to_assigned_properties: boolean | null
          submanager_user_id: string
          updated_at: string
        }
        Insert: {
          can_view_activity_logs?: boolean
          can_view_contracts?: boolean
          can_view_invoices?: boolean
          can_view_leases?: boolean
          can_view_maintenance?: boolean
          can_view_properties?: boolean
          can_view_tenants?: boolean
          created_at?: string
          id?: string
          manager_id: string
          restrict_to_assigned_properties?: boolean | null
          submanager_user_id: string
          updated_at?: string
        }
        Update: {
          can_view_activity_logs?: boolean
          can_view_contracts?: boolean
          can_view_invoices?: boolean
          can_view_leases?: boolean
          can_view_maintenance?: boolean
          can_view_properties?: boolean
          can_view_tenants?: boolean
          created_at?: string
          id?: string
          manager_id?: string
          restrict_to_assigned_properties?: boolean | null
          submanager_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      submanager_property_assignments: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          property_id: string
          submanager_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          property_id: string
          submanager_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          property_id?: string
          submanager_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submanager_property_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_history: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          property_id: string | null
          property_name: string
          status: string
          tenant_name: string
          token: string
          unit: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          property_id?: string | null
          property_name: string
          status?: string
          tenant_name: string
          token?: string
          unit?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          property_id?: string | null
          property_name?: string
          status?: string
          tenant_name?: string
          token?: string
          unit?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          account_number: string | null
          created_at: string
          deposit_amount: number | null
          deposit_balance: number | null
          deposit_months: number | null
          email: string
          id: string
          manager_id: string | null
          monthly_rent: number | null
          move_in_date: string | null
          name: string
          other_charges: number | null
          other_charges_description: string | null
          phone: string | null
          photo_url: string | null
          property: string | null
          property_id: string | null
          statement_history_months: number | null
          status: string
          unit: string | null
          unit_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_balance?: number | null
          deposit_months?: number | null
          email: string
          id?: string
          manager_id?: string | null
          monthly_rent?: number | null
          move_in_date?: string | null
          name: string
          other_charges?: number | null
          other_charges_description?: string | null
          phone?: string | null
          photo_url?: string | null
          property?: string | null
          property_id?: string | null
          statement_history_months?: number | null
          status?: string
          unit?: string | null
          unit_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          account_number?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_balance?: number | null
          deposit_months?: number | null
          email?: string
          id?: string
          manager_id?: string | null
          monthly_rent?: number | null
          move_in_date?: string | null
          name?: string
          other_charges?: number | null
          other_charges_description?: string | null
          phone?: string | null
          photo_url?: string | null
          property?: string | null
          property_id?: string | null
          statement_history_months?: number | null
          status?: string
          unit?: string | null
          unit_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_water_config: {
        Row: {
          created_at: string
          flat_rate_override: number | null
          has_meter: boolean
          id: string
          meter_number: string | null
          property_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          flat_rate_override?: number | null
          has_meter?: boolean
          id?: string
          meter_number?: string | null
          property_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          flat_rate_override?: number | null
          has_meter?: boolean
          id?: string
          meter_number?: string | null
          property_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_water_config_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_water_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          description: string | null
          id: string
          monthly_rent: number | null
          property_id: string
          square_feet: number | null
          status: string
          unit_number: string
          updated_at: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          description?: string | null
          id?: string
          monthly_rent?: number | null
          property_id: string
          square_feet?: number | null
          status?: string
          unit_number: string
          updated_at?: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          description?: string | null
          id?: string
          monthly_rent?: number | null
          property_id?: string
          square_feet?: number | null
          status?: string
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          contract_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          manager_id: string
          uploaded_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          manager_id: string
          uploaded_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          manager_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          approval_status: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          approval_status?: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          approval_status?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_notices: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          forwarding_address: string | null
          id: string
          intended_move_out_date: string
          manager_id: string | null
          manager_notes: string | null
          notice_date: string
          phone_number: string | null
          property_id: string | null
          property_name: string
          reason: string | null
          status: string
          tenant_email: string
          tenant_id: string
          tenant_name: string
          tenant_signature: string | null
          tenant_signed_at: string | null
          unit_number: string | null
          updated_at: string
          uploaded_document_url: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          forwarding_address?: string | null
          id?: string
          intended_move_out_date: string
          manager_id?: string | null
          manager_notes?: string | null
          notice_date?: string
          phone_number?: string | null
          property_id?: string | null
          property_name: string
          reason?: string | null
          status?: string
          tenant_email: string
          tenant_id: string
          tenant_name: string
          tenant_signature?: string | null
          tenant_signed_at?: string | null
          unit_number?: string | null
          updated_at?: string
          uploaded_document_url?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          forwarding_address?: string | null
          id?: string
          intended_move_out_date?: string
          manager_id?: string | null
          manager_notes?: string | null
          notice_date?: string
          phone_number?: string | null
          property_id?: string | null
          property_name?: string
          reason?: string | null
          status?: string
          tenant_email?: string
          tenant_id?: string
          tenant_name?: string
          tenant_signature?: string | null
          tenant_signed_at?: string | null
          unit_number?: string | null
          updated_at?: string
          uploaded_document_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacation_notices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_notices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      water_billing_config: {
        Row: {
          billing_cycle_day: number | null
          billing_method: string
          created_at: string
          flat_rate_amount: number | null
          id: string
          invoice_mode: string
          is_active: boolean
          manager_id: string
          meter_number: string | null
          property_id: string
          rate_per_unit: number | null
          updated_at: string
          water_provider: string | null
        }
        Insert: {
          billing_cycle_day?: number | null
          billing_method?: string
          created_at?: string
          flat_rate_amount?: number | null
          id?: string
          invoice_mode?: string
          is_active?: boolean
          manager_id: string
          meter_number?: string | null
          property_id: string
          rate_per_unit?: number | null
          updated_at?: string
          water_provider?: string | null
        }
        Update: {
          billing_cycle_day?: number | null
          billing_method?: string
          created_at?: string
          flat_rate_amount?: number | null
          id?: string
          invoice_mode?: string
          is_active?: boolean
          manager_id?: string
          meter_number?: string | null
          property_id?: string
          rate_per_unit?: number | null
          updated_at?: string
          water_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "water_billing_config_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      water_meter_readings: {
        Row: {
          billing_period_end: string | null
          billing_period_start: string | null
          consumption: number | null
          created_at: string
          current_reading: number
          id: string
          invoice_id: string | null
          manager_id: string
          notes: string | null
          previous_reading: number
          property_id: string
          rate_per_unit: number
          reading_date: string
          status: string
          total_amount: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          consumption?: number | null
          created_at?: string
          current_reading?: number
          id?: string
          invoice_id?: string | null
          manager_id: string
          notes?: string | null
          previous_reading?: number
          property_id: string
          rate_per_unit?: number
          reading_date?: string
          status?: string
          total_amount?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          consumption?: number | null
          created_at?: string
          current_reading?: number
          id?: string
          invoice_id?: string | null
          manager_id?: string
          notes?: string | null
          previous_reading?: number
          property_id?: string
          rate_per_unit?: number
          reading_date?: string
          status?: string
          total_amount?: number | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_meter_readings_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_meter_readings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_meter_readings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      webhost_payment_settings: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_swift_code: string | null
          created_at: string
          id: string
          mpesa_paybill_account: string | null
          mpesa_paybill_number: string | null
          mpesa_phone_number: string | null
          mpesa_till_number: string | null
          payment_instructions: string | null
          registration_fee: number
          subscription_rate: number
          updated_at: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
          created_at?: string
          id?: string
          mpesa_paybill_account?: string | null
          mpesa_paybill_number?: string | null
          mpesa_phone_number?: string | null
          mpesa_till_number?: string | null
          payment_instructions?: string | null
          registration_fee?: number
          subscription_rate?: number
          updated_at?: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
          created_at?: string
          id?: string
          mpesa_paybill_account?: string | null
          mpesa_paybill_number?: string | null
          mpesa_phone_number?: string | null
          mpesa_till_number?: string | null
          payment_instructions?: string | null
          registration_fee?: number
          subscription_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          id: string | null
          agency_id: string
          manager_id: string
          member_user_id: string
          role_in_agency: string
          joined_at: string
          is_active: boolean
        }
        Insert: {
          id?: string | null
          agency_id: string
          manager_id: string
          member_user_id: string
          role_in_agency?: string
          joined_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string | null
          agency_id?: string
          manager_id?: string
          member_user_id?: string
          role_in_agency?: string
          joined_at?: string
          is_active?: boolean
        }
      }
      arrears_schedule: {
        Row: {
          id: string | null
          tenant_id: string
          manager_id: string | null
          invoice_id: string | null
          total_owed: number
          instalment_count: number
          instalment_amount: number
          paid_count: number
          total_paid: number
          status: string
          start_date: string
          next_due_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          manager_id?: string | null
          invoice_id?: string | null
          total_owed: number
          instalment_count: number
          instalment_amount: number
          paid_count?: number
          total_paid?: number
          status?: string
          start_date?: string
          next_due_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          manager_id?: string | null
          invoice_id?: string | null
          total_owed?: number
          instalment_count?: number
          instalment_amount?: number
          paid_count?: number
          total_paid?: number
          status?: string
          start_date?: string
          next_due_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bank_integration_settings: {
        Row: {
          id: string | null
          manager_id: string
          property_id: string | null
          bank_name: string
          account_number: string | null
          account_name: string | null
          paybill_number: string | null
          bank_code: string | null
          branch_code: string | null
          api_key_encrypted: string | null
          webhook_secret: string | null
          is_active: boolean
          auto_reconcile: boolean
          match_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          manager_id: string
          property_id?: string | null
          bank_name: string
          account_number?: string | null
          account_name?: string | null
          paybill_number?: string | null
          bank_code?: string | null
          branch_code?: string | null
          api_key_encrypted?: string | null
          webhook_secret?: string | null
          is_active?: boolean
          auto_reconcile?: boolean
          match_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          manager_id?: string
          property_id?: string | null
          bank_name?: string
          account_number?: string | null
          account_name?: string | null
          paybill_number?: string | null
          bank_code?: string | null
          branch_code?: string | null
          api_key_encrypted?: string | null
          webhook_secret?: string | null
          is_active?: boolean
          auto_reconcile?: boolean
          match_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      bank_transactions: {
        Row: {
          id: string | null
          manager_id: string
          bank_integration_id: string | null
          external_id: string | null
          reference: string | null
          description: string | null
          amount: number
          transaction_date: string
          bank_name: string | null
          account_number: string | null
          payer_name: string | null
          payer_phone: string | null
          matched: boolean
          matched_invoice_id: string | null
          matched_tenant_id: string | null
          match_confidence: number | null
          match_method: string | null
          source: string
          raw_payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string | null
          manager_id: string
          bank_integration_id?: string | null
          external_id?: string | null
          reference?: string | null
          description?: string | null
          amount: number
          transaction_date: string
          bank_name?: string | null
          account_number?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          matched?: boolean
          matched_invoice_id?: string | null
          matched_tenant_id?: string | null
          match_confidence?: number | null
          match_method?: string | null
          source?: string
          raw_payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string | null
          manager_id?: string
          bank_integration_id?: string | null
          external_id?: string | null
          reference?: string | null
          description?: string | null
          amount?: number
          transaction_date?: string
          bank_name?: string | null
          account_number?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          matched?: boolean
          matched_invoice_id?: string | null
          matched_tenant_id?: string | null
          match_confidence?: number | null
          match_method?: string | null
          source?: string
          raw_payload?: Json | null
          created_at?: string
        }
      }
      broadcast_campaigns: {
        Row: {
          id: string | null
          manager_id: string
          property_id: string | null
          name: string
          subject: string | null
          body: string
          message_type: string
          audience_type: string
          audience_filter: Json | null
          send_sms: boolean | null
          send_email: boolean | null
          send_whatsapp: boolean | null
          send_push: boolean | null
          send_app: boolean | null
          total_recipients: number | null
          sms_sent: number | null
          sms_failed: number | null
          email_sent: number | null
          email_failed: number | null
          whatsapp_sent: number | null
          push_sent: number | null
          status: string
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          manager_id: string
          property_id?: string | null
          name: string
          subject?: string | null
          body: string
          message_type?: string
          audience_type?: string
          audience_filter?: Json | null
          send_sms?: boolean | null
          send_email?: boolean | null
          send_whatsapp?: boolean | null
          send_push?: boolean | null
          send_app?: boolean | null
          total_recipients?: number | null
          sms_sent?: number | null
          sms_failed?: number | null
          email_sent?: number | null
          email_failed?: number | null
          whatsapp_sent?: number | null
          push_sent?: number | null
          status?: string
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          manager_id?: string
          property_id?: string | null
          name?: string
          subject?: string | null
          body?: string
          message_type?: string
          audience_type?: string
          audience_filter?: Json | null
          send_sms?: boolean | null
          send_email?: boolean | null
          send_whatsapp?: boolean | null
          send_push?: boolean | null
          send_app?: boolean | null
          total_recipients?: number | null
          sms_sent?: number | null
          sms_failed?: number | null
          email_sent?: number | null
          email_failed?: number | null
          whatsapp_sent?: number | null
          push_sent?: number | null
          status?: string
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      in_app_notifications: {
        Row: {
          id: string | null
          user_id: string
          manager_id: string | null
          title: string
          body: string
          type: string
          action_url: string | null
          action_label: string | null
          reference_id: string | null
          reference_type: string | null
          is_read: boolean
          read_at: string | null
          is_dismissed: boolean
          dismissed_at: string | null
          source: string | null
          priority: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id: string
          manager_id?: string | null
          title: string
          body: string
          type?: string
          action_url?: string | null
          action_label?: string | null
          reference_id?: string | null
          reference_type?: string | null
          is_read?: boolean
          read_at?: string | null
          is_dismissed?: boolean
          dismissed_at?: string | null
          source?: string | null
          priority?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string
          manager_id?: string | null
          title?: string
          body?: string
          type?: string
          action_url?: string | null
          action_label?: string | null
          reference_id?: string | null
          reference_type?: string | null
          is_read?: boolean
          read_at?: string | null
          is_dismissed?: boolean
          dismissed_at?: string | null
          source?: string | null
          priority?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
      kenya_water_companies: {
        Row: {
          id: string | null
          county: string
          county_code: number
          company_name: string
          short_code: string
          paybill_number: string | null
          domestic_rate: number | null
          min_charge: number | null
          standing_charge: number | null
          sewerage_pct: number | null
          block_tariff: Json | null
          website: string | null
          phone: string | null
          active: boolean | null
        }
        Insert: {
          id?: string | null
          county: string
          county_code: number
          company_name: string
          short_code: string
          paybill_number?: string | null
          domestic_rate?: number | null
          min_charge?: number | null
          standing_charge?: number | null
          sewerage_pct?: number | null
          block_tariff?: Json | null
          website?: string | null
          phone?: string | null
          active?: boolean | null
        }
        Update: {
          id?: string | null
          county?: string
          county_code?: number
          company_name?: string
          short_code?: string
          paybill_number?: string | null
          domestic_rate?: number | null
          min_charge?: number | null
          standing_charge?: number | null
          sewerage_pct?: number | null
          block_tariff?: Json | null
          website?: string | null
          phone?: string | null
          active?: boolean | null
        }
      }
      landlord_bank_details: {
        Row: {
          id: string | null
          landlord_user_id: string
          mpesa_number: string | null
          mpesa_name: string | null
          bank_name: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          bank_branch: string | null
          bank_code: string | null
          swift_code: string | null
          preferred_method: string
          minimum_payout: number | null
          auto_request: boolean | null
          auto_request_day: number | null
          kra_pin: string | null
          vat_registered: boolean | null
          vat_number: string | null
          verified: boolean | null
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          landlord_user_id: string
          mpesa_number?: string | null
          mpesa_name?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          bank_branch?: string | null
          bank_code?: string | null
          swift_code?: string | null
          preferred_method?: string
          minimum_payout?: number | null
          auto_request?: boolean | null
          auto_request_day?: number | null
          kra_pin?: string | null
          vat_registered?: boolean | null
          vat_number?: string | null
          verified?: boolean | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          landlord_user_id?: string
          mpesa_number?: string | null
          mpesa_name?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          bank_branch?: string | null
          bank_code?: string | null
          swift_code?: string | null
          preferred_method?: string
          minimum_payout?: number | null
          auto_request?: boolean | null
          auto_request_day?: number | null
          kra_pin?: string | null
          vat_registered?: boolean | null
          vat_number?: string | null
          verified?: boolean | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      landlord_documents: {
        Row: {
          id: string | null
          landlord_user_id: string
          manager_id: string | null
          property_id: string | null
          unit_id: string | null
          document_type: string
          title: string
          description: string | null
          document_url: string | null
          period_start: string | null
          period_end: string | null
          is_visible: boolean | null
          created_at: string
        }
        Insert: {
          id?: string | null
          landlord_user_id: string
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          document_type: string
          title: string
          description?: string | null
          document_url?: string | null
          period_start?: string | null
          period_end?: string | null
          is_visible?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string | null
          landlord_user_id?: string
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          document_type?: string
          title?: string
          description?: string | null
          document_url?: string | null
          period_start?: string | null
          period_end?: string | null
          is_visible?: boolean | null
          created_at?: string
        }
      }
      landlord_invitations: {
        Row: {
          id: string | null
          property_id: string
          manager_id: string
          email: string
          token: string
          status: string
          expires_at: string
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string | null
          property_id: string
          manager_id: string
          email: string
          token?: string
          status?: string
          expires_at?: string
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string | null
          property_id?: string
          manager_id?: string
          email?: string
          token?: string
          status?: string
          expires_at?: string
          created_at?: string
          accepted_at?: string | null
        }
      }
      landlord_invoices: {
        Row: {
          id: string | null
          landlord_user_id: string
          webhost_user_id: string | null
          invoice_number: string
          invoice_type: string
          amount: number
          description: string | null
          status: string
          due_date: string
          paid_date: string | null
          payment_method: string | null
          payment_reference: string | null
          period_start: string | null
          period_end: string | null
          manager_user_id: string | null
          property_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          landlord_user_id: string
          webhost_user_id?: string | null
          invoice_number: string
          invoice_type?: string
          amount: number
          description?: string | null
          status?: string
          due_date: string
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_start?: string | null
          period_end?: string | null
          manager_user_id?: string | null
          property_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          landlord_user_id?: string
          webhost_user_id?: string | null
          invoice_number?: string
          invoice_type?: string
          amount?: number
          description?: string | null
          status?: string
          due_date?: string
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_start?: string | null
          period_end?: string | null
          manager_user_id?: string | null
          property_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      landlord_messages: {
        Row: {
          id: string | null
          property_id: string | null
          sender_id: string
          sender_role: string
          recipient_id: string
          subject: string | null
          body: string
          is_read: boolean | null
          read_at: string | null
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          property_id?: string | null
          sender_id: string
          sender_role: string
          recipient_id: string
          subject?: string | null
          body: string
          is_read?: boolean | null
          read_at?: string | null
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          property_id?: string | null
          sender_id?: string
          sender_role?: string
          recipient_id?: string
          subject?: string | null
          body?: string
          is_read?: boolean | null
          read_at?: string | null
          parent_id?: string | null
          created_at?: string
        }
      }
      landlord_notification_preferences: {
        Row: {
          id: string | null
          landlord_user_id: string
          email_enabled: boolean | null
          sms_enabled: boolean | null
          whatsapp_enabled: boolean | null
          payout_approved: boolean | null
          payout_paid: boolean | null
          monthly_statement: boolean | null
          new_tenant_moved_in: boolean | null
          tenant_moved_out: boolean | null
          maintenance_completed: boolean | null
          vacancy_alert: boolean | null
          arrears_alert: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          landlord_user_id: string
          email_enabled?: boolean | null
          sms_enabled?: boolean | null
          whatsapp_enabled?: boolean | null
          payout_approved?: boolean | null
          payout_paid?: boolean | null
          monthly_statement?: boolean | null
          new_tenant_moved_in?: boolean | null
          tenant_moved_out?: boolean | null
          maintenance_completed?: boolean | null
          vacancy_alert?: boolean | null
          arrears_alert?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          landlord_user_id?: string
          email_enabled?: boolean | null
          sms_enabled?: boolean | null
          whatsapp_enabled?: boolean | null
          payout_approved?: boolean | null
          payout_paid?: boolean | null
          monthly_statement?: boolean | null
          new_tenant_moved_in?: boolean | null
          tenant_moved_out?: boolean | null
          maintenance_completed?: boolean | null
          vacancy_alert?: boolean | null
          arrears_alert?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      manager_profiles: {
        Row: {
          id: string | null
          manager_user_id: string
          agency_id: string | null
          status: string
          approval_notes: string | null
          rejection_reason: string | null
          suspension_reason: string | null
          suspended_at: string | null
          suspended_by: string | null
          approved_at: string | null
          approved_by: string | null
          subscription_tier: string
          max_properties: number
          max_units: number
          billing_day: number
          platform_rate: number
          billing_method: string
          property_count: number
          unit_count: number
          tenant_count: number
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          manager_user_id: string
          agency_id?: string | null
          status?: string
          approval_notes?: string | null
          rejection_reason?: string | null
          suspension_reason?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          subscription_tier?: string
          max_properties?: number
          max_units?: number
          billing_day?: number
          platform_rate?: number
          billing_method?: string
          property_count?: number
          unit_count?: number
          tenant_count?: number
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          manager_user_id?: string
          agency_id?: string | null
          status?: string
          approval_notes?: string | null
          rejection_reason?: string | null
          suspension_reason?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          subscription_tier?: string
          max_properties?: number
          max_units?: number
          billing_day?: number
          platform_rate?: number
          billing_method?: string
          property_count?: number
          unit_count?: number
          tenant_count?: number
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      manager_status_log: {
        Row: {
          id: string | null
          manager_user_id: string
          changed_by: string | null
          changed_by_role: string | null
          old_status: string | null
          new_status: string
          reason: string | null
          internal_note: string | null
          notify_manager: boolean | null
          created_at: string
        }
        Insert: {
          id?: string | null
          manager_user_id: string
          changed_by?: string | null
          changed_by_role?: string | null
          old_status?: string | null
          new_status: string
          reason?: string | null
          internal_note?: string | null
          notify_manager?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string | null
          manager_user_id?: string
          changed_by?: string | null
          changed_by_role?: string | null
          old_status?: string | null
          new_status?: string
          reason?: string | null
          internal_note?: string | null
          notify_manager?: boolean | null
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string | null
          manager_id: string | null
          property_id: string | null
          unit_id: string | null
          sender_id: string
          sender_role: string
          recipient_type: string
          recipient_id: string | null
          tenant_id: string | null
          subject: string | null
          body: string
          message_type: string
          sent_via_sms: boolean | null
          sent_via_email: boolean | null
          sent_via_whatsapp: boolean | null
          sent_via_push: boolean | null
          sent_via_app: boolean | null
          sms_status: string | null
          email_status: string | null
          whatsapp_status: string | null
          push_status: string | null
          is_read: boolean | null
          read_at: string | null
          parent_message_id: string | null
          campaign_id: string | null
          attachments: string | null
          metadata: Json | null
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          sender_id: string
          sender_role?: string
          recipient_type?: string
          recipient_id?: string | null
          tenant_id?: string | null
          subject?: string | null
          body: string
          message_type?: string
          sent_via_sms?: boolean | null
          sent_via_email?: boolean | null
          sent_via_whatsapp?: boolean | null
          sent_via_push?: boolean | null
          sent_via_app?: boolean | null
          sms_status?: string | null
          email_status?: string | null
          whatsapp_status?: string | null
          push_status?: string | null
          is_read?: boolean | null
          read_at?: string | null
          parent_message_id?: string | null
          campaign_id?: string | null
          attachments?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          sender_id?: string
          sender_role?: string
          recipient_type?: string
          recipient_id?: string | null
          tenant_id?: string | null
          subject?: string | null
          body?: string
          message_type?: string
          sent_via_sms?: boolean | null
          sent_via_email?: boolean | null
          sent_via_whatsapp?: boolean | null
          sent_via_push?: boolean | null
          sent_via_app?: boolean | null
          sms_status?: string | null
          email_status?: string | null
          whatsapp_status?: string | null
          push_status?: string | null
          is_read?: boolean | null
          read_at?: string | null
          parent_message_id?: string | null
          campaign_id?: string | null
          attachments?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
      }
      move_condition_photos: {
        Row: {
          id: string | null
          user_id: string
          tenant_id: string | null
          phase: string
          room: string | null
          photo_url: string
          description: string | null
          condition_rating: string | null
          taken_at: string
          location_note: string | null
          is_disputed: boolean | null
          dispute_note: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id: string
          tenant_id?: string | null
          phase?: string
          room?: string | null
          photo_url: string
          description?: string | null
          condition_rating?: string | null
          taken_at?: string
          location_note?: string | null
          is_disputed?: boolean | null
          dispute_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string
          tenant_id?: string | null
          phase?: string
          room?: string | null
          photo_url?: string
          description?: string | null
          condition_rating?: string | null
          taken_at?: string
          location_note?: string | null
          is_disputed?: boolean | null
          dispute_note?: string | null
          created_at?: string
        }
      }
      orphan_payment_entries: {
        Row: {
          id: string | null
          user_id: string
          record_id: string | null
          payment_date: string
          amount: number
          payment_method: string | null
          reference: string | null
          description: string | null
          receipt_photo: string | null
          is_confirmed: boolean | null
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id: string
          record_id?: string | null
          payment_date?: string
          amount: number
          payment_method?: string | null
          reference?: string | null
          description?: string | null
          receipt_photo?: string | null
          is_confirmed?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string
          record_id?: string | null
          payment_date?: string
          amount?: number
          payment_method?: string | null
          reference?: string | null
          description?: string | null
          receipt_photo?: string | null
          is_confirmed?: boolean | null
          created_at?: string
        }
      }
      orphan_tenant_records: {
        Row: {
          id: string | null
          user_id: string
          property_name: string | null
          unit_label: string | null
          landlord_name: string | null
          landlord_phone: string | null
          county: string | null
          address: string | null
          move_in_date: string | null
          monthly_rent: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          user_id: string
          property_name?: string | null
          unit_label?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          county?: string | null
          address?: string | null
          move_in_date?: string | null
          monthly_rent?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string
          property_name?: string | null
          unit_label?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          county?: string | null
          address?: string | null
          move_in_date?: string | null
          monthly_rent?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      payment_payers: {
        Row: {
          id: string | null
          tenant_id: string
          manager_id: string | null
          property_id: string | null
          unit_id: string | null
          payer_type: string
          payer_name: string | null
          payer_email: string | null
          payer_phone: string | null
          payer_organisation: string | null
          payer_address: string | null
          national_id: string | null
          pays_amount: number | null
          pays_percentage: number | null
          payment_day: number | null
          preferred_method: string | null
          mpesa_number: string | null
          bank_account: string | null
          bank_name: string | null
          standing_order_ref: string | null
          letter_of_undertaking_url: string | null
          contract_url: string | null
          is_active: boolean
          start_date: string | null
          end_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          payer_type?: string
          payer_name?: string | null
          payer_email?: string | null
          payer_phone?: string | null
          payer_organisation?: string | null
          payer_address?: string | null
          national_id?: string | null
          pays_amount?: number | null
          pays_percentage?: number | null
          payment_day?: number | null
          preferred_method?: string | null
          mpesa_number?: string | null
          bank_account?: string | null
          bank_name?: string | null
          standing_order_ref?: string | null
          letter_of_undertaking_url?: string | null
          contract_url?: string | null
          is_active?: boolean
          start_date?: string | null
          end_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          payer_type?: string
          payer_name?: string | null
          payer_email?: string | null
          payer_phone?: string | null
          payer_organisation?: string | null
          payer_address?: string | null
          national_id?: string | null
          pays_amount?: number | null
          pays_percentage?: number | null
          payment_day?: number | null
          preferred_method?: string | null
          mpesa_number?: string | null
          bank_account?: string | null
          bank_name?: string | null
          standing_order_ref?: string | null
          letter_of_undertaking_url?: string | null
          contract_url?: string | null
          is_active?: boolean
          start_date?: string | null
          end_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payout_requests: {
        Row: {
          id: string | null
          property_id: string
          landlord_user_id: string
          manager_id: string | null
          amount: number
          period_start: string
          period_end: string
          notes: string | null
          status: string
          approved_at: string | null
          approved_by: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          property_id: string
          landlord_user_id: string
          manager_id?: string | null
          amount: number
          period_start: string
          period_end: string
          notes?: string | null
          status?: string
          approved_at?: string | null
          approved_by?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          property_id?: string
          landlord_user_id?: string
          manager_id?: string | null
          amount?: number
          period_start?: string
          period_end?: string
          notes?: string | null
          status?: string
          approved_at?: string | null
          approved_by?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      physical_invoices: {
        Row: {
          id: string | null
          manager_id: string
          tenant_id: string | null
          unit_id: string | null
          property_id: string | null
          invoice_number: string
          invoice_date: string
          due_date: string | null
          description: string
          amount: number
          tax_amount: number | null
          total_amount: number
          line_items: Json | null
          status: string
          paid_amount: number | null
          paid_date: string | null
          document_url: string | null
          notes: string | null
          linked_invoice_id: string | null
          recorded_by: string | null
          entered_at: string
          created_at: string
        }
        Insert: {
          id?: string | null
          manager_id: string
          tenant_id?: string | null
          unit_id?: string | null
          property_id?: string | null
          invoice_number: string
          invoice_date?: string
          due_date?: string | null
          description: string
          amount: number
          tax_amount?: number | null
          total_amount: number
          line_items?: Json | null
          status?: string
          paid_amount?: number | null
          paid_date?: string | null
          document_url?: string | null
          notes?: string | null
          linked_invoice_id?: string | null
          recorded_by?: string | null
          entered_at?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          manager_id?: string
          tenant_id?: string | null
          unit_id?: string | null
          property_id?: string | null
          invoice_number?: string
          invoice_date?: string
          due_date?: string | null
          description?: string
          amount?: number
          tax_amount?: number | null
          total_amount?: number
          line_items?: Json | null
          status?: string
          paid_amount?: number | null
          paid_date?: string | null
          document_url?: string | null
          notes?: string | null
          linked_invoice_id?: string | null
          recorded_by?: string | null
          entered_at?: string
          created_at?: string
        }
      }
      physical_receipts: {
        Row: {
          id: string | null
          manager_id: string
          tenant_id: string | null
          unit_id: string | null
          property_id: string | null
          receipt_number: string
          receipt_date: string
          amount: number
          payment_method: string
          reference: string | null
          description: string
          received_by: string | null
          line_items: Json | null
          document_url: string | null
          linked_transaction_id: string | null
          linked_invoice_id: string | null
          digital_receipt_sent: boolean | null
          digital_sent_at: string | null
          sent_via: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          manager_id: string
          tenant_id?: string | null
          unit_id?: string | null
          property_id?: string | null
          receipt_number: string
          receipt_date?: string
          amount: number
          payment_method?: string
          reference?: string | null
          description: string
          received_by?: string | null
          line_items?: Json | null
          document_url?: string | null
          linked_transaction_id?: string | null
          linked_invoice_id?: string | null
          digital_receipt_sent?: boolean | null
          digital_sent_at?: string | null
          sent_via?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          manager_id?: string
          tenant_id?: string | null
          unit_id?: string | null
          property_id?: string | null
          receipt_number?: string
          receipt_date?: string
          amount?: number
          payment_method?: string
          reference?: string | null
          description?: string
          received_by?: string | null
          line_items?: Json | null
          document_url?: string | null
          linked_transaction_id?: string | null
          linked_invoice_id?: string | null
          digital_receipt_sent?: boolean | null
          digital_sent_at?: string | null
          sent_via?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
        }
      }
      property_billing_config: {
        Row: {
          id: string | null
          property_id: string
          manager_id: string
          invoice_mode: string
          due_day_of_month: number
          grace_period_days: number
          late_penalty_enabled: boolean
          late_penalty_type: string | null
          late_penalty_amount: number | null
          late_penalty_pct: number | null
          auto_generate_monthly: boolean
          auto_generate_day: number
          notify_before_days: number
          invoice_prefix: string
          receipt_prefix: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          property_id: string
          manager_id: string
          invoice_mode?: string
          due_day_of_month?: number
          grace_period_days?: number
          late_penalty_enabled?: boolean
          late_penalty_type?: string | null
          late_penalty_amount?: number | null
          late_penalty_pct?: number | null
          auto_generate_monthly?: boolean
          auto_generate_day?: number
          notify_before_days?: number
          invoice_prefix?: string
          receipt_prefix?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          property_id?: string
          manager_id?: string
          invoice_mode?: string
          due_day_of_month?: number
          grace_period_days?: number
          late_penalty_enabled?: boolean
          late_penalty_type?: string | null
          late_penalty_amount?: number | null
          late_penalty_pct?: number | null
          auto_generate_monthly?: boolean
          auto_generate_day?: number
          notify_before_days?: number
          invoice_prefix?: string
          receipt_prefix?: string
          created_at?: string
          updated_at?: string
        }
      }
      property_categories: {
        Row: {
          id: string | null
          key: string
          name: string
          description: string | null
          icon: string | null
          color: string | null
          billing_multiplier: number
          requires_tier: string | null
          is_active: boolean
          display_order: number
        }
        Insert: {
          id?: string | null
          key: string
          name: string
          description?: string | null
          icon?: string | null
          color?: string | null
          billing_multiplier?: number
          requires_tier?: string | null
          is_active?: boolean
          display_order?: number
        }
        Update: {
          id?: string | null
          key?: string
          name?: string
          description?: string | null
          icon?: string | null
          color?: string | null
          billing_multiplier?: number
          requires_tier?: string | null
          is_active?: boolean
          display_order?: number
        }
      }
      property_landlords: {
        Row: {
          id: string | null
          property_id: string
          landlord_user_id: string
          manager_id: string | null
          revenue_share_pct: number
          notes: string | null
          assigned_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          property_id: string
          landlord_user_id: string
          manager_id?: string | null
          revenue_share_pct?: number
          notes?: string | null
          assigned_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          property_id?: string
          landlord_user_id?: string
          manager_id?: string | null
          revenue_share_pct?: number
          notes?: string | null
          assigned_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      property_tier_limits: {
        Row: {
          id: string | null
          tier_key: string
          category_group: string
          max_properties: number
          price_multiplier: number
        }
        Insert: {
          id?: string | null
          tier_key: string
          category_group: string
          max_properties?: number
          price_multiplier?: number
        }
        Update: {
          id?: string | null
          tier_key?: string
          category_group?: string
          max_properties?: number
          price_multiplier?: number
        }
      }
      provider_services: {
        Row: {
          id: string | null
          provider_id: string
          category_key: string
          rate_type: string
          rate_min: number | null
          rate_max: number | null
          currency: string | null
          rate_notes: string | null
          is_active: boolean
        }
        Insert: {
          id?: string | null
          provider_id: string
          category_key: string
          rate_type?: string
          rate_min?: number | null
          rate_max?: number | null
          currency?: string | null
          rate_notes?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string | null
          provider_id?: string
          category_key?: string
          rate_type?: string
          rate_min?: number | null
          rate_max?: number | null
          currency?: string | null
          rate_notes?: string | null
          is_active?: boolean
        }
      }
      service_categories: {
        Row: {
          id: string | null
          key: string
          name: string
          description: string | null
          icon: string | null
          group_name: string | null
          display_order: number | null
          is_active: boolean
        }
        Insert: {
          id?: string | null
          key: string
          name: string
          description?: string | null
          icon?: string | null
          group_name?: string | null
          display_order?: number | null
          is_active?: boolean
        }
        Update: {
          id?: string | null
          key?: string
          name?: string
          description?: string | null
          icon?: string | null
          group_name?: string | null
          display_order?: number | null
          is_active?: boolean
        }
      }
      service_providers: {
        Row: {
          id: string | null
          user_id: string | null
          business_name: string
          contact_name: string | null
          phone: string | null
          whatsapp: string | null
          email: string | null
          profile_photo: string | null
          bio: string | null
          years_experience: number | null
          county: string | null
          town: string | null
          service_radius_km: number | null
          is_verified: boolean
          verified_by: string | null
          verified_at: string | null
          id_number: string | null
          kra_pin: string | null
          registration_no: string | null
          is_available: boolean
          response_time_hrs: number | null
          rating_avg: number | null
          rating_count: number | null
          jobs_completed: number | null
          added_by: string | null
          added_by_role: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          business_name: string
          contact_name?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          profile_photo?: string | null
          bio?: string | null
          years_experience?: number | null
          county?: string | null
          town?: string | null
          service_radius_km?: number | null
          is_verified?: boolean
          verified_by?: string | null
          verified_at?: string | null
          id_number?: string | null
          kra_pin?: string | null
          registration_no?: string | null
          is_available?: boolean
          response_time_hrs?: number | null
          rating_avg?: number | null
          rating_count?: number | null
          jobs_completed?: number | null
          added_by?: string | null
          added_by_role?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string | null
          business_name?: string
          contact_name?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          profile_photo?: string | null
          bio?: string | null
          years_experience?: number | null
          county?: string | null
          town?: string | null
          service_radius_km?: number | null
          is_verified?: boolean
          verified_by?: string | null
          verified_at?: string | null
          id_number?: string | null
          kra_pin?: string | null
          registration_no?: string | null
          is_available?: boolean
          response_time_hrs?: number | null
          rating_avg?: number | null
          rating_count?: number | null
          jobs_completed?: number | null
          added_by?: string | null
          added_by_role?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      subscription_tiers: {
        Row: {
          id: string | null
          tier_key: string
          name: string
          description: string | null
          max_properties: number
          max_units: number
          price_per_property: number
          price_flat: number | null
          features: Json | null
          is_active: boolean
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string | null
          tier_key: string
          name: string
          description?: string | null
          max_properties: number
          max_units: number
          price_per_property?: number
          price_flat?: number | null
          features?: Json | null
          is_active?: boolean
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string | null
          tier_key?: string
          name?: string
          description?: string | null
          max_properties?: number
          max_units?: number
          price_per_property?: number
          price_flat?: number | null
          features?: Json | null
          is_active?: boolean
          display_order?: number
          created_at?: string
        }
      }
      tenant_credit_ledger: {
        Row: {
          id: string | null
          tenant_id: string
          manager_id: string | null
          property_id: string | null
          transaction_id: string | null
          invoice_id: string | null
          entry_type: string
          amount: number
          balance_after: number
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          manager_id?: string | null
          property_id?: string | null
          transaction_id?: string | null
          invoice_id?: string | null
          entry_type: string
          amount: number
          balance_after: number
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          manager_id?: string | null
          property_id?: string | null
          transaction_id?: string | null
          invoice_id?: string | null
          entry_type?: string
          amount?: number
          balance_after?: number
          description?: string | null
          created_at?: string
        }
      }
      tenant_guarantors: {
        Row: {
          id: string | null
          tenant_id: string
          unit_id: string | null
          manager_id: string | null
          name: string
          email: string | null
          phone: string
          national_id: string | null
          relationship: string | null
          employer_name: string | null
          employer_phone: string | null
          address: string | null
          monthly_income: number | null
          guarantee_amount: number | null
          guarantee_type: string | null
          id_document_url: string | null
          letter_url: string | null
          signature_url: string | null
          is_active: boolean
          activated_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          unit_id?: string | null
          manager_id?: string | null
          name: string
          email?: string | null
          phone: string
          national_id?: string | null
          relationship?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          address?: string | null
          monthly_income?: number | null
          guarantee_amount?: number | null
          guarantee_type?: string | null
          id_document_url?: string | null
          letter_url?: string | null
          signature_url?: string | null
          is_active?: boolean
          activated_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          unit_id?: string | null
          manager_id?: string | null
          name?: string
          email?: string | null
          phone?: string
          national_id?: string | null
          relationship?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          address?: string | null
          monthly_income?: number | null
          guarantee_amount?: number | null
          guarantee_type?: string | null
          id_document_url?: string | null
          letter_url?: string | null
          signature_url?: string | null
          is_active?: boolean
          activated_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      tenant_lease_renewal_responses: {
        Row: {
          id: string | null
          tenant_id: string
          tenant_user_id: string
          manager_id: string | null
          lease_id: string | null
          notice_id: string | null
          decision: string
          counter_rent: number | null
          counter_term: number | null
          message: string | null
          signed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          tenant_user_id: string
          manager_id?: string | null
          lease_id?: string | null
          notice_id?: string | null
          decision: string
          counter_rent?: number | null
          counter_term?: number | null
          message?: string | null
          signed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          tenant_user_id?: string
          manager_id?: string | null
          lease_id?: string | null
          notice_id?: string | null
          decision?: string
          counter_rent?: number | null
          counter_term?: number | null
          message?: string | null
          signed_at?: string | null
          created_at?: string
        }
      }
      tenant_notices: {
        Row: {
          id: string | null
          tenant_id: string
          unit_id: string | null
          property_id: string | null
          manager_id: string | null
          tenancy_id: string | null
          notice_type: string
          title: string
          body: string
          current_rent: number | null
          new_rent: number | null
          effective_date: string | null
          notice_period_days: number | null
          delivery_method: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          tenant_acknowledged: boolean | null
          tenant_ack_at: string | null
          tenant_response: string | null
          document_url: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          unit_id?: string | null
          property_id?: string | null
          manager_id?: string | null
          tenancy_id?: string | null
          notice_type: string
          title: string
          body: string
          current_rent?: number | null
          new_rent?: number | null
          effective_date?: string | null
          notice_period_days?: number | null
          delivery_method?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          tenant_acknowledged?: boolean | null
          tenant_ack_at?: string | null
          tenant_response?: string | null
          document_url?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          unit_id?: string | null
          property_id?: string | null
          manager_id?: string | null
          tenancy_id?: string | null
          notice_type?: string
          title?: string
          body?: string
          current_rent?: number | null
          new_rent?: number | null
          effective_date?: string | null
          notice_period_days?: number | null
          delivery_method?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          tenant_acknowledged?: boolean | null
          tenant_ack_at?: string | null
          tenant_response?: string | null
          document_url?: string | null
          status?: string
          created_at?: string
        }
      }
      tenant_notification_preferences: {
        Row: {
          id: string | null
          tenant_user_id: string
          tenant_id: string | null
          email_enabled: boolean
          sms_enabled: boolean
          whatsapp_enabled: boolean
          push_enabled: boolean
          payment_reminders: boolean
          invoice_due: boolean
          payment_confirmed: boolean
          maintenance_updates: boolean
          lease_alerts: boolean
          manager_messages: boolean
          announcements: boolean
          rent_increase: boolean
          reminder_days_before: number
          quiet_hours_start: string | null
          quiet_hours_end: string | null
          language: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          tenant_user_id: string
          tenant_id?: string | null
          email_enabled?: boolean
          sms_enabled?: boolean
          whatsapp_enabled?: boolean
          push_enabled?: boolean
          payment_reminders?: boolean
          invoice_due?: boolean
          payment_confirmed?: boolean
          maintenance_updates?: boolean
          lease_alerts?: boolean
          manager_messages?: boolean
          announcements?: boolean
          rent_increase?: boolean
          reminder_days_before?: number
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          language?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          tenant_user_id?: string
          tenant_id?: string | null
          email_enabled?: boolean
          sms_enabled?: boolean
          whatsapp_enabled?: boolean
          push_enabled?: boolean
          payment_reminders?: boolean
          invoice_due?: boolean
          payment_confirmed?: boolean
          maintenance_updates?: boolean
          lease_alerts?: boolean
          manager_messages?: boolean
          announcements?: boolean
          rent_increase?: boolean
          reminder_days_before?: number
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          language?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tenant_payment_details: {
        Row: {
          id: string | null
          tenant_id: string
          manager_id: string | null
          property_id: string | null
          unit_id: string | null
          monthly_rent: number | null
          house_deposit: number | null
          water_deposit: number | null
          other_charges: number | null
          other_charges_desc: string | null
          total_deposit: number | null
          deposit_paid: number | null
          deposit_balance: number | null
          payment_day: number | null
          grace_period_days: number | null
          payment_method: string | null
          tenancy_type: string | null
          paybill_number: string | null
          till_number: string | null
          account_reference: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          monthly_rent?: number | null
          house_deposit?: number | null
          water_deposit?: number | null
          other_charges?: number | null
          other_charges_desc?: string | null
          deposit_paid?: number | null
          deposit_balance?: number | null
          payment_day?: number | null
          grace_period_days?: number | null
          payment_method?: string | null
          tenancy_type?: string | null
          paybill_number?: string | null
          till_number?: string | null
          account_reference?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          manager_id?: string | null
          property_id?: string | null
          unit_id?: string | null
          monthly_rent?: number | null
          house_deposit?: number | null
          water_deposit?: number | null
          other_charges?: number | null
          other_charges_desc?: string | null
          deposit_paid?: number | null
          deposit_balance?: number | null
          payment_day?: number | null
          grace_period_days?: number | null
          payment_method?: string | null
          tenancy_type?: string | null
          paybill_number?: string | null
          till_number?: string | null
          account_reference?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tenant_pets: {
        Row: {
          id: string | null
          tenant_id: string
          unit_id: string | null
          manager_id: string | null
          pet_type: string
          breed: string | null
          name: string | null
          pet_deposit: number | null
          is_approved: boolean
          approved_by: string | null
          approved_at: string | null
          notes: string | null
          photo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          unit_id?: string | null
          manager_id?: string | null
          pet_type: string
          breed?: string | null
          name?: string | null
          pet_deposit?: number | null
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          photo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          unit_id?: string | null
          manager_id?: string | null
          pet_type?: string
          breed?: string | null
          name?: string | null
          pet_deposit?: number | null
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          photo_url?: string | null
          created_at?: string
        }
      }
      tenant_reference_requests: {
        Row: {
          id: string | null
          tenant_id: string
          tenant_user_id: string
          manager_id: string | null
          issued_to: string | null
          issued_to_email: string | null
          purpose: string | null
          message: string | null
          status: string
          reference_id: string | null
          responded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          tenant_user_id: string
          manager_id?: string | null
          issued_to?: string | null
          issued_to_email?: string | null
          purpose?: string | null
          message?: string | null
          status?: string
          reference_id?: string | null
          responded_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          tenant_user_id?: string
          manager_id?: string | null
          issued_to?: string | null
          issued_to_email?: string | null
          purpose?: string | null
          message?: string | null
          status?: string
          reference_id?: string | null
          responded_at?: string | null
          created_at?: string
        }
      }
      tenant_references: {
        Row: {
          id: string | null
          tenant_id: string
          manager_id: string
          unit_id: string | null
          tenancy_id: string | null
          reference_type: string | null
          issued_to: string | null
          issued_to_email: string | null
          tenancy_period: string | null
          payment_record: string | null
          property_care: string | null
          overall_rating: number | null
          body: string | null
          recommend: boolean | null
          document_url: string | null
          sent_at: string | null
          expires_at: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          manager_id: string
          unit_id?: string | null
          tenancy_id?: string | null
          reference_type?: string | null
          issued_to?: string | null
          issued_to_email?: string | null
          tenancy_period?: string | null
          payment_record?: string | null
          property_care?: string | null
          overall_rating?: number | null
          body?: string | null
          recommend?: boolean | null
          document_url?: string | null
          sent_at?: string | null
          expires_at?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          manager_id?: string
          unit_id?: string | null
          tenancy_id?: string | null
          reference_type?: string | null
          issued_to?: string | null
          issued_to_email?: string | null
          tenancy_period?: string | null
          payment_record?: string | null
          property_care?: string | null
          overall_rating?: number | null
          body?: string | null
          recommend?: boolean | null
          document_url?: string | null
          sent_at?: string | null
          expires_at?: string | null
          status?: string
          created_at?: string
        }
      }
      tenant_unit_links: {
        Row: {
          id: string | null
          tenant_id: string
          unit_id: string
          property_id: string
          manager_id: string | null
          link_type: string
          monthly_rent: number | null
          move_in_date: string | null
          move_out_date: string | null
          is_active: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          unit_id: string
          property_id: string
          manager_id?: string | null
          link_type?: string
          monthly_rent?: number | null
          move_in_date?: string | null
          move_out_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          unit_id?: string
          property_id?: string
          manager_id?: string | null
          link_type?: string
          monthly_rent?: number | null
          move_in_date?: string | null
          move_out_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
      }
      tenant_vehicles: {
        Row: {
          id: string | null
          tenant_id: string
          unit_id: string | null
          manager_id: string | null
          make: string | null
          model: string | null
          colour: string | null
          plate_number: string
          parking_bay: string | null
          parking_fee: number | null
          is_approved: boolean
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          unit_id?: string | null
          manager_id?: string | null
          make?: string | null
          model?: string | null
          colour?: string | null
          plate_number: string
          parking_bay?: string | null
          parking_fee?: number | null
          is_approved?: boolean
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          unit_id?: string | null
          manager_id?: string | null
          make?: string | null
          model?: string | null
          colour?: string | null
          plate_number?: string
          parking_bay?: string | null
          parking_fee?: number | null
          is_approved?: boolean
          created_at?: string
        }
      }
      unit_activity_log: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string | null
          tenancy_id: string | null
          tenant_id: string | null
          triggered_by: string | null
          triggered_by_role: string | null
          event_type: string
          title: string
          description: string | null
          reference_id: string | null
          reference_type: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id?: string | null
          tenancy_id?: string | null
          tenant_id?: string | null
          triggered_by?: string | null
          triggered_by_role?: string | null
          event_type: string
          title: string
          description?: string | null
          reference_id?: string | null
          reference_type?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string | null
          tenancy_id?: string | null
          tenant_id?: string | null
          triggered_by?: string | null
          triggered_by_role?: string | null
          event_type?: string
          title?: string
          description?: string | null
          reference_id?: string | null
          reference_type?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      unit_charge_configs: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string
          manager_id: string
          charge_type: string
          charge_label: string
          amount: number
          is_active: boolean
          is_metered: boolean
          billing_cycle: string
          auto_generate: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id: string
          manager_id: string
          charge_type: string
          charge_label: string
          amount?: number
          is_active?: boolean
          is_metered?: boolean
          billing_cycle?: string
          auto_generate?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string
          manager_id?: string
          charge_type?: string
          charge_label?: string
          amount?: number
          is_active?: boolean
          is_metered?: boolean
          billing_cycle?: string
          auto_generate?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      unit_inspections: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string | null
          manager_id: string | null
          tenant_id: string | null
          tenancy_id: string | null
          inspection_type: string
          inspection_date: string
          conducted_by: string | null
          conducted_by_name: string | null
          overall_condition: string | null
          cleanliness: string | null
          walls_condition: string | null
          floor_condition: string | null
          ceiling_condition: string | null
          bathroom_condition: string | null
          kitchen_condition: string | null
          windows_condition: string | null
          doors_condition: string | null
          notes: string | null
          photos_urls: string | null
          damage_found: boolean | null
          damage_description: string | null
          estimated_repair_cost: number | null
          tenant_present: boolean | null
          tenant_signature_url: string | null
          tenant_agreed: boolean | null
          tenant_comments: string | null
          manager_signature_url: string | null
          manager_signed_at: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id?: string | null
          manager_id?: string | null
          tenant_id?: string | null
          tenancy_id?: string | null
          inspection_type?: string
          inspection_date?: string
          conducted_by?: string | null
          conducted_by_name?: string | null
          overall_condition?: string | null
          cleanliness?: string | null
          walls_condition?: string | null
          floor_condition?: string | null
          ceiling_condition?: string | null
          bathroom_condition?: string | null
          kitchen_condition?: string | null
          windows_condition?: string | null
          doors_condition?: string | null
          notes?: string | null
          photos_urls?: string | null
          damage_found?: boolean | null
          damage_description?: string | null
          estimated_repair_cost?: number | null
          tenant_present?: boolean | null
          tenant_signature_url?: string | null
          tenant_agreed?: boolean | null
          tenant_comments?: string | null
          manager_signature_url?: string | null
          manager_signed_at?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string | null
          manager_id?: string | null
          tenant_id?: string | null
          tenancy_id?: string | null
          inspection_type?: string
          inspection_date?: string
          conducted_by?: string | null
          conducted_by_name?: string | null
          overall_condition?: string | null
          cleanliness?: string | null
          walls_condition?: string | null
          floor_condition?: string | null
          ceiling_condition?: string | null
          bathroom_condition?: string | null
          kitchen_condition?: string | null
          windows_condition?: string | null
          doors_condition?: string | null
          notes?: string | null
          photos_urls?: string | null
          damage_found?: boolean | null
          damage_description?: string | null
          estimated_repair_cost?: number | null
          tenant_present?: boolean | null
          tenant_signature_url?: string | null
          tenant_agreed?: boolean | null
          tenant_comments?: string | null
          manager_signature_url?: string | null
          manager_signed_at?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      unit_key_records: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string | null
          manager_id: string | null
          tenant_id: string | null
          tenancy_id: string | null
          key_type: string
          key_label: string | null
          serial_number: string | null
          issued_date: string | null
          issued_by: string | null
          issued_to_name: string | null
          tenant_signature_url: string | null
          returned_date: string | null
          returned_to: string | null
          return_condition: string | null
          replacement_cost: number | null
          deducted_from_deposit: boolean | null
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id?: string | null
          manager_id?: string | null
          tenant_id?: string | null
          tenancy_id?: string | null
          key_type?: string
          key_label?: string | null
          serial_number?: string | null
          issued_date?: string | null
          issued_by?: string | null
          issued_to_name?: string | null
          tenant_signature_url?: string | null
          returned_date?: string | null
          returned_to?: string | null
          return_condition?: string | null
          replacement_cost?: number | null
          deducted_from_deposit?: boolean | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string | null
          manager_id?: string | null
          tenant_id?: string | null
          tenancy_id?: string | null
          key_type?: string
          key_label?: string | null
          serial_number?: string | null
          issued_date?: string | null
          issued_by?: string | null
          issued_to_name?: string | null
          tenant_signature_url?: string | null
          returned_date?: string | null
          returned_to?: string | null
          return_condition?: string | null
          replacement_cost?: number | null
          deducted_from_deposit?: boolean | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      unit_tenancy_history: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string
          manager_id: string | null
          tenant_id: string
          tenant_name: string
          tenant_email: string
          tenant_phone: string | null
          move_in_date: string
          move_out_date: string | null
          booking_date: string | null
          monthly_rent: number | null
          deposit_paid: number | null
          water_deposit_paid: number | null
          total_paid: number | null
          arrears_at_moveout: number | null
          status: string
          move_out_reason: string | null
          move_out_notes: string | null
          notice_id: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id: string
          manager_id?: string | null
          tenant_id: string
          tenant_name: string
          tenant_email: string
          tenant_phone?: string | null
          move_in_date: string
          move_out_date?: string | null
          booking_date?: string | null
          monthly_rent?: number | null
          deposit_paid?: number | null
          water_deposit_paid?: number | null
          total_paid?: number | null
          arrears_at_moveout?: number | null
          status?: string
          move_out_reason?: string | null
          move_out_notes?: string | null
          notice_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string
          manager_id?: string | null
          tenant_id?: string
          tenant_name?: string
          tenant_email?: string
          tenant_phone?: string | null
          move_in_date?: string
          move_out_date?: string | null
          booking_date?: string | null
          monthly_rent?: number | null
          deposit_paid?: number | null
          water_deposit_paid?: number | null
          total_paid?: number | null
          arrears_at_moveout?: number | null
          status?: string
          move_out_reason?: string | null
          move_out_notes?: string | null
          notice_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ,
      // BEGIN PHASE12_MIGRATION_TABLES
      api_rate_limits: {
        Row: {
          id: string | null
          user_id: string
          function_name: string
          window_start: string
          call_count: number
        }
        Insert: {
          id?: string | null
          user_id: string
          function_name: string
          window_start?: string
          call_count?: number
        }
        Update: {
          id?: string | null
          user_id?: string
          function_name?: string
          window_start?: string
          call_count?: number
        }
        Relationships: []
      },
      billing_events: {
        Row: {
          id: string | null
          event_type: string
          client_type: string
          client_user_id: string
          invoice_id: string | null
          amount: number | null
          notes: string | null
          performed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          event_type: string
          client_type: string
          client_user_id: string
          invoice_id?: string | null
          amount?: number | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          event_type?: string
          client_type?: string
          client_user_id?: string
          invoice_id?: string | null
          amount?: number | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string
        }
        Relationships: []
      },
      commission_configs: {
        Row: {
          id: string | null
          tier_key: string
          platform_rate: number
          stripe_rate: number
          mpesa_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          tier_key: string
          platform_rate?: number
          stripe_rate?: number
          mpesa_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          tier_key?: string
          platform_rate?: number
          stripe_rate?: number
          mpesa_rate?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      commissions: {
        Row: {
          id: string | null
          invoice_id: string | null
          manager_id: string | null
          amount: number
          rate_applied: number
          status: string
          created_at: string
          collected_at: string | null
        }
        Insert: {
          id?: string | null
          invoice_id?: string | null
          manager_id?: string | null
          amount: number
          rate_applied: number
          status?: string
          created_at?: string
          collected_at?: string | null
        }
        Update: {
          id?: string | null
          invoice_id?: string | null
          manager_id?: string | null
          amount?: number
          rate_applied?: number
          status?: string
          created_at?: string
          collected_at?: string | null
        }
        Relationships: []
      },
      contractor_bids: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      contractors: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      customer_billing_blocks: {
        Row: {
          id: string | null
          customer_id: string
          customer_type: string
          agency_id: string | null
          price_per_unit: number | null
          unit_count_locked: boolean
          registration_fee_waived: boolean
          registration_fee_amount: number | null
          monthly_discount_pct: number | null
          monthly_discount_flat: number | null
          discount_label: string | null
          discount_expires_at: string | null
          zero_registration: boolean
          custom_block_name: string | null
          custom_block_price: number | null
          custom_block_units: number | null
          custom_block_notes: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string | null
          customer_id: string
          customer_type: string
          agency_id?: string | null
          price_per_unit?: number | null
          unit_count_locked?: boolean
          registration_fee_waived?: boolean
          registration_fee_amount?: number | null
          monthly_discount_pct?: number | null
          monthly_discount_flat?: number | null
          discount_label?: string | null
          discount_expires_at?: string | null
          zero_registration?: boolean
          custom_block_name?: string | null
          custom_block_price?: number | null
          custom_block_units?: number | null
          custom_block_notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string | null
          customer_id?: string
          customer_type?: string
          agency_id?: string | null
          price_per_unit?: number | null
          unit_count_locked?: boolean
          registration_fee_waived?: boolean
          registration_fee_amount?: number | null
          monthly_discount_pct?: number | null
          monthly_discount_flat?: number | null
          discount_label?: string | null
          discount_expires_at?: string | null
          zero_registration?: boolean
          custom_block_name?: string | null
          custom_block_price?: number | null
          custom_block_units?: number | null
          custom_block_notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      },
      dead_letter_queue: {
        Row: {
          id: string | null
          notification_id: string | null
          channel: string
          recipient: string
          payload: Json
          error_message: string | null
          failed_at: string
          retry_count: number
          last_retry_at: string | null
          max_retries: number
          status: string
        }
        Insert: {
          id?: string | null
          notification_id?: string | null
          channel: string
          recipient: string
          payload?: Json
          error_message?: string | null
          failed_at?: string
          retry_count?: number
          last_retry_at?: string | null
          max_retries?: number
          status?: string
        }
        Update: {
          id?: string | null
          notification_id?: string | null
          channel?: string
          recipient?: string
          payload?: Json
          error_message?: string | null
          failed_at?: string
          retry_count?: number
          last_retry_at?: string | null
          max_retries?: number
          status?: string
        }
        Relationships: []
      },
      disputes: {
        Row: {
          id: string | null
          invoice_id: string | null
          tenant_id: string | null
          reason: string
          status: string
          evidence_urls: string[] | null
          filed_at: string
          resolved_at: string | null
          resolved_by: string | null
          resolution_note: string | null
        }
        Insert: {
          id?: string | null
          invoice_id?: string | null
          tenant_id?: string | null
          reason: string
          status?: string
          evidence_urls?: string[] | null
          filed_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolution_note?: string | null
        }
        Update: {
          id?: string | null
          invoice_id?: string | null
          tenant_id?: string | null
          reason?: string
          status?: string
          evidence_urls?: string[] | null
          filed_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolution_note?: string | null
        }
        Relationships: []
      },
      financial_partners: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      fraud_flags: {
        Row: {
          id: string | null
          invoice_id: string | null
          tenant_id: string | null
          payment_id: string | null
          risk_score: number | null
          flag_reason: string
          flag_severity: string
          flagged_at: string
          resolved_at: string | null
          resolved_by: string | null
          resolution_note: string | null
        }
        Insert: {
          id?: string | null
          invoice_id?: string | null
          tenant_id?: string | null
          payment_id?: string | null
          risk_score?: number | null
          flag_reason: string
          flag_severity?: string
          flagged_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolution_note?: string | null
        }
        Update: {
          id?: string | null
          invoice_id?: string | null
          tenant_id?: string | null
          payment_id?: string | null
          risk_score?: number | null
          flag_reason?: string
          flag_severity?: string
          flagged_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolution_note?: string | null
        }
        Relationships: []
      },
      insurance_claims: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      insurance_policies: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      insurance_providers: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      invoice_counters: {
        Row: {
          manager_user_id: string | null
          last_number: number
          updated_at: string
        }
        Insert: {
          manager_user_id?: string | null
          last_number?: number
          updated_at?: string
        }
        Update: {
          manager_user_id?: string | null
          last_number?: number
          updated_at?: string
        }
        Relationships: []
      },
      invoice_line_items: {
        Row: {
          id: string | null
          invoice_id: string
          unit_charge_id: string | null
          charge_type: string
          charge_label: string
          quantity: number
          unit_price: number
          amount: number
          is_manual: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          invoice_id: string
          unit_charge_id?: string | null
          charge_type: string
          charge_label: string
          quantity?: number
          unit_price: number
          amount: number
          is_manual?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          invoice_id?: string
          unit_charge_id?: string | null
          charge_type?: string
          charge_label?: string
          quantity?: number
          unit_price?: number
          amount?: number
          is_manual?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      },
      landlord_mpesa_settings: {
        Row: {
          id: string | null
          landlord_user_id: string
          property_id: string | null
          unit_id: string | null
          consumer_key: string | null
          consumer_secret: string | null
          is_live: boolean
          paybill_enabled: boolean
          paybill_shortcode: string | null
          paybill_passkey: string | null
          paybill_account_reference: string | null
          till_enabled: boolean
          till_shortcode: string | null
          till_passkey: string | null
          use_unit_as_account_ref: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          landlord_user_id: string
          property_id?: string | null
          unit_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          is_live?: boolean
          paybill_enabled?: boolean
          paybill_shortcode?: string | null
          paybill_passkey?: string | null
          paybill_account_reference?: string | null
          till_enabled?: boolean
          till_shortcode?: string | null
          till_passkey?: string | null
          use_unit_as_account_ref?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          landlord_user_id?: string
          property_id?: string | null
          unit_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          is_live?: boolean
          paybill_enabled?: boolean
          paybill_shortcode?: string | null
          paybill_passkey?: string | null
          paybill_account_reference?: string | null
          till_enabled?: boolean
          till_shortcode?: string | null
          till_passkey?: string | null
          use_unit_as_account_ref?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      landlord_team_members: {
        Row: {
          id: string | null
          landlord_user_id: string
          member_user_id: string
          member_label: string | null
          can_view_properties: boolean
          can_view_tenants: boolean
          can_view_leases: boolean
          can_view_invoices: boolean
          can_view_maintenance: boolean
          can_view_contracts: boolean
          can_view_activity_logs: boolean
          can_record_payments: boolean
          can_edit_tenants: boolean
          can_manage_maintenance: boolean
          can_create_invoices: boolean
          can_approve_moveouts: boolean
          can_send_notices: boolean
          can_upload_documents: boolean
          assigned_property_ids: string[]
          restrict_to_assigned_properties: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          landlord_user_id: string
          member_user_id: string
          member_label?: string | null
          can_view_properties?: boolean
          can_view_tenants?: boolean
          can_view_leases?: boolean
          can_view_invoices?: boolean
          can_view_maintenance?: boolean
          can_view_contracts?: boolean
          can_view_activity_logs?: boolean
          can_record_payments?: boolean
          can_edit_tenants?: boolean
          can_manage_maintenance?: boolean
          can_create_invoices?: boolean
          can_approve_moveouts?: boolean
          can_send_notices?: boolean
          can_upload_documents?: boolean
          assigned_property_ids?: string[]
          restrict_to_assigned_properties?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          landlord_user_id?: string
          member_user_id?: string
          member_label?: string | null
          can_view_properties?: boolean
          can_view_tenants?: boolean
          can_view_leases?: boolean
          can_view_invoices?: boolean
          can_view_maintenance?: boolean
          can_view_contracts?: boolean
          can_view_activity_logs?: boolean
          can_record_payments?: boolean
          can_edit_tenants?: boolean
          can_manage_maintenance?: boolean
          can_create_invoices?: boolean
          can_approve_moveouts?: boolean
          can_send_notices?: boolean
          can_upload_documents?: boolean
          assigned_property_ids?: string[]
          restrict_to_assigned_properties?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      landlord_wallets: {
        Row: {
          id: string | null
          landlord_user_id: string
          balance: number
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          landlord_user_id: string
          balance?: number
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          landlord_user_id?: string
          balance?: number
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      loan_applications: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      manager_notification_settings: {
        Row: {
          id: string | null
          manager_user_id: string
          notify_email: boolean
          notify_sms: boolean
          notify_whatsapp: boolean
          notify_push: boolean
          notify_payments: boolean
          notify_maintenance: boolean
          notify_leases: boolean
          notify_security: boolean
          whatsapp_provider: string | null
          whatsapp_from_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          manager_user_id: string
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          notify_push?: boolean
          notify_payments?: boolean
          notify_maintenance?: boolean
          notify_leases?: boolean
          notify_security?: boolean
          whatsapp_provider?: string | null
          whatsapp_from_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          manager_user_id?: string
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          notify_push?: boolean
          notify_payments?: boolean
          notify_maintenance?: boolean
          notify_leases?: boolean
          notify_security?: boolean
          whatsapp_provider?: string | null
          whatsapp_from_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      notification_failures: {
        Row: {
          id: string | null
          transaction_id: string | null
          tenant_id: string | null
          manager_id: string | null
          channel: string
          error: string | null
          payload: Json | null
          status: string
          attempts: number
          created_at: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          id?: string | null
          transaction_id?: string | null
          tenant_id?: string | null
          manager_id?: string | null
          channel: string
          error?: string | null
          payload?: Json | null
          status?: string
          attempts?: number
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          id?: string | null
          transaction_id?: string | null
          tenant_id?: string | null
          manager_id?: string | null
          channel?: string
          error?: string | null
          payload?: Json | null
          status?: string
          attempts?: number
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      },
      payment_allocations: {
        Row: {
          id: string | null
          transaction_id: string | null
          invoice_id: string
          tenant_id: string | null
          manager_id: string | null
          allocated_amount: number
          closes_invoice: boolean
          created_at: string
        }
        Insert: {
          id?: string | null
          transaction_id: string | null
          invoice_id: string
          tenant_id?: string | null
          manager_id?: string | null
          allocated_amount: number
          closes_invoice?: boolean
          created_at?: string
        }
        Update: {
          id?: string | null
          transaction_id?: string
          invoice_id?: string
          tenant_id?: string | null
          manager_id?: string | null
          allocated_amount?: number
          closes_invoice?: boolean
          created_at?: string
        }
        Relationships: []
      },
      payment_logs: {
        Row: {
          id: string | null
          payment_id: string | null
          event_type: string
          event_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string | null
          payment_id?: string | null
          event_type: string
          event_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string | null
          payment_id?: string | null
          event_type?: string
          event_data?: Json | null
          created_at?: string
        }
        Relationships: []
      },
      payment_processing: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      platform_admins: {
        Row: {
          id: string | null
          user_id: string
          admin_type: string
          display_name: string
          email: string
          can_create_admins: boolean
          can_manage_managers: boolean
          can_manage_billing: boolean
          can_manage_properties: boolean
          can_manage_landlords: boolean
          can_view_activity_logs: boolean
          can_manage_platform_settings: boolean
          is_immutable: boolean
          suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          admin_level: string | null
        }
        Insert: {
          id?: string | null
          user_id: string
          admin_type: string
          display_name: string
          email: string
          can_create_admins?: boolean
          can_manage_managers?: boolean
          can_manage_billing?: boolean
          can_manage_properties?: boolean
          can_manage_landlords?: boolean
          can_view_activity_logs?: boolean
          can_manage_platform_settings?: boolean
          is_immutable?: boolean
          suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          admin_level?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string
          admin_type?: string
          display_name?: string
          email?: string
          can_create_admins?: boolean
          can_manage_managers?: boolean
          can_manage_billing?: boolean
          can_manage_properties?: boolean
          can_manage_landlords?: boolean
          can_view_activity_logs?: boolean
          can_manage_platform_settings?: boolean
          is_immutable?: boolean
          suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          admin_level?: string | null
        }
        Relationships: []
      },
      platform_public_site_config: {
        Row: {
          id: boolean
          config: Json
          published: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          config?: Json
          published?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          config?: Json
          published?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      },
      platform_billing_rules: {
        Row: {
          id: string | null
          rule_name: string
          client_type: string
          billing_model: string
          rate_amount: number
          rate_pct: number | null
          applies_to_tier: string | null
          registration_fee: number | null
          free_trial_days: number | null
          is_active: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          rule_name: string
          client_type: string
          billing_model?: string
          rate_amount?: number
          rate_pct?: number | null
          applies_to_tier?: string | null
          registration_fee?: number | null
          free_trial_days?: number | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          rule_name?: string
          client_type?: string
          billing_model?: string
          rate_amount?: number
          rate_pct?: number | null
          applies_to_tier?: string | null
          registration_fee?: number | null
          free_trial_days?: number | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      },
      provider_reviews: {
        Row: {
          id: string | null
          provider_id: string
          reviewer_id: string | null
          reviewer_role: string | null
          maintenance_id: string | null
          rating: number
          title: string | null
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          provider_id: string
          reviewer_id?: string | null
          reviewer_role?: string | null
          maintenance_id?: string | null
          rating: number
          title?: string | null
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          provider_id?: string
          reviewer_id?: string | null
          reviewer_role?: string | null
          maintenance_id?: string | null
          rating?: number
          title?: string | null
          comment?: string | null
          created_at?: string
        }
        Relationships: []
      },
      rent_report_schedules: {
        Row: {
          id: string | null
          manager_id: string
          recipients: string[]
          enabled: boolean
          send_day: number
          last_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          manager_id: string
          recipients?: string[]
          enabled?: boolean
          send_day?: number
          last_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          manager_id?: string
          recipients?: string[]
          enabled?: boolean
          send_day?: number
          last_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      security_audit_log: {
        Row: {
          id: string | null
          user_id: string | null
          event_type: string
          ip_address: string | null
          user_agent: string | null
          resource_type: string | null
          resource_id: string | null
          details: Json | null
          severity: string
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          event_type: string
          ip_address?: string | null
          user_agent?: string | null
          resource_type?: string | null
          resource_id?: string | null
          details?: Json | null
          severity?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string | null
          event_type?: string
          ip_address?: string | null
          user_agent?: string | null
          resource_type?: string | null
          resource_id?: string | null
          details?: Json | null
          severity?: string
          created_at?: string
        }
        Relationships: []
      },
      stripe_processed_events: {
        Row: {
          event_id: string | null
          event_type: string
          processed_at: string
          invoice_id: string | null
          reference: string | null
        }
        Insert: {
          event_id?: string | null
          event_type: string
          processed_at?: string
          invoice_id?: string | null
          reference?: string | null
        }
        Update: {
          event_id?: string | null
          event_type?: string
          processed_at?: string
          invoice_id?: string | null
          reference?: string | null
        }
        Relationships: []
      },
      tenant_blacklist: {
        Row: {
          id: string | null
          tenant_id: string | null
          manager_id: string
          property_id: string | null
          tenant_name: string | null
          tenant_email: string | null
          tenant_phone: string | null
          national_id: string | null
          reason: string
          category: string | null
          severity: string | null
          incident_date: string | null
          amount_owed: number | null
          evidence_urls: string[] | null
          notes: string | null
          is_active: boolean
          expires_at: string | null
          removed_at: string | null
          removed_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id?: string | null
          manager_id: string
          property_id?: string | null
          tenant_name?: string | null
          tenant_email?: string | null
          tenant_phone?: string | null
          national_id?: string | null
          reason: string
          category?: string | null
          severity?: string | null
          incident_date?: string | null
          amount_owed?: number | null
          evidence_urls?: string[] | null
          notes?: string | null
          is_active?: boolean
          expires_at?: string | null
          removed_at?: string | null
          removed_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string | null
          manager_id?: string
          property_id?: string | null
          tenant_name?: string | null
          tenant_email?: string | null
          tenant_phone?: string | null
          national_id?: string | null
          reason?: string
          category?: string | null
          severity?: string | null
          incident_date?: string | null
          amount_owed?: number | null
          evidence_urls?: string[] | null
          notes?: string | null
          is_active?: boolean
          expires_at?: string | null
          removed_at?: string | null
          removed_reason?: string | null
          created_at?: string
        }
        Relationships: []
      },
      tenant_invites: {
        Row: {
          id: string | null
          email: string
          token: string
          property_id: string | null
          unit_id: string | null
          status: string
          invited_by: string | null
          created_at: string
          expires_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string | null
          email: string
          token: string
          property_id?: string | null
          unit_id?: string | null
          status?: string
          invited_by?: string | null
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string | null
          email?: string
          token?: string
          property_id?: string | null
          unit_id?: string | null
          status?: string
          invited_by?: string | null
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      },
      tenant_transfer_log: {
        Row: {
          id: string | null
          tenant_id: string
          from_manager_id: string | null
          to_manager_id: string | null
          transfer_type: string
          transferred_by: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          tenant_id: string
          from_manager_id?: string | null
          to_manager_id?: string | null
          transfer_type?: string
          transferred_by: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          tenant_id?: string
          from_manager_id?: string | null
          to_manager_id?: string | null
          transfer_type?: string
          transferred_by?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      },
      unit_amenities: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string
          manager_id: string
          amenity_type: string
          amenity_label: string
          is_included: boolean
          extra_charge: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id: string
          manager_id: string
          amenity_type: string
          amenity_label: string
          is_included?: boolean
          extra_charge?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string
          manager_id?: string
          amenity_type?: string
          amenity_label?: string
          is_included?: boolean
          extra_charge?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      },
      unit_deposit_ledger: {
        Row: {
          id: string | null
          unit_id: string
          tenant_id: string | null
          manager_id: string | null
          deposit_type: string
          entry_type: string
          amount: number
          balance_after: number
          description: string | null
          reference: string | null
          transaction_date: string
          created_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          tenant_id?: string | null
          manager_id?: string | null
          deposit_type: string
          entry_type: string
          amount: number
          balance_after: number
          description?: string | null
          reference?: string | null
          transaction_date?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          tenant_id?: string | null
          manager_id?: string | null
          deposit_type?: string
          entry_type?: string
          amount?: number
          balance_after?: number
          description?: string | null
          reference?: string | null
          transaction_date?: string
          created_at?: string
        }
        Relationships: []
      },
      unit_photos: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string | null
          manager_id: string | null
          photo_url: string
          caption: string | null
          photo_type: string | null
          display_order: number | null
          is_cover: boolean | null
          created_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id?: string | null
          manager_id?: string | null
          photo_url: string
          caption?: string | null
          photo_type?: string | null
          display_order?: number | null
          is_cover?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string | null
          manager_id?: string | null
          photo_url?: string
          caption?: string | null
          photo_type?: string | null
          display_order?: number | null
          is_cover?: boolean | null
          created_at?: string
        }
        Relationships: []
      },
      unit_utility_meters: {
        Row: {
          id: string | null
          unit_id: string
          property_id: string | null
          manager_id: string | null
          tenant_id: string | null
          utility_type: string
          meter_number: string
          meter_label: string | null
          provider: string | null
          account_number: string | null
          billing_method: string | null
          rate_per_unit: number | null
          current_reading: number | null
          last_read_date: string | null
          installation_date: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          unit_id: string
          property_id?: string | null
          manager_id?: string | null
          tenant_id?: string | null
          utility_type: string
          meter_number: string
          meter_label?: string | null
          provider?: string | null
          account_number?: string | null
          billing_method?: string | null
          rate_per_unit?: number | null
          current_reading?: number | null
          last_read_date?: string | null
          installation_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          unit_id?: string
          property_id?: string | null
          manager_id?: string | null
          tenant_id?: string | null
          utility_type?: string
          meter_number?: string
          meter_label?: string | null
          provider?: string | null
          account_number?: string | null
          billing_method?: string | null
          rate_per_unit?: number | null
          current_reading?: number | null
          last_read_date?: string | null
          installation_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      user_devices: {
        Row: {
          id: string | null
          user_id: string
          device_name: string
          device_type: string
          device_identifier: string
          user_agent: string | null
          ip_address: string | null
          last_used_at: string | null
          is_trusted: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string | null
          user_id: string
          device_name: string
          device_type: string
          device_identifier: string
          user_agent?: string | null
          ip_address?: string | null
          last_used_at?: string | null
          is_trusted?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string
          device_name?: string
          device_type?: string
          device_identifier?: string
          user_agent?: string | null
          ip_address?: string | null
          last_used_at?: string | null
          is_trusted?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      },
      user_mfa_secrets: {
        Row: {
          id: string | null
          user_id: string
          totp_secret: string
          backup_codes: string[]
          enabled: boolean | null
          verified_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          user_id: string
          totp_secret: string
          backup_codes: string[]
          enabled?: boolean | null
          verified_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string
          totp_secret?: string
          backup_codes?: string[]
          enabled?: boolean | null
          verified_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      },
      user_sessions: {
        Row: {
          id: string | null
          user_id: string
          device_id: string | null
          session_token: string
          mfa_verified: boolean | null
          ip_address: string | null
          expires_at: string
          created_at: string | null
          last_accessed_at: string | null
        }
        Insert: {
          id?: string | null
          user_id: string
          device_id?: string | null
          session_token: string
          mfa_verified?: boolean | null
          ip_address?: string | null
          expires_at: string
          created_at?: string | null
          last_accessed_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string
          device_id?: string | null
          session_token?: string
          mfa_verified?: boolean | null
          ip_address?: string | null
          expires_at?: string
          created_at?: string | null
          last_accessed_at?: string | null
        }
        Relationships: []
      },
      utility_bills: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      utility_connections: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      utility_providers: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      wallet_transactions: {
        Row: {
          id: string | null
          wallet_id: string
          amount: number
          type: string
          reference_type: string | null
          reference_id: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          wallet_id: string
          amount: number
          type: string
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          wallet_id?: string
          amount?: number
          type?: string
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          created_at?: string
        }
        Relationships: []
      },
      water_invoices: {
        Row: {
          id: string | null
          unit_id: string | null
          tenant_id: string | null
          billing_period: string
          amount: number
          previous_reading: number | null
          current_reading: number | null
          consumption: number | null
          status: string
          issued_at: string
          paid_at: string | null
        }
        Insert: {
          id?: string | null
          unit_id?: string | null
          tenant_id?: string | null
          billing_period: string
          amount: number
          previous_reading?: number | null
          current_reading?: number | null
          consumption?: number | null
          status?: string
          issued_at?: string
          paid_at?: string | null
        }
        Update: {
          id?: string | null
          unit_id?: string | null
          tenant_id?: string | null
          billing_period?: string
          amount?: number
          previous_reading?: number | null
          current_reading?: number | null
          consumption?: number | null
          status?: string
          issued_at?: string
          paid_at?: string | null
        }
        Relationships: []
      },
      webhook_dead_letter: {
        Row: {
          id: string | null
          source: string
          external_ref: string | null
          payload: Json | null
          error: string | null
          status: string
          created_at: string
          resolved_at: string | null
          resolved_by: string | null
          notes: string | null
        }
        Insert: {
          id?: string | null
          source: string
          external_ref?: string | null
          payload?: Json | null
          error?: string | null
          status?: string
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          notes?: string | null
        }
        Update: {
          id?: string | null
          source?: string
          external_ref?: string | null
          payload?: Json | null
          error?: string | null
          status?: string
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          notes?: string | null
        }
        Relationships: []
      },
      webhook_secrets: {
        Row: {
          id: string | null
          manager_id: string | null
          webhook_type: string
          secret_hash: string
          is_active: boolean
          created_at: string
          rotated_at: string | null
        }
        Insert: {
          id?: string | null
          manager_id?: string | null
          webhook_type: string
          secret_hash: string
          is_active?: boolean
          created_at?: string
          rotated_at?: string | null
        }
        Update: {
          id?: string | null
          manager_id?: string | null
          webhook_type?: string
          secret_hash?: string
          is_active?: boolean
          created_at?: string
          rotated_at?: string | null
        }
        Relationships: []
      },
      work_orders: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      workflow_automations: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      workflow_instances: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      workflow_steps: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      },
      workflow_templates: {
        Row: Record<string, Json | null>
        Insert: Record<string, Json | null>
        Update: Record<string, Json | null>
        Relationships: []
      }
      // END PHASE12_MIGRATION_TABLES
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      self_register_tenant_atomic: { Args: { p_name: string; p_phone?: string | null }; Returns: string }
      save_manager_bank_details_atomic: { Args: { p_id?: string | null; p_payload: Json }; Returns: string }
      delete_manager_bank_details_atomic: { Args: { p_id: string }; Returns: boolean }
      save_manager_ewallet_settings_atomic: { Args: { p_payload: Json }; Returns: string }
      save_manager_company_settings_atomic: { Args: { p_payload: Json }; Returns: string }
      save_manager_receipt_settings_atomic: { Args: { p_payload: Json }; Returns: string }
      provision_submanager_atomic: { Args: { p_submanager_user_id: string; p_permissions: Json }; Returns: string }
      save_submanager_permissions_atomic: { Args: { p_submanager_user_id: string; p_permissions: Json }; Returns: string }
      save_submanager_property_assignments_atomic: { Args: { p_submanager_user_id: string; p_property_ids: string[]; p_restrict: boolean }; Returns: number }
      remove_submanager_atomic: { Args: { p_submanager_id: string }; Returns: string }
      save_workflow_template_atomic: { Args: { p_id?: string | null; p_payload: Json }; Returns: Json }
      save_workflow_instance_atomic: { Args: { p_id?: string | null; p_payload: Json }; Returns: Json }
      save_workflow_step_atomic: { Args: { p_id?: string | null; p_payload: Json }; Returns: Json }
      save_workflow_automation_atomic: { Args: { p_id?: string | null; p_payload: Json }; Returns: Json }
      save_utility_connection_atomic: { Args: { p_id?: string | null; p_payload: Json }; Returns: Json }
      save_utility_bill_atomic: { Args: { p_id?: string | null; p_payload: Json }; Returns: Json }
      update_profile_settings_atomic: { Args: { p_full_name: string; p_phone: string; p_email: string }; Returns: Database["public"]["Tables"]["profiles"]["Row"] }
      save_webhost_tier_price_atomic: { Args: { p_tier_id: string; p_price_per_property: number }; Returns: boolean }
      save_manager_notification_settings_atomic: { Args: { p_payload: Json }; Returns: string }
      create_in_app_notification_atomic: { Args: { p_user_id: string; p_title: string; p_body: string; p_type?: string; p_action_url?: string | null; p_action_label?: string | null; p_reference_id?: string | null; p_reference_type?: string | null; p_priority?: string; p_source?: string; p_manager_id?: string | null }; Returns: Database["public"]["Tables"]["in_app_notifications"]["Row"] }
      mark_in_app_notification_read_atomic: { Args: { p_notification_id: string }; Returns: Database["public"]["Tables"]["in_app_notifications"]["Row"] }
      mark_all_in_app_notifications_read_atomic: { Args: Record<string, never>; Returns: number }
      dismiss_in_app_notification_atomic: { Args: { p_notification_id: string }; Returns: Database["public"]["Tables"]["in_app_notifications"]["Row"] }
      save_push_subscription_atomic: { Args: { p_endpoint: string; p_p256dh_key: string; p_auth_key: string }; Returns: Database["public"]["Tables"]["push_subscriptions"]["Row"] }
      delete_push_subscription_atomic: { Args: { p_endpoint: string }; Returns: number }
      update_profile_currency_atomic: { Args: { p_currency: string }; Returns: Database["public"]["Tables"]["profiles"]["Row"] }
      append_activity_log_atomic: { Args: { p_action: string; p_entity_type: string; p_entity_id?: string | null; p_metadata?: Json }; Returns: Database["public"]["Tables"]["activity_logs"]["Row"] }
      provision_manager_account_atomic: { Args: { p_manager_user_id: string; p_full_name?: string | null }; Returns: Json }
      transition_manager_admin_atomic: { Args: { p_manager_user_id: string; p_action: string; p_reason?: string | null; p_subscription_tier?: string | null }; Returns: Json }
      transition_webhook_dead_letter_atomic: { Args: { p_id: string; p_status: string; p_notes?: string | null }; Returns: Database["public"]["Tables"]["webhook_dead_letter"]["Row"] }
      get_public_site_config: { Args: Record<string, never>; Returns: Json }
      save_public_site_config: { Args: { p_config: Json; p_published?: boolean }; Returns: Json }
      provision_platform_admin_atomic: { Args: { p_user_id: string; p_email: string; p_display_name: string; p_admin_type: string }; Returns: string }
      transition_platform_admin_atomic: { Args: { p_admin_id: string; p_suspend: boolean; p_reason?: string | null }; Returns: undefined }
      remove_platform_admin_atomic: { Args: { p_admin_id: string }; Returns: undefined }
      save_subscription_tier_atomic: { Args: { p_tier_id: string; p_name: string; p_description?: string | null; p_price_per_property: number; p_price_flat?: number | null; p_max_properties: number; p_max_units: number; p_features?: Json; p_is_active: boolean }; Returns: string }
      save_property_tier_limit_atomic: { Args: { p_tier_key: string; p_category_group: string; p_max_properties: number; p_price_multiplier: number }; Returns: string }
      update_property_category_billing_atomic: { Args: { p_key: string; p_billing_multiplier: number; p_requires_tier: string }; Returns: undefined }

      save_insurance_policy_atomic: { Args: { p_policy_id?: string | null; p_provider_id?: string | null; p_property_id?: string | null; p_unit?: string | null; p_policy_type?: string | null; p_coverage_type?: string | null; p_coverage_amount?: number | null; p_premium?: number | null; p_deductible?: number | null; p_status?: string | null; p_start_date?: string | null; p_end_date?: string | null; p_renewal_date?: string | null }; Returns: Json }
      transition_insurance_claim_atomic: { Args: { p_claim_id: string; p_target_status: string; p_approved_amount?: number | null }; Returns: Json }
      save_work_order_atomic: { Args: { p_work_order_id?: string | null; p_contractor_id?: string | null; p_property_id?: string | null; p_unit?: string | null; p_category?: string | null; p_description?: string | null; p_priority?: string | null; p_budget?: number | null; p_estimated_cost?: number | null; p_scheduled_date?: string | null; p_status?: string | null }; Returns: Json }
      create_contractor_bid_atomic: { Args: { p_work_order_id: string; p_contractor_id: string; p_proposed_amount: number; p_estimated_duration: string; p_notes?: string | null }; Returns: Json }
      transition_contractor_bid_atomic: { Args: { p_bid_id: string; p_target_status: string }; Returns: Json }
      create_maintenance_request_atomic: { Args: { p_title: string; p_description: string; p_property_name: string; p_unit_number?: string | null; p_unit_id?: string | null; p_tenant_name?: string; p_tenant_email?: string; p_priority?: string; p_category?: string; p_expected_completion_date?: string | null; p_budget?: number | null; p_manager_id?: string | null; p_created_by_role?: string }; Returns: Json }
      transition_maintenance_request_atomic: { Args: { p_request_id: string; p_target_status: string }; Returns: Json }
      assign_maintenance_request_atomic: { Args: { p_request_id: string; p_assigned_to: string; p_provider_id?: string | null }; Returns: Json }
      save_expenditure_atomic: { Args: { p_manager_id: string; p_category: string; p_amount: number; p_month: string; p_description?: string | null }; Returns: Json }
      save_property_expenditure_atomic: { Args: { p_property_id: string; p_category: string; p_amount: number; p_month: string; p_description?: string | null }; Returns: Json }
      save_maintenance_financials_atomic: { Args: { p_request_id: string; p_quoted_amount?: number | null; p_agreed_amount?: number | null; p_provider_notes?: string | null }; Returns: Json }
      record_maintenance_expenditure_atomic: { Args: { p_request_id: string; p_amount?: number | null; p_month?: string | null; p_description?: string | null }; Returns: Json }
      create_provider_review_atomic: { Args: { p_provider_id: string; p_rating: number; p_title?: string | null; p_comment?: string | null }; Returns: Json }
      save_unit_photo_atomic: { Args: { p_unit_id: string; p_photo_url: string; p_photo_type?: string; p_caption?: string | null; p_display_order?: number | null }; Returns: Json }
      delete_unit_photo_atomic: { Args: { p_photo_id: string }; Returns: Json }
      set_unit_cover_photo_atomic: { Args: { p_photo_id: string }; Returns: Json }
      save_landlord_bank_details_atomic: { Args: { p_mpesa_number?: string | null; p_mpesa_name?: string | null; p_bank_name?: string | null; p_bank_account_number?: string | null; p_bank_account_name?: string | null; p_bank_branch?: string | null; p_bank_code?: string | null; p_preferred_method?: string; p_minimum_payout?: number; p_auto_request?: boolean; p_auto_request_day?: number; p_kra_pin?: string | null; p_vat_registered?: boolean; p_vat_number?: string | null }; Returns: Json }
      save_landlord_notification_preferences: { Args: { p_preferences: Json }; Returns: Json }
      send_landlord_message_atomic: { Args: { p_property_id: string; p_recipient_id: string; p_body: string; p_subject?: string | null; p_parent_id?: string | null }; Returns: Json }
      mark_landlord_messages_read_atomic: { Args: { p_message_ids: string[] }; Returns: Json }
      create_landlord_invoice_atomic: { Args: { p_landlord_user_id: string; p_amount: number; p_invoice_type?: string; p_description?: string | null; p_due_date?: string | null; p_manager_user_id?: string | null; p_property_id?: string | null; p_period_start?: string | null; p_period_end?: string | null }; Returns: Json }
      transition_landlord_invoice_atomic: { Args: { p_invoice_id: string; p_target_status: string; p_payment_method?: string | null; p_payment_reference?: string | null }; Returns: Json }
      record_orphan_payment_atomic: { Args: { p_user_id: string; p_record_id?: string | null; p_payment_date: string; p_amount: number; p_payment_method?: string | null; p_reference?: string | null; p_description?: string | null }; Returns: Json }
      attach_orphan_payment_receipt_atomic: { Args: { p_payment_id: string; p_receipt_photo: string }; Returns: Json }
      create_payout_request_atomic: {
        Args: { p_property_id: string; p_landlord_user_id: string; p_amount: number; p_period_start: string; p_period_end: string; p_notes?: string | null }
        Returns: Json
      }
      transition_payout_request_atomic: {
        Args: { p_payout_id: string; p_target_status: string; p_payment_method?: string | null; p_payment_reference?: string | null; p_payment_proof_url?: string | null; p_rejection_reason?: string | null; p_management_fee_pct?: number | null }
        Returns: Json
      }
      ensure_landlord_wallet_atomic: { Args: { p_landlord_user_id: string; p_currency?: string | null }; Returns: Json }
      append_payment_log_atomic: { Args: { p_payment_id: string; p_event_type: string; p_event_data?: Json }; Returns: Database["public"]["Tables"]["payment_logs"]["Row"] }
      save_webhost_payment_settings_atomic: { Args: { p_payload: Json }; Returns: Database["public"]["Tables"]["webhost_payment_settings"]["Row"] }
      save_platform_billing_rule_atomic: { Args: { p_rule_id?: string | null; p_payload: Json }; Returns: Database["public"]["Tables"]["platform_billing_rules"]["Row"] }
      transition_platform_billing_rule_atomic: { Args: { p_rule_id: string; p_is_active: boolean }; Returns: Database["public"]["Tables"]["platform_billing_rules"]["Row"] }
      delete_platform_billing_rule_atomic: { Args: { p_rule_id: string }; Returns: undefined }
      transition_payment_processing_atomic: { Args: { p_id: string; p_status: string }; Returns: Database["public"]["Tables"]["payment_processing"]["Row"] }
      create_loan_application_atomic: { Args: { p_payload: Json }; Returns: Database["public"]["Tables"]["loan_applications"]["Row"] }
      transition_loan_application_atomic: { Args: { p_id: string; p_status: string }; Returns: Database["public"]["Tables"]["loan_applications"]["Row"] }
      save_customer_billing_block_atomic: { Args: { p_block_id?: string | null; p_payload: Json }; Returns: Database["public"]["Tables"]["customer_billing_blocks"]["Row"] }
      delete_customer_billing_block_atomic: { Args: { p_block_id: string }; Returns: undefined }
      create_fraud_flag_atomic: { Args: { p_payment_id: string; p_reason: string; p_risk_score: number }; Returns: Database["public"]["Tables"]["fraud_flags"]["Row"] }
      transition_notification_failure_atomic: { Args: { p_id: string; p_status: string }; Returns: Database["public"]["Tables"]["notification_failures"]["Row"] }

      record_commission_atomic: { Args: { p_invoice_id: string; p_manager_id: string; p_amount: number; p_rate_applied: number }; Returns: Database["public"]["Tables"]["commissions"]["Row"] }
      transition_commission_atomic: { Args: { p_commission_id: string; p_status: string }; Returns: Database["public"]["Tables"]["commissions"]["Row"] }
      record_landlord_wallet_transaction_atomic: { Args: { p_landlord_user_id: string; p_amount: number; p_type: string; p_reference_type?: string | null; p_reference_id?: string | null; p_description?: string | null }; Returns: Json }
      create_dispute_atomic: {
        Args: { p_tenant_id: string; p_invoice_id?: string | null; p_reason: string; p_evidence_urls?: string[] }
        Returns: Json
      }
      resolve_dispute_atomic: {
        Args: { p_dispute_id: string; p_resolution_note: string; p_status?: string }
        Returns: Json
      }
      create_invoice_atomic_v2: {
        Args: { p_generation_key: string; p_lease_id?: string | null; p_tenant_id: string; p_property_id?: string | null; p_unit_id?: string | null; p_manager_id: string; p_amount: number; p_description: string; p_due_date: string; p_invoice_type?: string; p_line_items?: Json }
        Returns: Json
      }
      record_deposit_deduction_atomic: { Args: { p_tenant_id: string; p_amount: number; p_description: string; p_deduction_type?: string; p_maintenance_request_id?: string | null; p_unit_id?: string | null; p_tenancy_id?: string | null; p_category?: string; p_deduction_date?: string; p_performed_by_name?: string | null; p_performed_by_role?: string; p_evidence_url?: string | null }; Returns: Json }
      reverse_deposit_deduction_atomic: { Args: { p_deduction_id: string }; Returns: Json }
      create_deposit_refund_atomic: { Args: { p_tenant_id: string; p_refund_method: string; p_move_out_date: string; p_refund_reference?: string | null; p_bank_name?: string | null; p_bank_account_name?: string | null; p_bank_account_number?: string | null; p_mpesa_number?: string | null; p_notes?: string | null; p_unit_id?: string | null; p_tenancy_id?: string | null }; Returns: Json }
      transition_deposit_refund_atomic: { Args: { p_refund_id: string; p_status: string }; Returns: Json }
      submit_payment_receipt_atomic: { Args: { p_tenant_id: string; p_invoice_id?: string | null; p_receipt_url: string; p_amount: number; p_payment_date: string; p_payment_method: string; p_reference_number?: string | null; p_notes?: string | null }; Returns: Json }
      reject_payment_receipt_atomic: { Args: { p_receipt_id: string; p_rejection_reason: string; p_verified_by: string }; Returns: Json }
      cancel_invoice_atomic: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      update_invoice_atomic: {
        Args: { p_invoice_id: string; p_amount: number; p_due_date: string; p_description?: string | null }
        Returns: Json
      }
      set_invoice_installment_plan_atomic: {
        Args: { p_invoice_id: string; p_plan: Json }
        Returns: Json
      }
      verify_payment_receipt_atomic: {
        Args: { p_receipt_id: string; p_verified_by: string }
        Returns: Json
      }
      create_platform_payment_atomic: {
        Args: { p_manager_invoice_id: string; p_manager_user_id: string; p_amount: number; p_reference: string; p_provider_session_id?: string | null; p_provider_payment_intent_id?: string | null; p_currency?: string; p_metadata?: Json }
        Returns: Json
      }
      bind_platform_payment_provider_atomic: {
        Args: { p_transaction_id: string; p_manager_user_id: string; p_provider_session_id: string; p_provider_payment_intent_id?: string | null }
        Returns: Json
      }
      create_manager_invoice_atomic: {
        Args: { p_manager_user_id: string; p_amount: number; p_due_date: string; p_description?: string | null; p_invoice_type?: string; p_invoice_number?: string | null; p_property_count?: number | null; p_rate_per_property?: number | null; p_net_collection?: number | null; p_commission_rate?: number | null; p_subscription_tier?: string | null; p_billing_period_start?: string | null; p_billing_period_end?: string | null }
        Returns: Json
      }
      record_platform_invoice_payment_atomic: {
        Args: { p_manager_invoice_id: string; p_manager_user_id: string; p_amount: number; p_reference: string; p_payment_method?: string }
        Returns: Json
      }
      cancel_manager_invoice_atomic: {
        Args: { p_manager_invoice_id: string }
        Returns: Json
      }
      create_bank_integration_atomic: {
        Args: { p_manager_id: string; p_bank_name: string; p_account_number?: string | null; p_account_name?: string | null; p_paybill_number?: string | null; p_webhook_secret?: string | null; p_auto_reconcile?: boolean; p_match_by?: string; p_property_id?: string | null }
        Returns: Json
      }
      set_bank_integration_active_atomic: {
        Args: { p_bank_integration_id: string; p_is_active: boolean }
        Returns: Json
      }
      delete_bank_integration_atomic: {
        Args: { p_bank_integration_id: string }
        Returns: Json
      }
      get_bank_webhook_secret_atomic: {
        Args: { p_bank_integration_id: string }
        Returns: Json
      }
      rotate_bank_webhook_secret_atomic: {
        Args: { p_bank_integration_id: string }
        Returns: Json
      }
      update_platform_payment_atomic: {
        Args: { p_reference: string; p_status: string; p_invoice_id?: string | null; p_manager_user_id?: string | null; p_provider_session_id?: string | null; p_provider_payment_intent_id?: string | null; p_amount?: number | null; p_failure_reason?: string | null }
        Returns: Json
      },
      claim_stripe_event_atomic: {
        Args: { p_event_id: string; p_event_type: string }
        Returns: Json
      },
      complete_stripe_event_atomic: {
        Args: { p_event_id: string; p_invoice_id?: string | null; p_reference?: string | null }
        Returns: Json
      },
      fail_stripe_event_atomic: {
        Args: { p_event_id: string; p_error: string }
        Returns: Json
      },
      mark_payment_transaction_failed_atomic: {
        Args: { p_transaction_id: string; p_failure_reason: string }
        Returns: Json
      }
      save_unit_charge_config_atomic: { Args: { p_unit_id: string; p_charge_type: string; p_charge_label: string; p_amount: number; p_is_metered?: boolean; p_billing_cycle?: string; p_auto_generate?: boolean; p_notes?: string | null; p_charge_id?: string | null }; Returns: Database["public"]["Tables"]["unit_charge_configs"]["Row"] }
      transition_unit_charge_config_atomic: { Args: { p_charge_id: string; p_is_active: boolean }; Returns: Database["public"]["Tables"]["unit_charge_configs"]["Row"] }
      delete_unit_charge_config_atomic: { Args: { p_charge_id: string }; Returns: boolean }
      create_contract_atomic: { Args: { p_lease_id: string; p_tenant_id: string | null; p_property_id: string | null; p_unit_id: string | null; p_template_id: string | null; p_title: string; p_content: string; p_valid_from: string | null; p_valid_until: string | null; p_status?: string }; Returns: Database["public"]["Tables"]["contracts"]["Row"] }
      transition_contract_atomic: { Args: { p_contract_id: string; p_status?: string | null; p_updates?: Json }; Returns: Database["public"]["Tables"]["contracts"]["Row"] }
      soft_delete_contract_atomic: { Args: { p_contract_id: string; p_reason: string; p_deleted_by?: string | null }; Returns: Database["public"]["Tables"]["contracts"]["Row"] }
      save_contract_template_atomic: { Args: { p_template_id: string | null; p_name: string; p_description: string | null; p_content: string; p_is_default: boolean }; Returns: Database["public"]["Tables"]["contract_templates"]["Row"] }
      delete_contract_template_atomic: { Args: { p_template_id: string }; Returns: boolean }
      create_manager_contract_atomic: { Args: { p_manager_user_id: string; p_manager_email?: string | null; p_manager_name?: string | null; p_title: string; p_description?: string | null; p_contract_type?: string; p_uploaded_contract_url?: string | null; p_valid_from?: string | null; p_valid_until?: string | null }; Returns: Database["public"]["Tables"]["manager_contracts"]["Row"] }
      transition_manager_contract_atomic: { Args: { p_contract_id: string; p_status: string; p_review_notes?: string | null }; Returns: Database["public"]["Tables"]["manager_contracts"]["Row"] }
      create_invoice_atomic: {
        Args: {
          p_generation_key: string
          p_lease_id: string
          p_tenant_id: string
          p_property_id: string | null
          p_unit_id: string | null
          p_manager_id: string
          p_amount: number
          p_description: string
          p_due_date: string
          p_line_items?: Json
        }
        Returns: Json
      }
      attach_lease_document_atomic: {
        Args: { p_lease_id: string; p_document_url: string }
        Returns: boolean
      }
      create_water_meter_reading_atomic: {
        Args: {
          p_property_id: string
          p_unit_id: string
          p_previous_reading: number
          p_current_reading: number
          p_rate_per_unit: number
          p_reading_date: string
          p_billing_period_start?: string | null
          p_billing_period_end?: string | null
          p_notes?: string | null
          p_submitted_by_tenant?: boolean
          p_tenant_user_id?: string | null
          p_tenant_photo_url?: string | null
        }
        Returns: string
      }
      transition_lease_atomic: {
        Args: { p_lease_id: string; p_target_status: string }
        Returns: Json
      }
      transition_water_meter_reading_atomic: {
        Args: {
          p_reading_id: string
          p_action: string
          p_invoice_id?: string | null
          p_dispute_reason?: string | null
        }
        Returns: Json
      }
      create_lease_atomic: {
        Args: {
          p_tenant_id: string
          p_property_id: string
          p_unit_id?: string
          p_unit?: string
          p_start_date?: string
          p_end_date?: string
          p_monthly_rent?: number
          p_deposit?: number
          p_terms?: string
          p_status?: string
          p_manager_id?: string
        }
        Returns: string
      }
      get_admin_level: { Args: { _user_id: string }; Returns: string }
      get_auth_user_email: { Args: { _user_id: string }; Returns: string }
      get_landlord_portfolio_stats: { Args: Record<PropertyKey, never>; Returns: Json }
      get_org_brand: { Args: Record<PropertyKey, never>; Returns: Json }
      get_landlord_property_ops: { Args: { p_property_id: string }; Returns: Json }
      get_landlord_revenue: {
        Args: {
          p_landlord_user_id: string
          p_period_end?: string
          p_period_start?: string
          p_property_id: string
        }
        Returns: {
          arrears_total: number
          gross_rent_collected: number
          management_fee: number
          net_to_landlord: number
          occupancy_rate: number
          occupied_units: number
          payout_pending: number
          revenue_share_pct: number
          total_units: number
        }[]
      }
      get_manager_dashboard_stats: { Args: { p_manager_id: string }; Returns: Json }
      get_manager_property_count: {
        Args: { _user_id: string }
        Returns: number
      }
      get_submanager_manager_id: { Args: { _user_id: string }; Returns: string }
      get_tenant_property_id: { Args: { _user_id: string }; Returns: string }
      get_user_maintenance_email: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_tenant_email: { Args: { _user_id: string }; Returns: string }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invitation_email_matches_user: {
        Args: { invitation_email: string }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_label?: string
          p_entity_type?: string
          p_manager_id?: string
          p_metadata?: Json
          p_property_id?: string
        }
        Returns: undefined
      }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _ip_address?: string
          _resource_id?: string
          _resource_type: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      manual_generate_invoices_for_month: { Args: never; Returns: Json }
      property_belongs_to_manager: {
        Args: { _manager_user_id: string; _property_id: string }
        Returns: boolean
      }
      recalculate_all_property_occupancy: { Args: never; Returns: undefined }
      recalculate_all_property_stats: { Args: never; Returns: undefined }
      submanager_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      submanager_has_property_access: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      trigger_auto_generate_invoices: { Args: never; Returns: undefined }
      use_activation_token: { Args: { token_value: string }; Returns: boolean }
      user_owns_agency: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      validate_activation_token: {
        Args: { token_value: string }
        Returns: {
          email: string
          expires_at: string
          user_id: string
        }[]
      }
      validate_invitation_token: {
        Args: { token_value: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          invited_by: string
          property_id: string
          property_name: string
          status: string
          tenant_name: string
          unit: string
        }[]
      }
      ,
      // BEGIN PHASE12_MIGRATION_FUNCTIONS
      approve_manager_account: { Args: { p_manager_user_id?: string }; Returns: string }
      bulk_create_units: { Args: { p_property_id?: string; p_manager_id?: string; p_prefix?: string; p_start_number?: number; p_count?: number; p_monthly_rent?: number; p_unit_type?: string; p_bedrooms?: number; p_floor_number?: number }; Returns: number }
      check_rate_limit: { Args: { p_user_id?: string; p_function?: string; p_max_per_hour?: number }; Returns: boolean }
      check_tier_allows_property: { Args: { p_manager_id?: string; p_category_key?: string }; Returns: boolean }
      complete_unit_moveout: { Args: { p_unit_id?: string; p_tenant_id?: string; p_manager_id?: string; p_move_out_date?: string; p_reason?: string; p_notes?: string; p_notice_id?: string; p_grant_portal_days?: number }; Returns: string }
      create_account_activation: { Args: { p_user_id?: string; p_token?: string; p_expires_at?: string }; Returns: string }
      escalate_overdue_manager_invoices: { Args: never; Returns: string }
      get_landlord_property_revenue_summary: { Args: { p_property_id?: string }; Returns: string }
      get_manager_recent_activity: { Args: { p_manager_id?: string; p_limit?: number }; Returns: string }
      get_tenant_balance: { Args: { p_tenant_id?: string }; Returns: string }
      get_tenant_financial_position: { Args: { p_tenant_id: string }; Returns: { tenant_id: string; total_invoiced: number; total_paid: number; total_credited: number; outstanding: number; overdue: number; invoice_count: number; open_invoice_count: number }[] }
      get_manager_financial_position: { Args: { p_manager_id: string; p_period_start?: string; p_period_end?: string }; Returns: { manager_id: string; expected: number; collected: number; outstanding: number; overdue: number; credits: number; expenditures: number; net_income: number; collection_rate: number }[] }
      get_landlord_financial_position: { Args: { p_landlord_user_id: string; p_period_start?: string; p_period_end?: string }; Returns: { landlord_user_id: string; expected: number; collected: number; outstanding: number; expenditures: number; gross_income: number; net_to_landlord: number; owner_share_pct: number }[] }
      audit_financial_integrity: { Args: never; Returns: Json }
      get_tenants_with_properties: { Args: { p_manager_id?: string }; Returns: string }
      lock_invoices_for_update: { Args: { p_invoice_ids?: string[] }; Returns: string }
      process_invoice_payment: { Args: { p_invoice_id?: string; p_transaction_id?: string; p_amount?: number }; Returns: number }
      reconcile_bank_transaction_atomic: { Args: { p_bank_transaction_id: string; p_invoice_id?: string | null; p_manager_id?: string | null; p_recorded_by?: string | null; p_tenant_id?: string | null }; Returns: Json }
      dismiss_bank_transaction_atomic: { Args: { p_bank_transaction_id: string; p_manager_id: string }; Returns: Json }
      apply_tenant_credit_atomic: { Args: { p_tenant_id: string; p_manager_id?: string; p_recorded_by?: string }; Returns: Json }
      ingest_bank_webhook_atomic: { Args: { p_manager_id: string; p_bank_integration_id: string; p_external_id?: string; p_reference?: string; p_description?: string; p_amount: number; p_transaction_date: string; p_bank_name?: string; p_account_number?: string; p_payer_name?: string; p_payer_phone?: string; p_raw_payload?: Json; p_auto_reconcile?: boolean; p_match_by?: string }; Returns: Json }
      record_payment_with_installment_atomic: { Args: { p_tenant_id?: string; p_manager_id?: string; p_amount?: number; p_payment_method?: string; p_payment_date?: string; p_reference?: string; p_invoice_id?: string; p_recorded_by?: string; p_notes?: string; p_instalment_count?: number; p_is_installment?: boolean }; Returns: Json }
      process_payment_atomic: { Args: { p_tenant_id?: string; p_manager_id?: string; p_amount?: number; p_payment_method?: string; p_payment_date?: string; p_reference?: string; p_invoice_id?: string; p_invoice_ids?: string[]; p_unit_id?: string; p_property_id?: string; p_unit_number?: string; p_phone?: string; p_recorded_by?: string; p_notes?: string; p_existing_transaction_id?: string }; Returns: Json }
      refresh_manager_stats: { Args: { p_manager_id?: string }; Returns: string }
      reinstate_manager_on_payment: { Args: { p_invoice_id?: string }; Returns: string }
      suspend_manager_account: { Args: { p_manager_user_id?: string; p_reason?: string }; Returns: string }
      sync_tenant_payment_details: { Args: { p_tenant_id?: string; p_manager_id?: string; p_property_id?: string; p_unit_id?: string; p_monthly_rent?: number; p_house_deposit?: number; p_water_deposit?: number; p_other_charges?: number; p_other_charges_desc?: string; p_payment_day?: number; p_paybill?: string; p_account_ref?: string; p_tenancy_type?: string }; Returns: string }
      // END PHASE12_MIGRATION_FUNCTIONS
    }
    Enums: {
      admin_level: "super_admin" | "admin" | "limited_admin"
      app_role:
        | "manager"
        | "tenant"
        | "webhost"
        | "submanager"
        | "landlord"
        | "agency"

      invoice_status: "paid" | "pending" | "overdue" | "cancelled"
      lease_status: "active" | "expiring" | "expired" | "pending" | "terminated"
      request_priority: "low" | "medium" | "high" | "urgent"
      request_status: "open" | "in_progress" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_level: ["super_admin", "admin", "limited_admin"],
      app_role: ["manager", "tenant", "webhost", "submanager", "landlord", "agency"],
      invoice_status: ["paid", "pending", "overdue", "cancelled"],
      lease_status: ["active", "expiring", "expired", "pending", "terminated"],
      request_priority: ["low", "medium", "high", "urgent"],
      request_status: ["open", "in_progress", "completed", "cancelled"],
    },
  },
} as const
