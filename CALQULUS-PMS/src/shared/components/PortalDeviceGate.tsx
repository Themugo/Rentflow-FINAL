import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";

const DEVICE_KEY = "calqulus-portal-device-id";
function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID() + crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

export default function PortalDeviceGate({ children }: { children: React.ReactNode }) {
  const { user, userRole, devAccessEnabled } = useAuth();
  const [state, setState] = useState<"checking" | "active" | "blocked">("checking");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const deviceId = useMemo(() => getDeviceId(), []);

  const claim = async (authorizationCode?: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_portal_device_session_atomic", {
        p_device_id: deviceId,
        p_device_label: navigator.userAgent.slice(0, 120),
        p_authorization_code: authorizationCode || null,
      });
      if (error) throw error;
      if (data?.status === "active") { setState("active"); setReason(""); }
      else { setState("blocked"); setReason(data?.reason || "another_device_active"); }
    } catch (e: any) {
      setState("blocked"); setReason(e?.message || "Device authorization failed");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!user || !userRole || devAccessEnabled) { setState("active"); return; }
    void claim();
    const timer = window.setInterval(() => {
      void supabase.rpc("heartbeat_portal_device_session_atomic", { p_device_id: deviceId });
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
    // deviceId is stable for this browser installation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userRole?.role, devAccessEnabled]);

  if (state === "checking") return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (state === "active") return <>{children}</>;

  return <div className="min-h-[60vh] grid place-items-center p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <ShieldCheck className="h-10 w-10 mx-auto mb-2" />
        <CardTitle>This portal is active on another device</CardTitle>
        <CardDescription>CALQULUS allows one active device by default. Only an explicitly authorized person/device can open the same account elsewhere.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reason === "another_device_active" && <div className="rounded-lg border p-3 text-sm">If this is an authorized second device, enter the one-time authorization code generated from the active device.</div>}
        <div><label className="text-xs font-medium">Authorization code</label><Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="8-digit code" inputMode="numeric" /></div>
        <Button className="w-full" onClick={() => void claim(code)} disabled={busy || code.length !== 8}><Smartphone className="h-4 w-4 mr-2" />{busy ? "Authorizing…" : "Authorize this device"}</Button>
      </CardContent>
    </Card>
  </div>;
}
