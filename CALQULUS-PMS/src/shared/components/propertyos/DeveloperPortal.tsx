import React, { useState } from "react";
import {
  Terminal, Code2, BookOpen, Key, Webhook, Send, CheckCircle2, Copy, FileText, ExternalLink
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

export function DeveloperPortal({ className }: { className?: string }) {
  const [apiKey, setApiKey] = useState("calq_live_98124912049128091482104912");
  const [copied, setCopied] = useState(false);
  const [testEndpoint, setTestEndpoint] = useState("/api/v1/properties");
  const [testResponse, setTestResponse] = useState<string | null>(null);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunTest = () => {
    setTestResponse(`HTTP/1.1 200 OK
Content-Type: application/json
X-Correlation-ID: req_8829140219412

{
  "status": "success",
  "data": [
    {
      "id": "prop-101",
      "name": "Kilimani Heights Apartments",
      "total_units": 48,
      "occupancy_rate": "95.8%"
    }
  ]
}`);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Terminal className="h-5 w-5 text-navy-mid" /> Developer Experience Platform & API Sandbox
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            REST API Explorer, TypeScript SDK, Webhook Testing Sandbox, OAuth Client Credentials, and App Store Submission Portal.
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-navy-mid/10 text-navy-mid border-navy-mid/20">
          API v2.4 (OpenAPI 3.1)
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* API Credentials */}
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <h4 className="font-extrabold text-foreground text-xs flex items-center gap-2 border-b pb-2">
            <Key className="h-4 w-4 text-warning" /> Organization API Keys
          </h4>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Live Production Key</label>
              <div className="flex gap-2 mt-1">
                <Input value={apiKey} readOnly className="h-8 text-xs font-mono bg-muted/30" />
                <Button size="sm" variant="outline" onClick={handleCopyKey} className="h-8 text-xs font-bold shrink-0">
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Pass as <code className="text-primary font-mono bg-muted p-0.5 rounded">Authorization: Bearer calq_live_...</code> header in API calls.
            </p>
          </div>
        </Card>

        {/* API Explorer */}
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <h4 className="font-extrabold text-foreground text-xs flex items-center gap-2 border-b pb-2">
            <Code2 className="h-4 w-4 text-primary" /> Interactive REST API Sandbox
          </h4>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Badge className="h-8 bg-success/10 text-success font-bold text-[10px] flex items-center shrink-0">
                GET
              </Badge>
              <Input
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <Button size="sm" onClick={handleRunTest} className="h-8 text-xs font-bold gap-1 shrink-0 bg-primary text-primary-foreground">
                <Send className="h-3 w-3" /> Send
              </Button>
            </div>

            {testResponse && (
              <pre className="p-3 rounded-xl bg-navy-deep text-slate-100 font-mono text-[10px] overflow-x-auto max-h-36">
                {testResponse}
              </pre>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
