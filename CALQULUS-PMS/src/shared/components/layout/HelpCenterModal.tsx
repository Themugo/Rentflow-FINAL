import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  HelpCircle,
  Search,
  BookOpen,
  MessageSquare,
  Keyboard,
  Activity,
  ExternalLink,
  ShieldCheck,
  Send,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface HelpCenterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpCenterModal({ open, onOpenChange }: HelpCenterModalProps) {
  const [activeTab, setActiveTab] = useState("docs");
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const docs = [
    {
      title: "Rent Reconciliation & M-Pesa Integration",
      category: "Billing & Collections",
      desc: "Learn how automatic Paybill and STK push matches tenant accounts in real-time.",
    },
    {
      title: "Water Billing & Sub-Meter Calculations",
      category: "Operations",
      desc: "Step-by-step guide to logging sub-meter units and auto-generating utility invoices.",
    },
    {
      title: "Managing Landlord Payouts & Revenue Share",
      category: "Financials",
      desc: "Configure operating models, agent commissions, and disbursement schedules.",
    },
    {
      title: "Tenant Invitation & Digital Lease Execution",
      category: "Tenants & Leases",
      desc: "Sending pre-filled SMS/email invites and managing lease agreement signatures.",
    },
  ];

  const faqs = [
    {
      q: "How are M-Pesa Paybill transactions matched to tenants?",
      a: "CALQULUS PMS uses the tenant's national ID, account number, or registered phone number to automatically reconcile payments into tenant ledger invoices.",
    },
    {
      q: "Can submanagers create property listings?",
      a: "Submanager permissions are configured by Managers under Settings → Team. Only submanagers with 'Write' property permissions can create or edit property records.",
    },
    {
      q: "Why can't Webhosts view individual tenant names?",
      a: "By architectural design, CALQULUS PMS enforces a strict Webhost Firewall protecting tenant PII. Webhosts only oversee system health, subscriptions, and aggregate metrics.",
    },
  ];

  const shortcuts = [
    { keys: ["⌘", "K"], label: "Open Command Palette & Search" },
    { keys: ["G", "D"], label: "Go to Main Dashboard" },
    { keys: ["G", "T"], label: "Go to Tenants Registry" },
    { keys: ["G", "B"], label: "Go to Billing & Invoices" },
    { keys: ["G", "W"], label: "Go to Water Meter Billing" },
    { keys: ["G", "M"], label: "Go to Maintenance Work Orders" },
    { keys: ["Esc"], label: "Close Active Modals / Drawers" },
  ];

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketMessage) return;
    setTicketSubmitted(true);
    setTimeout(() => {
      setTicketSubmitted(false);
      setTicketSubject("");
      setTicketMessage("");
    }, 4000);
  };

  const filteredDocs = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 border-border bg-popover shadow-2xl overflow-hidden rounded-xl">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-6 border-b border-border/80 bg-muted/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  CALQULUS Help & Support Center
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Access documentation, shortcuts, support tickets, and system health status.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1 text-[11px] text-success border-success/40">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              v2.4.0 Operational
            </Badge>
          </div>

          {/* Quick Search Bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search help topics, guides, FAQs, or troubleshooting..."
              className="pl-9 h-9 text-xs bg-background border-border/80"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 pt-2 border-b border-border/60 bg-muted/20">
            <TabsList className="bg-transparent h-9 p-0 gap-4 border-b-0 text-xs">
              <TabsTrigger
                value="docs"
                className="gap-1.5 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent px-1 pb-2"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Guides
              </TabsTrigger>
              <TabsTrigger
                value="faqs"
                className="gap-1.5 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent px-1 pb-2"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                FAQs
              </TabsTrigger>
              <TabsTrigger
                value="shortcuts"
                className="gap-1.5 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent px-1 pb-2"
              >
                <Keyboard className="h-3.5 w-3.5" />
                Shortcuts
              </TabsTrigger>
              <TabsTrigger
                value="support"
                className="gap-1.5 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent px-1 pb-2"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Support Ticket
              </TabsTrigger>
              <TabsTrigger
                value="status"
                className="gap-1.5 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent px-1 pb-2"
              >
                <Activity className="h-3.5 w-3.5" />
                System Health
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Guides */}
          <TabsContent value="docs" className="p-4 sm:p-6 m-0 focus-visible:outline-hidden">
            <ScrollArea className="h-[280px] pr-2">
              <div className="space-y-3">
                {filteredDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-border/80 bg-card hover:border-border/100 hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {doc.title}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {doc.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{doc.desc}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab 2: FAQs */}
          <TabsContent value="faqs" className="p-4 sm:p-6 m-0 focus-visible:outline-hidden">
            <ScrollArea className="h-[280px] pr-2">
              <div className="space-y-4">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg border border-border/80 bg-card space-y-1.5">
                    <p className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                      {faq.q}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-5">{faq.a}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab 3: Shortcuts */}
          <TabsContent value="shortcuts" className="p-4 sm:p-6 m-0 focus-visible:outline-hidden">
            <ScrollArea className="h-[280px] pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {shortcuts.map((sc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card text-xs"
                  >
                    <span className="text-muted-foreground font-medium">{sc.label}</span>
                    <div className="flex gap-1">
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 text-[10px] font-mono font-bold bg-muted border border-border rounded text-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab 4: Support Ticket */}
          <TabsContent value="support" className="p-4 sm:p-6 m-0 focus-visible:outline-hidden">
            {ticketSubmitted ? (
              <div className="p-8 text-center space-y-3 bg-success/10 border border-success/20 rounded-xl">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <h3 className="text-sm font-bold text-foreground">Support Ticket Dispatched</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Our engineering support desk has received your ticket. A response will be dispatched to your email shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSupportSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Subject / Issue Summary</label>
                  <Input
                    placeholder="e.g., M-Pesa Paybill Reconciliation delay for Unit 302"
                    className="h-8 text-xs"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Detailed Message</label>
                  <textarea
                    rows={4}
                    placeholder="Provide property name, transaction ref, or specific details..."
                    className="w-full rounded-md border border-border/80 bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" className="w-full gap-2 text-xs font-semibold">
                  <Send className="h-3.5 w-3.5" />
                  Submit Support Ticket
                </Button>
              </form>
            )}
          </TabsContent>

          {/* Tab 5: System Status */}
          <TabsContent value="status" className="p-4 sm:p-6 m-0 focus-visible:outline-hidden">
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg border border-border/80 bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  <div>
                    <p className="font-bold text-foreground">PostgreSQL & Supabase Auth</p>
                    <p className="text-[11px] text-muted-foreground">Operational (99.99% Uptime)</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-success border-success/40">Healthy</Badge>
              </div>

              <div className="p-3.5 rounded-lg border border-border/80 bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  <div>
                    <p className="font-bold text-foreground">M-Pesa Express & Paybill Gateway</p>
                    <p className="text-[11px] text-muted-foreground">Connected (Latency: 140ms)</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-success border-success/40">Active</Badge>
              </div>

              <div className="p-3.5 rounded-lg border border-border/80 bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  <div>
                    <p className="font-bold text-foreground">Edge Functions & Notification Engine</p>
                    <p className="text-[11px] text-muted-foreground">3 Deployed Functions Online</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-success border-success/40">Online</Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Footer */}
        <div className="p-3 px-6 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            CALQULUS PMS Knowledge Base
          </span>
          <a
            href="https://www.calqulus.site/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-primary hover:underline font-medium"
          >
            Full Documentation Portal <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
