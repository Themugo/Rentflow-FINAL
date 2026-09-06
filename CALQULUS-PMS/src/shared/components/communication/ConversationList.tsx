import React, { useState } from "react";
import { Search, Pin, MessageSquare, AlertCircle, User, Shield, Phone, Mail, Filter } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";

export interface ConversationItem {
  id: string;
  name: string;
  role: string;
  avatarText?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isPinned?: boolean;
  channel: "Tenant" | "Landlord" | "Staff" | "Vendor" | "Support";
  status: "online" | "offline" | "away";
}

const SAMPLE_CONVERSATIONS: ConversationItem[] = [
  { id: "conv-01", name: "Sarah Wanjiku", role: "Tenant • Apt 4B", avatarText: "SW", lastMessage: "Thank you for fixing the water pressure issue so promptly!", lastMessageTime: "10:42 AM", unreadCount: 2, isPinned: true, channel: "Tenant", status: "online" },
  { id: "conv-02", name: "David Kamau", role: "Property Owner • Sunset Towers", avatarText: "DK", lastMessage: "Received the July monthly payout statement. Looks good.", lastMessageTime: "Yesterday", unreadCount: 0, isPinned: true, channel: "Landlord", status: "offline" },
  { id: "conv-03", name: "Apex Plumbing Services", role: "Maintenance Vendor", avatarText: "AP", lastMessage: "Work order #382 has been completed at Kilimani Crest.", lastMessageTime: "Jul 29", unreadCount: 1, channel: "Vendor", status: "online" },
  { id: "conv-04", name: "James Otieno", role: "Property Manager • Branch East", avatarText: "JO", lastMessage: "Drafting the quarterly occupancy forecast report now.", lastMessageTime: "Jul 28", unreadCount: 0, channel: "Staff", status: "online" },
  { id: "conv-05", name: "Tenant Helpdesk #104", role: "Support Ticket • Overdue Rent", avatarText: "TH", lastMessage: "Requesting payment extension for invoice #INV-9281.", lastMessageTime: "Jul 27", unreadCount: 0, channel: "Support", status: "away" },
];

interface ConversationListProps {
  activeId?: string;
  onSelectConversation?: (id: string) => void;
  className?: string;
}

export function ConversationList({ activeId, onSelectConversation, className }: ConversationListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("All");

  const filteredConversations = SAMPLE_CONVERSATIONS.filter((conv) => {
    const matchesSearch = conv.name.toLowerCase().includes(searchTerm.toLowerCase()) || conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel = channelFilter === "All" || conv.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  return (
    <div className={cn("flex flex-col h-full bg-card border-r border-border/80", className)}>
      {/* Search Header */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="pl-8 text-xs h-8"
          />
        </div>

        {/* Channel Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
          {["All", "Tenant", "Landlord", "Staff", "Vendor", "Support"].map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={cn(
                "px-2 py-0.5 rounded-full font-semibold transition-all shrink-0",
                channelFilter === ch
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {filteredConversations.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <div
              key={conv.id}
              onClick={() => onSelectConversation && onSelectConversation(conv.id)}
              className={cn(
                "p-3 flex items-start gap-3 cursor-pointer transition-colors relative hover:bg-muted/40",
                isActive && "bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              {/* Avatar with Status Indicator */}
              <div className="relative shrink-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {conv.avatarText || conv.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                    conv.status === "online" && "bg-success",
                    conv.status === "away" && "bg-warning",
                    conv.status === "offline" && "bg-muted-foreground/40"
                  )}
                />
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-bold text-foreground truncate">{conv.name}</span>
                    {conv.isPinned && <Pin className="h-2.5 w-2.5 text-primary shrink-0 rotate-45" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{conv.lastMessageTime}</span>
                </div>

                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{conv.role}</p>
                <p className="text-xs text-foreground/80 truncate mt-1 line-clamp-1">{conv.lastMessage}</p>
              </div>

              {/* Unread Counter Badge */}
              {conv.unreadCount > 0 && (
                <Badge variant="default" className="text-[10px] font-bold h-4 px-1.5 bg-primary text-primary-foreground shrink-0 self-center">
                  {conv.unreadCount}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
