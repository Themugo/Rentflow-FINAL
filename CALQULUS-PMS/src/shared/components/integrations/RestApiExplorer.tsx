import React, { useState } from "react";
import { Terminal, Send, Copy, Check, Code, Play, RefreshCw, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

export interface ApiEndpointSpec {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  summary: string;
  category: "Properties" | "Tenants" | "Billing" | "Water Meters" | "Webhooks";
  defaultBody?: string;
  sampleResponse: Record<string, any>;
}

const API_ENDPOINTS: ApiEndpointSpec[] = [
  {
    id: "ep-01",
    method: "GET",
    path: "/api/v2/properties",
    summary: "List all property portfolios & unit occupancy counts",
    category: "Properties",
    sampleResponse: {
      status: 200,
      success: true,
      data: [
        { id: "prop-01", name: "Kilimani Heights", totalUnits: 48, occupiedUnits: 45, occupancyRate: "93.75%" },
        { id: "prop-02", name: "Lavington Crest", totalUnits: 24, occupiedUnits: 22, occupancyRate: "91.66%" },
      ],
      meta: { page: 1, limit: 10, total: 2 },
    },
  },
  {
    id: "ep-02",
    method: "POST",
    path: "/api/v2/billing/stk-push",
    summary: "Initiate M-Pesa STK Push rent prompt for tenant invoice",
    category: "Billing",
    defaultBody: JSON.stringify({ invoiceId: "inv-8842", phone: "254712345678", amountKES: 45000, accountRef: "APT-3B" }, null, 2),
    sampleResponse: {
      status: 200,
      MerchantRequestID: "29182-1029302-1",
      CheckoutRequestID: "ws_CO_310720260245001",
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Request accepted for processing",
    },
  },
  {
    id: "ep-03",
    method: "POST",
    path: "/api/v2/water/meter-readings",
    summary: "Submit utility meter reading for unit charge allocation",
    category: "Water Meters",
    defaultBody: JSON.stringify({ unitId: "u-102", previousReading: 1420, currentReading: 1458, ratePerM3: 180 }, null, 2),
    sampleResponse: {
      status: 201,
      readingId: "wmr-9941",
      consumptionM3: 38,
      totalChargeKES: 6840,
      invoiceGenerated: true,
    },
  },
  {
    id: "ep-04",
    method: "GET",
    path: "/api/v2/tenants",
    summary: "Query active tenant directory with lease status",
    category: "Tenants",
    sampleResponse: {
      status: 200,
      count: 142,
      tenants: [
        { id: "ten-01", fullName: "James Makena", unit: "3B - Kilimani Heights", rentDueDay: 5, balanceDue: 0 },
      ],
    },
  },
];

export function RestApiExplorer({ className }: { className?: string }) {
  const [selectedEndpointId, setSelectedEndpointId] = useState(API_ENDPOINTS[0].id);
  const [requestBody, setRequestBody] = useState(API_ENDPOINTS[0].defaultBody || "");
  const [activeTab, setActiveTab] = useState<"params" | "body" | "headers">("params");
  const [executing, setExecuting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(API_ENDPOINTS[0].sampleResponse);
  const [copied, setCopied] = useState(false);

  const endpoint = API_ENDPOINTS.find((e) => e.id === selectedEndpointId) || API_ENDPOINTS[0];

  const handleSelectEndpoint = (id: string) => {
    setSelectedEndpointId(id);
    const ep = API_ENDPOINTS.find((e) => e.id === id);
    if (ep) {
      setRequestBody(ep.defaultBody || "");
      setLastResponse(ep.sampleResponse);
    }
  };

  const handleExecuteRequest = () => {
    setExecuting(true);
    setTimeout(() => {
      setExecuting(false);
      setLastResponse(endpoint.sampleResponse);
    }, 400);
  };

  const handleCopyCurl = () => {
    const curlStr = `curl -X ${endpoint.method} "https://www.calqulus.site${endpoint.path}" \\\n  -H "Authorization: Bearer clq_live_99a8f7e6d5" \\\n  -H "Content-Type: application/json"${endpoint.defaultBody ? ` \\\n  -d '${endpoint.defaultBody.replace(/\n/g, "")}'` : ""}`;
    navigator.clipboard.writeText(curlStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Interactive REST API Explorer & Runner</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Test live platform API endpoints, view request payloads, and generate cURL commands.
          </CardDescription>
        </div>

        <Button size="sm" variant="outline" onClick={handleCopyCurl} className="h-8 text-xs font-semibold gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied cURL" : "Copy cURL Command"}
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* Endpoint Selector Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <Select value={selectedEndpointId} onValueChange={handleSelectEndpoint}>
            <SelectTrigger className="h-9 text-xs font-mono font-bold w-full md:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {API_ENDPOINTS.map((ep) => (
                <SelectItem key={ep.id} value={ep.id} className="text-xs font-mono">
                  <span className={cn(
                    "font-bold mr-2 px-1.5 py-0.5 rounded text-[10px]",
                    ep.method === "GET" && "bg-blue-500/10 text-blue-600",
                    ep.method === "POST" && "bg-success/10 text-success",
                    ep.method === "PUT" && "bg-warning/10 text-warning",
                    ep.method === "DELETE" && "bg-red-500/10 text-red-600"
                  )}>
                    {ep.method}
                  </span>
                  {ep.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 flex items-center gap-2 bg-muted/30 border p-1 rounded-lg">
            <Badge
              className={cn(
                "text-[10px] font-mono font-bold h-6 px-2 shrink-0",
                endpoint.method === "GET" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                endpoint.method === "POST" && "bg-success/10 text-success border-success/20"
              )}
            >
              {endpoint.method}
            </Badge>
            <span className="font-mono text-xs font-bold text-foreground truncate">{endpoint.path}</span>
          </div>

          <Button
            size="sm"
            onClick={handleExecuteRequest}
            disabled={executing}
            className="h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shrink-0"
          >
            {executing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {executing ? "Executing..." : "Send Request"}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground font-medium">{endpoint.summary}</p>

        {/* Request / Response Split Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Request Config Box */}
          <div className="p-3 border rounded-xl bg-card space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Code className="h-4 w-4 text-primary" /> Request Payload & Headers
              </span>
              <div className="flex gap-1 text-[11px]">
                <button
                  onClick={() => setActiveTab("params")}
                  className={cn("px-2 py-0.5 rounded font-bold", activeTab === "params" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  Headers
                </button>
                <button
                  onClick={() => setActiveTab("body")}
                  className={cn("px-2 py-0.5 rounded font-bold", activeTab === "body" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  Body (JSON)
                </button>
              </div>
            </div>

            {activeTab === "params" ? (
              <div className="space-y-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-muted/40 flex justify-between">
                  <span className="text-muted-foreground">Authorization</span>
                  <span className="text-foreground">Bearer clq_live_99a8f7e6d5</span>
                </div>
                <div className="p-2 rounded bg-muted/40 flex justify-between">
                  <span className="text-muted-foreground">Content-Type</span>
                  <span className="text-foreground">application/json</span>
                </div>
                <div className="p-2 rounded bg-muted/40 flex justify-between">
                  <span className="text-muted-foreground">X-Calqulus-Tenant-Id</span>
                  <span className="text-foreground">ACME-KE</span>
                </div>
              </div>
            ) : (
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder="JSON payload body..."
                className="w-full h-44 p-2 font-mono text-[11px] bg-muted/30 rounded border resize-none focus:outline-none"
              />
            )}
          </div>

          {/* Response Viewer Box */}
          <div className="p-3 border rounded-xl bg-navy-deep text-slate-100 font-mono space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> 200 OK Response
              </span>
              <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                JSON • 28ms
              </Badge>
            </div>

            <pre className="text-[11px] h-44 overflow-y-auto p-1 leading-relaxed text-slate-300">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
