import React, { useState } from "react";
import { Paperclip, Upload, FileText, Download, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

export interface AttachmentItem {
  id: string;
  name: string;
  size?: string;
  fileType?: string;
  uploadedAt?: string;
  required?: boolean;
  status: "uploaded" | "pending" | "verifying";
  url?: string;
}

interface AttachmentManagerProps {
  attachments: AttachmentItem[];
  onUpload?: (files: FileList) => void;
  onDelete?: (id: string) => void;
  title?: string;
  className?: string;
}

export function AttachmentManager({
  attachments,
  onUpload,
  onDelete,
  title = "Document Attachments & Files",
  className,
}: AttachmentManagerProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onUpload) {
      onUpload(e.target.files);
    }
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold text-foreground">{title}</CardTitle>
        </div>
        <Badge variant="outline" className="text-xs font-bold">
          {attachments.filter((a) => a.status === "uploaded").length} Files
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Drop Zone */}
        {onUpload && (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files) onUpload(e.dataTransfer.files);
            }}
            className={cn(
              "p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all text-center",
              dragActive ? "border-primary bg-primary/5" : "border-border/80 hover:bg-muted/30"
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="text-xs">
              <span className="font-bold text-primary">Click to upload</span> or drag and drop files here
            </div>
            <p className="text-[10px] text-muted-foreground">PDF, PNG, JPG, DOCX up to 25MB</p>
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
          </label>
        )}

        {/* Attachment List */}
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="p-3 rounded-lg border bg-card flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-foreground truncate">{att.name}</span>
                    {att.required && (
                      <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 border-red-500/20 font-bold px-1 h-3.5">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    {att.size && <span>{att.size}</span>}
                    {att.uploadedAt && <span>• {att.uploadedAt}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] capitalize font-bold h-5",
                    att.status === "uploaded" && "bg-success/10 text-success border-success/20",
                    att.status === "pending" && "bg-warning/10 text-warning border-warning/20",
                    att.status === "verifying" && "bg-primary/10 text-primary border-primary/20"
                  )}
                >
                  {att.status}
                </Badge>

                {att.url && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}

                {onDelete && (
                  <Button size="icon" variant="ghost" onClick={() => onDelete(att.id)} className="h-7 w-7 text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
