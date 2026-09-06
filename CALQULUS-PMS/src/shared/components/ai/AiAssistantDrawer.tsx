import React, { useState } from "react";
import { Sparkles, MessageSquare, Send, Check, Copy, AlertTriangle, FileText, Bot, User, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  draftType?: "sms" | "email" | "summary";
  suggestedAction?: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    sender: "assistant",
    text: "Hello! I am your Calqulus AI Copilot. I can summarize portfolio metrics, draft arrears reminders, analyze water utility anomalies, or suggest task priorities based on active SLA deadlines.",
    timestamp: "Just now",
  },
  {
    id: "msg-2",
    sender: "user",
    text: "Draft an urgent M-Pesa payment reminder for tenant James Makena (APT 3B) who is 5 days overdue.",
    timestamp: "1 min ago",
  },
  {
    id: "msg-3",
    sender: "assistant",
    text: "Here is the drafted SMS notification ready for manager approval:\n\n'Dear James Makena, your rent payment of KES 45,000 for Apt 3B (Kilimani Heights) is currently 5 days overdue. Kindly settle via Paybill 881200 or STK push in your tenant portal. Reply if assistance is needed.'",
    timestamp: "1 min ago",
    draftType: "sms",
    suggestedAction: "Dispatch SMS via Africa's Talking Gateway",
  },
];

export function AiAssistantDrawer({ className }: { className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isCopilotThinking, setIsCopilotThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: inputText,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsCopilotThinking(true);

    setTimeout(() => {
      const assistantResponse: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: "I've analyzed your tenant ledger and lease records. Based on current permissions, I recommend dispatching a payment reminder via Africa's Talking SMS or scheduling a follow-up task for tomorrow morning.",
        timestamp: "Just now",
        suggestedAction: "Log follow-up task in manager calendar",
      };
      setMessages((prev) => [...prev, assistantResponse]);
      setIsCopilotThinking(false);
    }, 600);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm flex flex-col h-[520px]", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-sm font-extrabold text-foreground">Calqulus AI Operational Copilot</CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Permission-aware assistant for drafting, summarization, & risk evaluation.
            </CardDescription>
          </div>
        </div>

        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 font-bold">
          Role-Gated
        </Badge>
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "p-3 rounded-xl max-w-[85%] space-y-2 leading-relaxed text-xs",
              msg.sender === "user"
                ? "ml-auto bg-primary text-primary-foreground font-medium"
                : "bg-muted/40 border text-foreground"
            )}
          >
            <div className="flex items-center justify-between gap-2 text-[10px] opacity-80 border-b pb-1">
              <span className="font-bold uppercase tracking-wider">{msg.sender === "user" ? "You" : "Calqulus AI"}</span>
              <span>{msg.timestamp}</span>
            </div>

            <p className="whitespace-pre-wrap">{msg.text}</p>

            {msg.draftType && (
              <div className="pt-2 flex items-center justify-between border-t border-border/50">
                <Badge variant="secondary" className="text-[9px] font-mono uppercase">
                  Drafted {msg.draftType}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyText(msg.id, msg.text)}
                  className="h-6 text-[10px] font-bold gap-1"
                >
                  {copiedId === msg.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  {copiedId === msg.id ? "Copied Draft" : "Copy Message"}
                </Button>
              </div>
            )}
          </div>
        ))}

        {isCopilotThinking && (
          <div className="p-3 rounded-xl bg-muted/40 border text-muted-foreground flex items-center gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>AI Copilot is analyzing live ledger records...</span>
          </div>
        )}
      </CardContent>

      {/* Input Box */}
      <div className="p-3 border-t bg-muted/10 flex items-center gap-2 shrink-0">
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Ask AI Copilot to draft an email, summarize leases, or detect anomalies..."
          className="text-xs h-9"
        />
        <Button size="sm" onClick={handleSendMessage} className="h-9 px-3 bg-primary text-primary-foreground font-bold">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
