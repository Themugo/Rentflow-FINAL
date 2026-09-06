import { useState, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, Star, Download, Upload } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";

interface Template {
  id: string;
  name: string;
  description: string | null;
  content: string;
  is_default: boolean;
}

interface TemplateManagerProps {
  templates: Template[];
  onRefresh: () => void;
}

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_CONTENT_LENGTH = 100000;

function CharacterCount({ current, max }: { current: number; max: number }) {
  const isNearLimit = current > max * 0.9;
  const isOverLimit = current > max;

  return (
    <span
      className={cn(
        "text-xs text-muted-foreground",
        isNearLimit && "text-warning",
        isOverLimit && "text-destructive font-medium"
      )}
    >
      {current.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

export function TemplateManager({ templates, onRefresh }: TemplateManagerProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    is_default: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportTemplate = (template: Template) => {
    const exportData = {
      name: template.name,
      description: template.description,
      content: template.content,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template-${template.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Exported",
      description: `"${template.name}" has been downloaded.`,
    });
  };

  const handleImportTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.name || !importData.content) {
        throw new Error("Invalid template file format");
      }

      // Get current user ID for manager_user_id
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.rpc("save_contract_template_atomic", { p_template_id: null, p_name: importData.name, p_description: importData.description || null, p_content: importData.content, p_is_default: false });

      if (error) throw error;

      toast({
        title: "Template Imported",
        description: `"${importData.name}" has been added to your templates.`,
      });
      onRefresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not import the template file.';
      toast({
        title: "Import Failed",
        description: message,
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({ name: "", description: "", content: "", is_default: false });
    setDialogOpen(true);
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      content: template.content,
      is_default: template.is_default,
    });
    setDialogOpen(true);
  };

  const handleFieldChange = (field: keyof typeof formData, value: string, maxLength: number) => {
    if (value.length <= maxLength) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and content for the template.",
        variant: "destructive",
      });
      return;
    }

    if (editingTemplate) {
      const { error } = await supabase.rpc("save_contract_template_atomic", { p_template_id: editingTemplate.id, p_name: formData.name, p_description: formData.description || null, p_content: formData.content, p_is_default: formData.is_default });

      if (error) {
        toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
        return;
      }

      toast({ title: "Template Updated", description: "The template has been saved." });
    } else {
      // Get current user ID for manager_user_id
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.rpc("save_contract_template_atomic", { p_template_id: null, p_name: formData.name, p_description: formData.description || null, p_content: formData.content, p_is_default: formData.is_default });

      if (error) {
        toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
        return;
      }

      toast({ title: "Template Created", description: "The new template has been saved." });
    }

    setDialogOpen(false);
    onRefresh();
  };

  const handleDelete = async (templateId: string) => {
    const { error } = await supabase.rpc("delete_contract_template_atomic", { p_template_id: templateId });

    if (error) {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
      return;
    }

    toast({ title: "Template Deleted", description: "The template has been removed." });
    onRefresh();
  };

  const handleSetDefault = async (templateId: string) => {
    const template = (templates || []).find((t) => t.id === templateId);
    if (!template) return;
    const { error } = await supabase.rpc("save_contract_template_atomic", { p_template_id: templateId, p_name: template.name, p_description: template.description || null, p_content: template.content, p_is_default: true });

    if (error) {
      toast({ title: "Error", description: "Failed to set default template", variant: "destructive" });
      return;
    }

    toast({ title: "Default Set", description: "This template is now the default." });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Agreement Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage reusable templates for lease and tenant agreements.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportTemplate}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="relative">
            {template.is_default && (
              <Badge className="absolute top-2 right-2 bg-warning">
                <Star className="h-3 w-3 mr-1" />
                Default
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {template.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {template.description || "No description provided."}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportTemplate(template)}>
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                {!template.is_default && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(template.id)}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Set Default
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No templates yet. Create your first template to get started.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              Use placeholders like {"{{tenant_name}}"}, {"{{property_name}}"}, {"{{monthly_rent}}"} etc.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Template Name</Label>
                <CharacterCount current={formData.name.length} max={MAX_NAME_LENGTH} />
              </div>
              <Input
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value, MAX_NAME_LENGTH)}
                placeholder="e.g., Standard Residential Lease"
                className={cn(
                  formData.name.length > MAX_NAME_LENGTH && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Description</Label>
                <CharacterCount current={formData.description.length} max={MAX_DESCRIPTION_LENGTH} />
              </div>
              <Input
                value={formData.description}
                onChange={(e) => handleFieldChange("description", e.target.value, MAX_DESCRIPTION_LENGTH)}
                placeholder="Brief description of this template"
                className={cn(
                  formData.description.length > MAX_DESCRIPTION_LENGTH && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Template Content</Label>
                <CharacterCount current={formData.content.length} max={MAX_CONTENT_LENGTH} />
              </div>
              <Textarea
                value={formData.content}
                onChange={(e) => handleFieldChange("content", e.target.value, MAX_CONTENT_LENGTH)}
                className={cn(
                  "min-h-[300px] font-mono text-sm",
                  formData.content.length > MAX_CONTENT_LENGTH && "border-destructive focus-visible:ring-destructive"
                )}
                placeholder="Enter template content with markdown formatting..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
