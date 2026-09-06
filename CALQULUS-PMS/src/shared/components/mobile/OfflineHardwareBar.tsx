import React, { useState } from "react";
import {
  Wifi, WifiOff, RefreshCw, Camera, QrCode, MapPin, Bell, ShieldCheck, CheckCircle2, ScanLine, Smartphone, Zap
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export function OfflineHardwareBar({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(3);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gpsActive, setGpsActive] = useState(true);
  const [lastScannedQr, setLastScannedQr] = useState<string | null>(null);
  const [pushSent, setPushSent] = useState(false);

  const handleSyncNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setPendingSyncCount(0);
      setIsSyncing(false);
    }, 1000);
  };

  const handleSimulateScan = () => {
    const codes = ["METER-WM-9812", "UNIT-3B-LOCK-QR", "ASSET-AC-402", "LEASE-2026-SIGN"];
    const randomCode = codes[Math.floor(Math.random() * codes.length)];
    setLastScannedQr(randomCode);
  };

  const handleTriggerPush = () => {
    setPushSent(true);
    setTimeout(() => setPushSent(false), 2500);
  };

  return (
    <div className={cn("p-4 border rounded-2xl bg-card space-y-3 text-xs shadow-sm", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <div>
            <h4 className="font-bold text-foreground text-xs">Mobile Device Hardware & Offline Sync Status</h4>
            <p className="text-[10px] text-muted-foreground">Real-time status of PWA camera, QR reader, GPS geofencing & background sync.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1 rounded-full border">
            {isOnline ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-warning" />}
            <span className="font-bold text-[10px]">{isOnline ? "ONLINE" : "OFFLINE CACHE"}</span>
            <Switch checked={isOnline} onCheckedChange={setIsOnline} className="scale-75" />
          </div>

          <Button
            size="sm"
            onClick={handleSyncNow}
            disabled={isSyncing || pendingSyncCount === 0}
            className="h-7 text-[10px] font-bold gap-1 bg-primary text-primary-foreground"
          >
            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : `Sync Queue (${pendingSyncCount})`}
          </Button>
        </div>
      </div>

      {/* Hardware Sensors Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* GPS Sensor */}
        <div className="p-2.5 border rounded-xl bg-card flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin className={cn("h-3.5 w-3.5", gpsActive ? "text-success" : "text-muted-foreground")} />
            <div>
              <span className="font-bold text-[10px] text-foreground block">GPS Geofence</span>
              <span className="text-[9px] text-muted-foreground">-1.28638, 36.81722</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-none">
            Verified
          </Badge>
        </div>

        {/* QR / Barcode Scanner */}
        <div className="p-2.5 border rounded-xl bg-card flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5 text-primary" />
            <div>
              <span className="font-bold text-[10px] text-foreground block">Barcode Reader</span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">
                {lastScannedQr || "Ready"}
              </span>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={handleSimulateScan} className="h-6 w-6 p-0">
            <ScanLine className="h-3 w-3 text-primary" />
          </Button>
        </div>

        {/* Camera Sensor */}
        <div className="p-2.5 border rounded-xl bg-card flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-blue-500" />
            <div>
              <span className="font-bold text-[10px] text-foreground block">HD Camera</span>
              <span className="text-[9px] text-muted-foreground">EXIF Metadata</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[8px] bg-blue-500/10 text-blue-600 border-none">
            Active
          </Badge>
        </div>

        {/* Push Notifications */}
        <div className="p-2.5 border rounded-xl bg-card flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-warning" />
            <div>
              <span className="font-bold text-[10px] text-foreground block">FCM Push</span>
              <span className="text-[9px] text-muted-foreground">{pushSent ? "Alert Sent!" : "Subscribed"}</span>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={handleTriggerPush} className="h-6 text-[9px] font-bold px-1.5">
            Test
          </Button>
        </div>
      </div>
    </div>
  );
}
