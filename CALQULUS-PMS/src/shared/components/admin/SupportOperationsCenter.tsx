import React, { useState } from "react";
import { UserCheck, ShieldAlert, Search, Eye, AlertTriangle, KeyRound, CheckCircle2, LifeBuoy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function SupportOperationsCenter({ className }: { className?: string }) {
  const [impersonatingUser, setImpersonatingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Support Operations & Audit-Logged Impersonation</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Lookup customer records and safely initiate temporary permission-gated support sessions.
          </CardDescription>
        </div>

        {impersonatingUser && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 font-bold text-xs gap-1 py-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Impersonating: {impersonatingUser}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl space-y-1.5 text-xs">
          <span className="font-bold text-warning flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Support Session Notice
          </span>
          <p className="text-muted-foreground">
            A backend audit-logged impersonation service is not yet implemented. The session control below is illustrative and does not currently open a real impersonated session or write to the audit trail. Production impersonation must be backed by a server-side service that tags actions with the originating admin ID.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search agency manager or tenant email to initiate support session..."
              className="pl-8 text-xs h-9"
            />
          </div>
          <Button
            size="sm"
            onClick={() => setImpersonatingUser(searchTerm || "jimmythemugo@gmail.com")}
            className="h-9 text-xs font-bold gap-1 bg-primary text-primary-foreground"
          >
            <UserCheck className="h-3.5 w-3.5" /> Start Audited Support Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
