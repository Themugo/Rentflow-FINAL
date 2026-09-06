import React, { useState } from "react";
import {
  MessageSquare, Megaphone, LifeBuoy, Bell, History, Search, Filter, Plus, Sparkles
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { AnnouncementBanner, AnnouncementManager } from "./AnnouncementBanner";
import { SupportWorkspace } from "./SupportWorkspace";
import { CustomerCommunicationHistory } from "./CustomerCommunicationHistory";
import { cn } from "@/shared/lib/utils";

export function CommunicationHub({ className }: { className?: string }) {
  const [selectedConvId, setSelectedConvId] = useState("conv-01");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Urgent Broadcast Banner */}
      <AnnouncementBanner />

      {/* Main Communication Hub Workspace */}
      <Tabs defaultValue="messages" className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-2">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="messages" className="gap-1.5 text-xs font-bold">
              <MessageSquare className="h-3.5 w-3.5 text-primary" /> Messaging Center
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-1.5 text-xs font-bold">
              <Megaphone className="h-3.5 w-3.5 text-primary" /> Announcements & Broadcasts
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5 text-xs font-bold">
              <LifeBuoy className="h-3.5 w-3.5 text-primary" /> Support Helpdesk
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs font-bold">
              <History className="h-3.5 w-3.5 text-primary" /> Customer Activity Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Messaging Workspace (Split Pane Layout) */}
        <TabsContent value="messages" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[600px] border border-border/80 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="lg:col-span-4 h-full border-r border-border/80">
              <ConversationList activeId={selectedConvId} onSelectConversation={setSelectedConvId} />
            </div>

            <div className="lg:col-span-8 h-full">
              <ChatWindow />
            </div>
          </div>
        </TabsContent>

        {/* Announcements Workspace */}
        <TabsContent value="announcements" className="m-0">
          <AnnouncementManager />
        </TabsContent>

        {/* Support Tickets Workspace */}
        <TabsContent value="support" className="m-0">
          <SupportWorkspace />
        </TabsContent>

        {/* Customer Activity Timeline */}
        <TabsContent value="timeline" className="m-0">
          <CustomerCommunicationHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
