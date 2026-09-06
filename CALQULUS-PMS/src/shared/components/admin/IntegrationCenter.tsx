import React from "react";
import { EcosystemHub } from "@/shared/components/integrations";

export interface IntegrationItem {
  id: string;
  name: string;
  category: "Payment Gateway" | "SMS & Messaging" | "Accounting" | "Storage";
  status: "connected" | "disconnected" | "action_required";
  endpointUrl?: string;
  lastSync?: string;
}

export function IntegrationCenter({ className }: { className?: string }) {
  return <EcosystemHub className={className} />;
}
