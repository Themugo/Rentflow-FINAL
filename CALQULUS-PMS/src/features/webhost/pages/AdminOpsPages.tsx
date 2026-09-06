import PropertyAssignment from "@/features/webhost/components/PropertyAssignment";
import SystemLandlordManagement from "@/features/webhost/components/SystemLandlordManagement";
import TierManagement from "@/features/webhost/components/TierManagement";
import PlatformBillingRules from "@/features/webhost/components/PlatformBillingRules";
import CustomerBillingBlocks from "@/features/webhost/components/CustomerBillingBlocks";
import WebhostContracts from "@/features/webhost/components/WebhostContracts";
import ErrorLogsTab from "@/features/webhost/components/ErrorLogsTab";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import type { ComponentType } from "react";

function wrap(title: string, description: string, Page: ComponentType) {
  return function AdminOpsPage() {
    return (
      <WebhostLayout title={title} description={description}>
        <Page />
      </WebhostLayout>
    );
  };
}

export const AdminProperties = wrap(
  "Properties",
  "Platform property assignment. Tenant occupancy is not shown as people.",
  PropertyAssignment,
);
export const AdminLandlords = wrap(
  "System landlords",
  "Landlords with no manager link. Managed landlords stay invisible here.",
  SystemLandlordManagement,
);
export const AdminTiers = wrap("Tiers", "Subscription tiers sold to managers and agencies.", TierManagement);
export const AdminBillingRules = wrap("Billing rules", "Platform billing rules for customer accounts.", PlatformBillingRules);
export const AdminCustomPricing = wrap("Custom pricing", "Negotiated billing blocks for customer accounts.", CustomerBillingBlocks);
export const AdminContracts = wrap("Contracts", "Platform contract templates and records.", WebhostContracts);
export const AdminIssues = wrap("Issues", "Error and warning events from the audit log.", ErrorLogsTab);
