# CALQULUS PMS — PHASE 2 RLS MATRIX (127 TABLES)

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Ownership Boundary | Security Risk |
|---|---|---|---|---|---|---|---|
| `account_activations` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `activity_logs` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | Audit / Append-Only | Medium (Public/Broad Policy) |
| `admin_permissions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | User Auth / Profile | Medium (Public/Broad Policy) |
| `agencies` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `agency_members` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Agency / Manager | Medium (Public/Broad Policy) |
| `api_rate_limits` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `arrears_schedule` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `audit_logs` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | Audit / Append-Only | Medium (Public/Broad Policy) |
| `bank_details` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `bank_integration_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `bank_transactions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `billing_events` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `broadcast_campaigns` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `commission_configs` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `commissions` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `company_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `contract_templates` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `contracts` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `customer_billing_blocks` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `dead_letter_queue` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `deposit_deductions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `deposit_refunds` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `disputes` | Enabled | YES | YES | YES | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `expenditures` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `fraud_flags` | Enabled | YES | NO (Denied/Def) | YES | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `in_app_notifications` | Enabled | YES | YES | YES | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `invoice_counters` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `invoice_line_items` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `invoices` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `kenya_water_companies` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Low |
| `landlord_bank_details` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Landlord / Property | Medium (Public/Broad Policy) |
| `landlord_documents` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Landlord / Property | Medium (Public/Broad Policy) |
| `landlord_invitations` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Landlord / Property | Medium (Public/Broad Policy) |
| `landlord_invoices` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `landlord_messages` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Landlord / Property | Medium (Public/Broad Policy) |
| `landlord_mpesa_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Landlord / Property | Medium (Public/Broad Policy) |
| `landlord_notification_preferences` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Landlord / Property | Medium (Public/Broad Policy) |
| `landlord_team_members` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Landlord / Property | Medium (Public/Broad Policy) |
| `landlord_wallets` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | Landlord / Property | Medium (Public/Broad Policy) |
| `leases` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `maintenance_requests` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `manager_contracts` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_ewallet_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_invoices` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_mpesa_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_notification_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_profiles` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_status_log` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_submanagers` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `manager_subscriptions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `messages` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `move_condition_photos` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `notification_failures` | Enabled | YES | NO (Denied/Def) | YES | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `orphan_payment_entries` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `orphan_tenant_records` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `payment_allocations` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `payment_logs` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `payment_payers` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `payment_receipts` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `payment_transactions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `payout_requests` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `physical_invoices` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `physical_receipts` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `platform_admins` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `platform_billing_rules` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `profiles` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | User Auth / Profile | Medium (Public/Broad Policy) |
| `properties` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `property_amenity_charges` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `property_billing_config` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `property_categories` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `property_deductions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `property_history` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `property_landlords` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `property_tier_limits` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Low |
| `provider_reviews` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Low |
| `provider_services` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `push_subscriptions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `receipt_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `rent_report_schedules` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Low |
| `security_audit_log` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | Audit / Append-Only | Medium (Public/Broad Policy) |
| `service_categories` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `service_providers` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `stripe_processed_events` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `submanager_permissions` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `submanager_property_assignments` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `subscription_tiers` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `tenant_blacklist` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_credit_ledger` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_guarantors` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_history` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_invitations` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_invites` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_lease_renewal_responses` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_notices` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_notification_preferences` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_payment_details` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_pets` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_reference_requests` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_references` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_transfer_log` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_unit_links` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenant_vehicles` | Enabled | YES | NO (Denied/Def) | NO (Denied/Def) | NO (Denied/Def) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `tenants` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `unit_activity_log` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Audit / Append-Only | Medium (Public/Broad Policy) |
| `unit_amenities` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `unit_charge_configs` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `unit_deposit_ledger` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `unit_inspections` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `unit_key_records` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `unit_photos` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `unit_tenancy_history` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `unit_utility_meters` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `unit_water_config` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `units` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `uploaded_documents` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `user_devices` | Enabled | YES | YES | YES | YES | System / Shared | Medium (Public/Broad Policy) |
| `user_mfa_secrets` | Enabled | YES | YES | YES | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `user_roles` | Enabled | YES | YES | YES | NO (Denied/Def) | User Auth / Profile | Medium (Public/Broad Policy) |
| `user_sessions` | Enabled | YES | YES | YES | YES | System / Shared | Medium (Public/Broad Policy) |
| `vacation_notices` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `wallet_transactions` | Enabled | YES | YES | NO (Denied/Def) | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `water_billing_config` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Manager / Owner | Medium (Public/Broad Policy) |
| `water_invoices` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `water_meter_readings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
| `webhook_dead_letter` | Enabled | YES | NO (Denied/Def) | YES | NO (Denied/Def) | System / Shared | Medium (Public/Broad Policy) |
| `webhook_secrets` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | System / Shared | Medium (Public/Broad Policy) |
| `webhost_payment_settings` | Enabled | YES (ALL) | YES (ALL) | YES (ALL) | YES (ALL) | Tenant / Lease / Manager | Medium (Public/Broad Policy) |
