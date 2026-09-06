import React, { useState } from "react";
import { Grid, Terminal, Webhook, ShieldCheck, BookOpen, Layers, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { RestApiExplorer } from "./RestApiExplorer";
import { WebhookManager } from "./WebhookManager";
import { OAuthSsoConfig } from "./OAuthSsoConfig";
import { DeveloperPortal } from "./DeveloperPortal";
import { IntegrationMarketplace } from "./IntegrationMarketplace";
import { cn } from "@/shared/lib/utils";

export function EcosystemHub({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("marketplace");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Banner */}
      <div className="p-4 rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Enterprise Ecosystem & Integration Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect property management operations with M-Pesa, QuickBooks, KRA eTIMS, SSO, and custom REST API webhooks.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 p-1 bg-muted/40 border flex-wrap">
          <TabsTrigger value="marketplace" className="text-xs font-bold gap-1.5">
            <Grid className="h-3.5 w-3.5" /> Marketplace
          </TabsTrigger>
          <TabsTrigger value="rest" className="text-xs font-bold gap-1.5">
            <Terminal className="h-3.5 w-3.5" /> REST API Explorer
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="text-xs font-bold gap-1.5">
            <Webhook className="h-3.5 w-3.5" /> Webhooks & DLQ
          </TabsTrigger>
          <TabsTrigger value="sso" className="text-xs font-bold gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> OAuth & SSO
          </TabsTrigger>
          <TabsTrigger value="devportal" className="text-xs font-bold gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Developer Portal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="m-0">
          <IntegrationMarketplace />
        </TabsContent>

        <TabsContent value="rest" className="m-0">
          <RestApiExplorer />
        </TabsContent>

        <TabsContent value="webhooks" className="m-0">
          <WebhookManager />
        </TabsContent>

        <TabsContent value="sso" className="m-0">
          <OAuthSsoConfig />
        </TabsContent>

        <TabsContent value="devportal" className="m-0">
          <DeveloperPortal />
        </TabsContent>
      </Tabs>
    </div>
  );
}
