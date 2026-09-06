/**
 * ContractsHeader.tsx
 *
 * Presentation component for contracts page header and filters.
 * Pure UI component with no business logic.
 */

import { useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Plus,
  Search,
  FileText,
  Upload,
  LayoutTemplate,
} from "lucide-react";
import type { ContractStatus } from "@/features/contracts/hooks/useContractsUI";

interface ContractsHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: ContractStatus | "all";
  onStatusFilterChange: (value: ContractStatus | "all") => void;
  activeTab: "contracts" | "templates" | "uploaded";
  onTabChange: (value: "contracts" | "templates" | "uploaded") => void;
  totalContracts: number;
  filteredCount: number;
  selectedCount: number;
  onCreateClick: () => void;
}

const statusOptions: { value: ContractStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending_signature", label: "Pending Signature" },
  { value: "signed", label: "Signed" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

export function ContractsHeader({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  activeTab,
  onTabChange,
  totalContracts,
  filteredCount,
  selectedCount,
  onCreateClick,
}: ContractsHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contracts</h1>
          <p className="text-muted-foreground">
            Manage lease agreements, templates, and signatures
          </p>
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Contract
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as any)}>
        <TabsList>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="h-4 w-4" />
            Contracts
            <Badge variant="secondary" className="ml-1">
              {totalContracts}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="gap-2">
            <Upload className="h-4 w-4" />
            Uploaded
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      {activeTab === "contracts" && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCount > 0 && (
            <Badge variant="outline" className="gap-1">
              {selectedCount} selected
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
