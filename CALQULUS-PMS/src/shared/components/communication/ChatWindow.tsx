import React, { useState } from "react";
import {
  Send, Paperclip, Smile, Phone, Video, MoreVertical, ShieldAlert,
  CheckCheck, User, MessageSquare, Image, FileText, Lock, Sparkles
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  isSelf?: boolean;
  content: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  isInternalNote?: boolean;
  attachments?: { name: string; size: string; type: "image" | "document" }[];
}

const SAMPLE_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    senderName: "Sarah Wanjiku",
    senderRole: "Tenant • Apt 4B",
    isSelf: false,
    content: "Hello, I noticed water leakage coming from the bathroom ceiling this morning.",
    timestamp: "10:30 AM",
    status: "read",
  },
  {
    id: "msg-2",
    senderName: "You (Property Manager)",
    senderRole: "Manager",
    isSelf: true,
    content: "Hi Sarah, thank you for reporting this. Is it a steady drip or a major leak?",
    timestamp: "10:32 AM",
    status: "read",
  },
  {
    id: "msg-3",
    senderName: "Sarah Wanjiku",
    senderRole: "Tenant • Apt 4B",
    isSelf: false,
    content: "It is a slow, steady drip right above the sink. I have attached a photo.",
    timestamp: "10:35 AM",
    attachments: [{ name: "bathroom_leak.png", size: "2.4 MB", type: "image" }],
  },
  {
    id: "msg-4",
    senderName: "You (Internal Note)",
    senderRole: "Manager",
    isSelf: true,
    isInternalNote: true,
    content: "Assigned Apex Plumbing under Work Order #WO-382. Vendor dispatched for 2:00 PM inspection.",
    timestamp: "10:38 AM",
  },
  {
    id: "msg-5",
    senderName: "Sarah Wanjiku",
    senderRole: "Tenant • Apt 4B",
    isSelf: false,
    content: "Thank you for fixing the water pressure issue so promptly!",
    timestamp: "10:42 AM",
  },
];

interface ChatWindowProps {
  conversationName?: string;
  conversationRole?: string;
  className?: string;
}

export function ChatWindow({ conversationName = "Sarah Wanjiku", conversationRole = "Tenant • Apt 4B (Sunset Towers)", className }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE_CHAT_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: isInternalNoteMode ? "You (Internal Note)" : "You (Property Manager)",
      senderRole: "Manager",
      isSelf: true,
      isInternalNote: isInternalNoteMode,
      content: inputText,
      timestamp: "Just now",
      status: "sent",
    };

    setMessages([...messages, newMsg]);
    setInputText("");
  };

  return (
    <div className={cn("flex flex-col h-full bg-card rounded-xl border border-border/80 shadow-xs overflow-hidden", className)}>
      {/* Active Conversation Header */}
      <div className="p-3 border-b bg-muted/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">SW</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground">{conversationName}</h3>
              <Badge variant="outline" className="text-[9px] font-bold bg-success/10 text-success border-success/20">
                Online
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{conversationRole}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
            <Video className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-muted/5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col max-w-[80%]",
              msg.isSelf ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            {/* Sender Metadata */}
            <span className="text-[10px] text-muted-foreground mb-1 px-1">
              {msg.senderName} • {msg.timestamp}
            </span>

            {/* Bubble */}
            <div
              className={cn(
                "p-3 rounded-2xl text-xs space-y-2 shadow-2xs leading-relaxed",
                msg.isInternalNote
                  ? "bg-warning/10 border border-warning/30 text-amber-950 dark:text-amber-200 rounded-tr-none"
                  : msg.isSelf
                  ? "bg-primary text-primary-foreground rounded-tr-none"
                  : "bg-card border border-border/80 text-foreground rounded-tl-none"
              )}
            >
              {msg.isInternalNote && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-warning dark:text-warning border-b border-warning/20 pb-1">
                  <Lock className="h-3 w-3" /> Internal Team Note (Hidden from tenant)
                </div>
              )}

              <p>{msg.content}</p>

              {/* Attachments rendering */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="pt-2 space-y-1.5 border-t border-current/10">
                  {msg.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-muted dark:bg-white/5 text-[11px]">
                      {att.type === "image" ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      <span className="font-semibold truncate">{att.name}</span>
                      <span className="text-[9px] opacity-70 ml-auto">{att.size}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Read status */}
            {msg.isSelf && msg.status && (
              <span className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <CheckCheck className="h-3 w-3 text-primary" /> {msg.status}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Input Controls Footer */}
      <form onSubmit={handleSendMessage} className="p-3 border-t bg-card space-y-2">
        {/* Toggle Mode: Public Message vs Internal Note */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInternalNoteMode(false)}
              className={cn(
                "px-2.5 py-1 rounded-md font-bold text-[11px] transition-all",
                !isInternalNoteMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              Public Reply
            </button>
            <button
              type="button"
              onClick={() => setIsInternalNoteMode(true)}
              className={cn(
                "px-2.5 py-1 rounded-md font-bold text-[11px] transition-all flex items-center gap-1",
                isInternalNoteMode ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Lock className="h-3 w-3" /> Internal Note
            </button>
          </div>

          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            Press Enter to send message
          </span>
        </div>

        {/* Message Input Box */}
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" type="button" className="h-8 w-8 text-muted-foreground shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>

          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isInternalNoteMode ? "Type an internal note for staff..." : "Type a message to tenant..."}
            className={cn(
              "text-xs h-9 flex-1",
              isInternalNoteMode && "bg-warning/5 border-warning/30 placeholder:text-warning/50"
            )}
          />

          <Button size="sm" type="submit" className="h-9 px-3 gap-1.5 font-bold bg-primary text-primary-foreground">
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </div>
      </form>
    </div>
  );
}
