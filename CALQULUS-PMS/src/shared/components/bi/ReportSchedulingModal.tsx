import React, { useState } from "react";
import { Clock, Mail, FileText, Check, Calendar, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";

interface ReportSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle?: string;
}

export function ReportSchedulingModal({ isOpen, onClose, reportTitle = "Executive Performance Report" }: ReportSchedulingModalProps) {
  const [frequency, setFrequency] = useState("Weekly");
  const [format, setFormat] = useState("PDF");
  const [recipients, setRecipients] = useState("executive@calqulusrms.com, manager@calqulusrms.com");
  const [isSaved, setIsSaved] = useState(false);

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-border/80 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold text-foreground">Schedule Recurring Report Distribution</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Automate periodic report generation and delivery directly to stakeholder inboxes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleScheduleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-muted/20 border rounded-lg text-xs">
            <span className="text-muted-foreground">Target Report:</span>{" "}
            <strong className="text-foreground">{reportTitle}</strong>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Frequency</label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Daily" className="text-xs">Daily (08:00 AM)</SelectItem>
                  <SelectItem value="Weekly" className="text-xs">Weekly (Mondays)</SelectItem>
                  <SelectItem value="Monthly" className="text-xs">Monthly (1st Day)</SelectItem>
                  <SelectItem value="Quarterly" className="text-xs">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Export Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF" className="text-xs">PDF Document</SelectItem>
                  <SelectItem value="Excel" className="text-xs">Excel Spreadsheet (.xlsx)</SelectItem>
                  <SelectItem value="CSV" className="text-xs">CSV Raw Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-primary" /> Recipient Email Addresses
            </label>
            <Input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Comma separated emails..."
              className="text-xs h-8"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs font-bold gap-1.5 bg-primary">
              {isSaved ? <Check className="h-3.5 w-3.5 text-success" /> : <Save className="h-3.5 w-3.5" />}
              {isSaved ? "Distribution Active!" : "Save Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
