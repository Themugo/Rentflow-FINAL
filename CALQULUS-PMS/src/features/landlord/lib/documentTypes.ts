import type { ComponentType } from "react";
import { BarChart3, ClipboardCheck, FileSpreadsheet, FileText, Home } from "lucide-react";

export interface LandlordDocumentTypeConfig {
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}

export const LANDLORD_DOCUMENT_TYPE: Record<string, LandlordDocumentTypeConfig> = {
  financial_statement:  { label: "Financial statement", icon: BarChart3,       color: "text-green-600" },
  inspection_report:    { label: "Inspection report",   icon: ClipboardCheck,  color: "text-[hsl(214_73%_45%)]" },
  occupancy_report:     { label: "Occupancy report",    icon: Home,            color: "text-[hsl(218_58%_38%)]" },
  lease_summary:        { label: "Lease summary",       icon: FileText,        color: "text-warning" },
  maintenance_summary:  { label: "Maintenance summary", icon: FileSpreadsheet, color: "text-red-600" },
  property_photo:       { label: "Property photo",      icon: Home,            color: "text-slate-600" },
  custom:               { label: "Document",            icon: FileText,        color: "text-slate-600" },
};
