import React, { useState, useEffect, useCallback } from "react";
import { Database, HardDrive, RefreshCw, Trash2, CheckCircle2, AlertCircle, Wifi, WifiOff, Layers, DownloadCloud, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";

interface CacheBucketInfo {
  name: string;
  itemCount: number;
  estimatedSizeFormatted: string;
}

export function CacheManagementSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swStatus, setSwStatus] = useState<"active" | "installing" | "unregistered" | "unsupported">("unsupported");
  const [swScope, setSwScope] = useState<string | null>(null);
  const [usageBytes, setUsageBytes] = useState<number>(0);
  const [quotaBytes, setQuotaBytes] = useState<number>(0);
  const [cacheBuckets, setCacheBuckets] = useState<CacheBucketInfo[]>([]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const checkCacheAndStorage = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Storage Manager Estimate
      if ("storage" in navigator && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setUsageBytes(estimate.usage || 0);
        setQuotaBytes(estimate.quota || 0);
      }

      // 2. Service Worker Check
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          const activeReg = regs[0];
          setSwScope(activeReg.scope);
          if (activeReg.active) {
            setSwStatus("active");
          } else if (activeReg.installing || activeReg.waiting) {
            setSwStatus("installing");
          } else {
            setSwStatus("unregistered");
          }
        } else {
          setSwStatus("unregistered");
        }
      } else {
        setSwStatus("unsupported");
      }

      // 3. Cache Storage Buckets
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        const bucketInfos: CacheBucketInfo[] = [];

        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          bucketInfos.push({
            name,
            itemCount: keys.length,
            estimatedSizeFormatted: `~${keys.length * 15} KB (${keys.length} cached assets)`,
          });
        }

        setCacheBuckets(bucketInfos);
      }
    } catch (err) {
      console.error("Failed to inspect PWA cache:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkCacheAndStorage();
  }, [checkCacheAndStorage]);

  const handleClearPwaCache = async () => {
    setClearing(true);
    try {
      let deletedCount = 0;

      // 1. Delete all CacheStorage buckets
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys.map(async (key) => {
            const success = await caches.delete(key);
            if (success) deletedCount++;
          })
        );
      }

      // 2. Unregister Service Workers to ensure fresh fetch
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }

      // 3. Refresh storage metrics
      await checkCacheAndStorage();

      toast({
        title: "PWA Cache Cleared Successfully",
        description: `Cleared ${deletedCount} cache storage bucket(s). Offline assets will be re-downloaded automatically as needed.`,
      });
    } catch (err) {
      toast({
        title: "Error Clearing Cache",
        description: err instanceof Error ? err.message : "Failed to purge offline assets.",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const usagePercentage = quotaBytes > 0 ? Math.min(100, Math.round((usageBytes / quotaBytes) * 100)) : 0;

  return (
    <Card className="card-shadow animate-fade-in border-border/80 bg-card">
      <CardHeader className="p-4 sm:p-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">Cache & Offline Asset Management</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Monitor progressive web app (PWA) storage size, offline asset status, and manage local cached bundles.
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={checkCacheAndStorage}
            disabled={loading}
            className="h-8 text-xs font-semibold gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-6 pt-3">
        {/* Network & Service Worker Status Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Network Status Card */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase text-muted-foreground block">Network Connectivity</span>
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                {isOnline ? (
                  <>
                    <Wifi className="h-4 w-4 text-success" /> Online Mode Active
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-warning" /> Offline Mode Active
                  </>
                )}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold h-5 px-2",
                isOnline ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
              )}
            >
              {isOnline ? "Connected" : "Offline"}
            </Badge>
          </div>

          {/* Service Worker Status Card */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase text-muted-foreground block">PWA Offline Engine</span>
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {swStatus === "active" && "Service Worker Active"}
                {swStatus === "installing" && "Service Worker Syncing"}
                {swStatus === "unregistered" && "Standby / Web Fallback"}
                {swStatus === "unsupported" && "Browser Restricted"}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold h-5 px-2 capitalize",
                swStatus === "active" && "bg-success/10 text-success border-success/20",
                swStatus === "installing" && "bg-warning/10 text-warning border-warning/20",
                (swStatus === "unregistered" || swStatus === "unsupported") && "bg-muted text-muted-foreground"
              )}
            >
              {swStatus}
            </Badge>
          </div>
        </div>

        {/* Storage Quota Usage Meter */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4 text-primary" /> Total Allocated Storage Usage
            </span>
            <span className="text-primary font-mono">{formatBytes(usageBytes)}</span>
          </div>

          <Progress value={usagePercentage || 2} className="h-2.5 bg-muted" />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>Quota limit: {quotaBytes > 0 ? formatBytes(quotaBytes) : "Browser Controlled"}</span>
            <span>{usagePercentage}% used</span>
          </div>
        </div>

        {/* Offline Cache Buckets Breakdown */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-primary" /> Cached Asset Storage Buckets
          </h4>

          {cacheBuckets.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground space-y-1">
              <p>No active PWA cache buckets found.</p>
              <p className="text-[11px]">Static UI assets and app bundles will be cached as you navigate through pages.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cacheBuckets.map((bucket, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border border-border/80 bg-card flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block font-mono">{bucket.name}</span>
                    <span className="text-[11px] text-muted-foreground">{bucket.itemCount} items pre-cached</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {bucket.estimatedSizeFormatted}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Purge / Clear PWA Cache Action Bar */}
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-3 pt-4">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-foreground">Clear Local PWA Cache</h5>
              <p className="text-[11px] text-muted-foreground">
                Purges all cached offline app assets, static JS/CSS bundles, and API response caches stored in your browser. This forces a clean redownload of the latest web application assets on next load.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-destructive/10">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearPwaCache}
              disabled={clearing}
              className="text-xs font-bold gap-1.5"
            >
              {clearing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Clear PWA Cache
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
