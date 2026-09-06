import React, { useState } from "react";
import {
  Bell, CheckCheck, Filter, Trash2, Settings, AlertTriangle, DollarSign,
  Building2, Users, FileText, ChevronRight, X, Clock, Mail, PhoneCall
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: "Billing" | "Maintenance" | "Lease" | "System";
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  { id: "not-01", title: "Rent Payment Received", message: "Sarah Wanjiku paid KES 45,000 via M-Pesa STK Push for Apt 4B.", category: "Billing", timestamp: "10 mins ago", isRead: false },
  { id: "not-02", title: "Maintenance Request Assigned", message: "Apex Plumbing acknowledged work order #WO-382 at Kilimani Crest.", category: "Maintenance", timestamp: "1 hour ago", isRead: false },
  { id: "not-03", title: "Lease Renewal Due", message: "Lease for David Kamau (Unit 12A) expires in 30 days.", category: "Lease", timestamp: "3 hours ago", isRead: true },
  { id: "not-04", title: "Water Meter Billing Ready", message: "Monthly water readings processed for Sunset Towers (18 units).", category: "Billing", timestamp: "1 day ago", isRead: true },
];

interface NotificationCenterSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenterSheet({ isOpen, onClose }: NotificationCenterSheetProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(SAMPLE_NOTIFICATIONS);
  const [filterCategory, setFilterCategory] = useState<string>("All");

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const filtered = notifications.filter((n) => filterCategory === "All" || n.category === filterCategory);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0 bg-card border-l border-border/80 flex flex-col">
        {/* Drawer Header */}
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <SheetTitle className="text-sm font-bold text-foreground">Notification Center</SheetTitle>
            {unreadCount > 0 && (
              <Badge variant="default" className="text-[10px] font-bold h-4 px-1.5 bg-primary">
                {unreadCount} New
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleMarkAllRead} className="h-7 text-[11px] font-semibold gap-1 text-primary">
              <CheckCheck className="h-3.5 w-3.5" /> Read All
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7 text-muted-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Drawer Tabs / Content */}
        <Tabs defaultValue="feed" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-2 border-b">
            <TabsList className="grid grid-cols-2 h-8 text-xs">
              <TabsTrigger value="feed">Notification Feed</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>
          </div>

          {/* Feed Tab */}
          <TabsContent value="feed" className="flex-1 flex flex-col min-h-0 p-0 m-0">
            {/* Category Chips */}
            <div className="p-3 border-b flex items-center gap-1.5 overflow-x-auto text-[11px]">
              {["All", "Billing", "Maintenance", "Lease", "System"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full font-semibold transition-all shrink-0",
                    filterCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Notification Items Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-border/40">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No notifications in this category.
                </div>
              ) : (
                filtered.map((not) => (
                  <div
                    key={not.id}
                    className={cn(
                      "pt-2 first:pt-0 p-2.5 rounded-lg transition-colors flex items-start gap-3",
                      !not.isRead ? "bg-primary/5 font-medium" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {not.category === "Billing" && <DollarSign className="h-4 w-4 text-success" />}
                      {not.category === "Maintenance" && <AlertTriangle className="h-4 w-4 text-warning" />}
                      {not.category === "Lease" && <FileText className="h-4 w-4 text-primary" />}
                      {not.category === "System" && <Bell className="h-4 w-4 text-primary" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground truncate">{not.title}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{not.timestamp}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{not.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Clear All Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t bg-muted/20 flex justify-end">
                <Button size="sm" variant="ghost" onClick={handleClearAll} className="h-7 text-xs text-red-600 gap-1 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" /> Clear All
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="flex-1 p-4 space-y-4 overflow-y-auto">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Channel Preferences</h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                <div>
                  <span className="font-bold text-foreground block">Email Notifications</span>
                  <span className="text-[11px] text-muted-foreground">Receive daily digest and urgent billing receipts</span>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                <div>
                  <span className="font-bold text-foreground block">SMS Alerts</span>
                  <span className="text-[11px] text-muted-foreground">Critical water shutdowns and overdue payment reminders</span>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                <div>
                  <span className="font-bold text-foreground block">In-App Push Feed</span>
                  <span className="text-[11px] text-muted-foreground">Live activity updates and tenant replies</span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
