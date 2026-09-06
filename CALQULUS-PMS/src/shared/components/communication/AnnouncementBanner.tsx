import React, { useState } from "react";
import { Megaphone, AlertTriangle, Info, BellRing, Plus, X, Calendar, Users, Eye } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

export interface AnnouncementItem {
  id: string;
  title: string;
  category: "Emergency" | "Maintenance" | "Platform" | "Lease";
  message: string;
  audience: "All Tenants" | "Sunset Towers" | "Kilimani Crest" | "All Landlords";
  publishedAt: string;
  severity: "high" | "medium" | "low";
  isDismissible?: boolean;
}

const SAMPLE_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "ann-01",
    title: "Scheduled Water Maintenance Interruption",
    category: "Maintenance",
    message: "Water supply will be temporarily shut off for tank cleaning on Saturday, Aug 2nd from 8:00 AM to 12:00 PM.",
    audience: "Sunset Towers",
    publishedAt: "2 hours ago",
    severity: "high",
    isDismissible: true,
  },
  {
    id: "ann-02",
    title: "Platform Upgrade & Invoice Processing Auto-Sync",
    category: "Platform",
    message: "CALQULUS PMS updated with new automated M-Pesa STK push retry mechanisms for rent invoices.",
    audience: "All Tenants",
    publishedAt: "1 day ago",
    severity: "low",
    isDismissible: true,
  },
];

export function AnnouncementBanner({ announcement }: { announcement?: AnnouncementItem }) {
  const [isVisible, setIsVisible] = useState(true);
  const ann = announcement || SAMPLE_ANNOUNCEMENTS[0];

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "p-3 rounded-xl border flex items-start justify-between gap-3 shadow-xs text-xs",
        ann.severity === "high" && "bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-200",
        ann.severity === "medium" && "bg-warning/10 border-warning/30 text-amber-950 dark:text-amber-200",
        ann.severity === "low" && "bg-primary/10 border-primary/30 text-primary-950 dark:text-primary-200"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Megaphone className={cn("h-4 w-4 shrink-0 mt-0.5", ann.severity === "high" ? "text-red-600" : "text-primary")} />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{ann.title}</span>
            <Badge variant="outline" className="text-[9px] font-bold h-4 px-1.5 uppercase">
              {ann.category}
            </Badge>
          </div>
          <p className="text-muted-foreground">{ann.message}</p>
        </div>
      </div>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsVisible(false)}
        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function AnnouncementManager({ className }: { className?: string }) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(SAMPLE_ANNOUNCEMENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AnnouncementItem["category"]>("Maintenance");
  const [audience, setAudience] = useState<AnnouncementItem["audience"]>("Sunset Towers");
  const [message, setMessage] = useState("");

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    const newAnn: AnnouncementItem = {
      id: `ann-${Date.now()}`,
      title,
      category,
      audience,
      message,
      publishedAt: "Just now",
      severity: category === "Emergency" ? "high" : "medium",
      isDismissible: true,
    };

    setAnnouncements([newAnn, ...announcements]);
    setIsModalOpen(false);
    setTitle("");
    setMessage("");
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold text-foreground">Broadcast & Tenant Announcements</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Publish platform-wide, property-scoped, or emergency broadcast notices.
          </CardDescription>
        </div>

        <Button size="sm" onClick={() => setIsModalOpen(true)} className="h-8 text-xs font-bold gap-1.5 bg-primary">
          <Plus className="h-3.5 w-3.5" /> New Broadcast
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {announcements.map((ann) => (
          <div key={ann.id} className="p-3 rounded-lg border border-border/80 bg-card space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-primary" />
                <span className="font-bold text-foreground">{ann.title}</span>
                <Badge variant="outline" className="text-[10px] font-bold h-4">
                  {ann.audience}
                </Badge>
              </div>

              <span className="text-[10px] text-muted-foreground">{ann.publishedAt}</span>
            </div>

            <p className="text-muted-foreground leading-relaxed pl-5">{ann.message}</p>
          </div>
        ))}
      </CardContent>

      {/* Creation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Create New Broadcast Announcement</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Send notifications to tenants, property owners, or entire building portfolios.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAnnouncement} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Announcement Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title..." className="text-xs h-8" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Category</label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Emergency" className="text-xs">Emergency</SelectItem>
                    <SelectItem value="Maintenance" className="text-xs">Maintenance</SelectItem>
                    <SelectItem value="Platform" className="text-xs">Platform Update</SelectItem>
                    <SelectItem value="Lease" className="text-xs">Lease Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Audience Scope</label>
                <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Tenants" className="text-xs">All Tenants</SelectItem>
                    <SelectItem value="Sunset Towers" className="text-xs">Sunset Towers</SelectItem>
                    <SelectItem value="Kilimani Crest" className="text-xs">Kilimani Crest</SelectItem>
                    <SelectItem value="All Landlords" className="text-xs">All Landlords</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Notice Content</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type notice details..." className="text-xs min-h-[80px]" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-8 text-xs font-bold gap-1 bg-primary">
                Broadcast Notice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
