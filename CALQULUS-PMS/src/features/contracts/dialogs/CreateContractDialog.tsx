// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/**
 * CreateContractDialog.tsx
 *
 * Dialog for creating a new contract.
 * Handles lease selection, template selection, and content population.
 */

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { createContract, populateTemplateContent, fetchCompanySettings, fetchPropertyDetails } from "@/features/contracts/services/contracts.service";
import type { TemplateRow, LeaseRow } from "@/features/contracts/hooks/useContractsData";

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leases: LeaseRow[];
  templates: TemplateRow[];
  onSuccess: () => void;
}

export function CreateContractDialog({
  open,
  onOpenChange,
  leases,
  templates,
  onSuccess,
}: CreateContractDialogProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [leaseId, setLeaseId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLease = leases.find((l) => l.id === leaseId);

  // Populate content helper - declared before useEffect to avoid forward reference
  const populateContent = useCallback(async (
    templateContent: string,
    lease: LeaseRow
  ) => {
    const { data: company } = await fetchCompanySettings();
    const { data: property } = await fetchPropertyDetails(lease.property);

    const populated = populateTemplateContent(
      templateContent,
      lease as any,
      company,
      property,
      formatCurrency
    );
    setContent(populated);
  }, [formatCurrency]);

  // Auto-populate fields when lease is selected
  useEffect(() => {
    if (selectedLease) {
      setValidFrom(selectedLease.start_date);
      setValidUntil(selectedLease.end_date);
      setTitle(`Lease Agreement - ${selectedLease.property} Unit ${selectedLease.unit}`);

      // If template is already selected, populate content
      if (templateId) {
        const template = templates.find((t) => t.id === templateId);
        if (template) {
          populateContent(template.content, selectedLease);
        }
      }
    }
  }, [selectedLease, templateId, templates, populateContent]);

  // Auto-populate content when template is selected
  const handleTemplateSelect = useCallback(async (id: string) => {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (template && selectedLease) {
      populateContent(template.content, selectedLease);
    } else if (template) {
      setContent(template.content);
    }
  }, [templates, selectedLease, populateContent]);

  const handleSubmit = async () => {
    if (!leaseId || !title || !content) {
      toast({
        title: "Missing Information",
        description: "Please select a lease and provide contract content.",
        variant: "destructive",
      });
      return;
    }

    const lease = leases.find((l) => l.id === leaseId);
    setIsSubmitting(true);

    try {
      await createContract({
        lease_id: leaseId,
        tenant_id: lease?.tenant_id,
        property_id: lease?.property_id,
        unit_id: lease?.unit_id,
        template_id: templateId || undefined,
        title,
        content,
        valid_from: validFrom || undefined,
        valid_until: validUntil || undefined,
      });

      toast({
        title: "Contract Created",
        description: "The contract has been saved as a draft.",
      });

      onOpenChange(false);
      onSuccess();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create contract",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setLeaseId("");
    setTemplateId("");
    setTitle("");
    setContent("");
    setValidFrom("");
    setValidUntil("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Contract</DialogTitle>
          <DialogDescription>
            Select a lease and template to create a new contract document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lease Selection */}
          <div className="space-y-2">
            <Label htmlFor="lease">Select Lease *</Label>
            <Select value={leaseId} onValueChange={setLeaseId}>
              <SelectTrigger id="lease">
                <SelectValue placeholder="Choose a lease..." />
              </SelectTrigger>
              <SelectContent>
                {leases.map((lease) => (
                  <SelectItem key={lease.id} value={lease.id}>
                    {lease.property} - Unit {lease.unit}
                    {lease.tenants?.name ? ` (${lease.tenants.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">Contract Template</Label>
            <Select value={templateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Choose a template (optional)..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Contract Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter contract title..."
            />
          </div>

          {/* Valid Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validFrom">Valid From</Label>
              <Input
                id="validFrom"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validUntil">Valid Until</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Contract Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter contract content..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
