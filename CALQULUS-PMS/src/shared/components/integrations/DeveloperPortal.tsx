import React, { useState } from "react";
import { Key, Code, BookOpen, BarChart3, ShieldCheck, Copy, Check, Plus, Trash2, Globe, Terminal, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

export interface ApiKeyRecord {
  id: string;
  label: string;
  maskedKey: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string;
}

const SAMPLE_API_KEYS: ApiKeyRecord[] = [
  { id: "key-01", label: "Production M-Pesa Integration", maskedKey: "clq_live_99a8...f7e6", scopes: ["read:billing", "write:billing"], createdAt: "2025-02-10", lastUsedAt: "Just now" },
  { id: "key-02", label: "QuickBooks Sync Worker", maskedKey: "clq_live_14b2...89a0", scopes: ["read:properties", "read:tenants"], createdAt: "2025-04-12", lastUsedAt: "10 mins ago" },
];

export function DeveloperPortal({ className }: { className?: string }) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>(SAMPLE_API_KEYS);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<"curl" | "node" | "python">("node");

  const handleCopyKey = (id: string, masked: string) => {
    navigator.clipboard.writeText(masked);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Developer Portal & SDK Hub</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Manage API keys, inspect OpenAPI specs, view client SDK quickstarts, and configure CORS origins.
          </CardDescription>
        </div>

        <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Generate Secret API Key
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-5 text-xs">
        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList className="h-8">
            <TabsTrigger value="keys" className="text-xs font-bold gap-1">
              <Key className="h-3.5 w-3.5" /> Secret API Keys
            </TabsTrigger>
            <TabsTrigger value="sdks" className="text-xs font-bold gap-1">
              <Code className="h-3.5 w-3.5" /> SDK Quickstart
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs font-bold gap-1">
              <BarChart3 className="h-3.5 w-3.5" /> Rate Limits & Usage
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-3 m-0">
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="p-3 rounded-xl border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{key.label}</span>
                      <code className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded font-mono text-muted-foreground">{key.maskedKey}</code>
                      <button onClick={() => handleCopyKey(key.id, key.maskedKey)}>
                        {copiedKeyId === key.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {key.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-muted-foreground block">Last Used: {key.lastUsedAt}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive hover:text-destructive p-0">
                      Revoke Key
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* SDK Quickstart Tab */}
          <TabsContent value="sdks" className="space-y-3 m-0">
            <div className="p-3 border rounded-xl bg-navy-deep text-slate-100 font-mono space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> Client SDK Quickstart
                </span>

                <div className="flex gap-1 text-[10px]">
                  {(["node", "python", "curl"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={cn("px-2 py-0.5 rounded uppercase font-bold", selectedLanguage === lang ? "bg-primary text-primary-foreground" : "text-slate-400")}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <pre className="text-[11px] p-2 leading-relaxed text-slate-300 overflow-x-auto">
                {selectedLanguage === "node" && `import { CalqulusSDK } from "@calqulus/sdk";\n\nconst client = new CalqulusSDK({\n  apiKey: process.env.CALQULUS_API_KEY,\n});\n\nconst properties = await client.properties.list();\nconsole.log(properties);`}
                {selectedLanguage === "python" && `from calqulus import CalqulusClient\n\nclient = CalqulusClient(api_key="clq_live_...")\nproperties = client.properties.list()\nprint(properties)`}
                {selectedLanguage === "curl" && `curl -X GET "https://www.calqulus.site/api/v2/properties" \\\n  -H "Authorization: Bearer clq_live_..."`}
              </pre>
            </div>
          </TabsContent>

          {/* Rate Limits & Usage Tab */}
          <TabsContent value="analytics" className="space-y-3 m-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 border rounded-xl bg-card">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Monthly API Call Usage</span>
                <strong className="text-lg font-extrabold text-foreground">142,890 / 500,000</strong>
                <span className="text-[10px] text-success block mt-0.5">28.5% of tier limit</span>
              </div>

              <div className="p-3 border rounded-xl bg-card">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Rate Limit Allocation</span>
                <strong className="text-lg font-extrabold text-foreground">1,000 Req / Min</strong>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Bursting enabled up to 1,500</span>
              </div>

              <div className="p-3 border rounded-xl bg-card">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Average Response Latency</span>
                <strong className="text-lg font-extrabold text-foreground">32 ms</strong>
                <span className="text-[10px] text-success block mt-0.5">99.99% Availability</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
