import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthContext";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bell, 
  BellOff, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  RefreshCw, 
  Smartphone, 
  Laptop, 
  Mail, 
  MessageSquare, 
  ShieldCheck, 
  Clock, 
  Loader2,
  Sparkles,
  CreditCard,
  Wrench,
  FileText
} from "lucide-react";

export const PushNotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocalNotification,
    checkSubscription,
  } = usePushNotifications();

  const [savingPreferences, setSavingPreferences] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);

  // Channel & Topic Notification Preferences
  const [preferences, setPreferences] = useState({
    notifyPush: true,
    notifyEmail: true,
    notifySms: true,
    notifyWhatsapp: false,
    topicPayments: true,
    topicMaintenance: true,
    topicLeases: true,
    topicSecurity: true,
  });

  const [loadingPrefs, setLoadingPrefs] = useState(true);

  // Fetch saved preferences from manager_notification_settings
  useEffect(() => {
    const fetchNotificationPreferences = async () => {
      if (!user) {
        setLoadingPrefs(false);
        return;
      }
      try {
        const result = await (supabase
          .from("manager_notification_settings" as never)
          .select("notify_email, notify_sms, notify_whatsapp, notify_push, notify_payments, notify_maintenance, notify_leases, notify_security")
          .eq("manager_user_id", user.id)
          .maybeSingle()) as unknown as { 
            data: { 
              notify_email?: boolean; 
              notify_sms?: boolean; 
              notify_whatsapp?: boolean; 
              notify_push?: boolean;
              notify_payments?: boolean;
              notify_maintenance?: boolean;
              notify_leases?: boolean;
              notify_security?: boolean;
            } | null; 
            error: unknown 
          };

        if (result.data) {
          setPreferences({
            notifyEmail: result.data.notify_email ?? true,
            notifySms: result.data.notify_sms ?? true,
            notifyWhatsapp: result.data.notify_whatsapp ?? false,
            notifyPush: result.data.notify_push ?? true,
            topicPayments: result.data.notify_payments ?? true,
            topicMaintenance: result.data.notify_maintenance ?? true,
            topicLeases: result.data.notify_leases ?? true,
            topicSecurity: result.data.notify_security ?? true,
          });
        }
      } catch (err) {
        // Fall back to default preferences if table or record doesn't exist yet
      } finally {
        setLoadingPrefs(false);
      }
    };

    fetchNotificationPreferences();
  }, [user]);

  // Master Toggle for Push Notifications
  const handleMasterPushToggle = async () => {
    if (!isSupported) {
      toast({
        title: "Push Unsupported",
        description: "Web push notifications are not supported by this browser or platform.",
        variant: "destructive",
      });
      return;
    }

    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        setPreferences((prev) => ({ ...prev, notifyPush: false }));
      }
    } else {
      if (permission === "denied") {
        toast({
          title: "Push Notifications Blocked",
          description: "Permissions are blocked in your browser. Please allow notifications in site settings.",
          variant: "destructive",
        });
        return;
      }

      let granted = permission === "granted";
      if (permission === "default") {
        granted = await requestPermission();
      }

      if (granted) {
        const success = await subscribe();
        if (success) {
          setPreferences((prev) => ({ ...prev, notifyPush: true }));
        }
      }
    }
  };

  // Trigger immediate test notification
  const handleSendTestPush = async () => {
    setTestingNotification(true);
    try {
      if (permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) {
          toast({
            title: "Permission Needed",
            description: "Browser notification permission is required to receive test alerts.",
            variant: "destructive",
          });
          setTestingNotification(false);
          return;
        }
      }

      // Show local notification immediately via ServiceWorker or Notification API
      showLocalNotification("CALQULUS PMS — Test Alert", {
        body: "Web Push Notifications are active! You will receive instant updates for payments, maintenance, and lease events.",
        icon: "/pwa-192x192.png",
        tag: "test-notification-" + Date.now(),
      });

      toast({
        title: "Test Alert Dispatched",
        description: "A test notification was triggered on your current device.",
      });
    } catch (err) {
      toast({
        title: "Test Alert Failed",
        description: "Could not deliver test notification. Check browser settings.",
        variant: "destructive",
      });
    } finally {
      setTestingNotification(false);
    }
  };

  // Save Channel & Topic Preferences to DB
  const handleSavePreferences = async () => {
    if (!user) return;
    setSavingPreferences(true);
    try {
      const { error } = await supabase.rpc('save_manager_notification_settings_atomic', {
        p_payload: {
          notify_email: preferences.notifyEmail,
          notify_sms: preferences.notifySms,
          notify_whatsapp: preferences.notifyWhatsapp,
        },
      });
      if (error) throw error;

      toast({
        title: "Preferences Saved",
        description: "Your notification channels and topic subscriptions have been updated.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save notification settings.",
        variant: "destructive",
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  // Detect current browser / platform info for device card
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = "Web Browser";
    if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("Chrome")) browser = "Google Chrome";
    else if (ua.includes("Safari")) browser = "Apple Safari";
    else if (ua.includes("Edge")) browser = "Microsoft Edge";

    let os = "Desktop Device";
    if (ua.includes("Android")) os = "Android Mobile";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS Device";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Windows")) os = "Windows PC";
    else if (ua.includes("Linux")) os = "Linux PC";

    return { browser, os };
  };

  const deviceInfo = getDeviceInfo();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Main Push Notification Enable Panel */}
      <Card className="card-shadow border-amber-400/20 bg-gradient-to-br from-card via-card to-amber-500/5">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center transition-colors ${
                isSubscribed 
                  ? "bg-amber-400/20 text-warning" 
                  : permission === "denied" 
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              }`}>
                {isSubscribed ? (
                  <Bell className="h-6 w-6 text-warning animate-bounce" />
                ) : (
                  <BellOff className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="font-heading text-lg sm:text-xl">
                    Push Notifications
                  </CardTitle>
                  {isSubscribed && (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </Badge>
                  )}
                  {permission === "denied" && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" /> Blocked
                    </Badge>
                  )}
                  {!isSubscribed && permission !== "denied" && (
                    <Badge variant="secondary" className="text-xs">
                      Disabled
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  Receive real-time alerts directly on your desktop or mobile browser
                </CardDescription>
              </div>
            </div>

            <Button
              onClick={handleMasterPushToggle}
              disabled={isLoading || !isSupported}
              className={isSubscribed ? "bg-muted hover:bg-muted/80 text-foreground" : "btn-brand"}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : isSubscribed ? (
                <BellOff className="h-4 w-4 mr-2" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              {isLoading ? "Updating..." : isSubscribed ? "Disable Push" : "Enable Push Notifications"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {permission === "denied" && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Browser Permission Denied</p>
                <p className="mt-0.5 opacity-90">
                  Notifications are blocked for this website. Click the lock/tune icon near your browser address bar to set Notification permissions to "Allow", then refresh.
                </p>
              </div>
            </div>
          )}

          {!isSupported && (
            <div className="p-3.5 bg-muted rounded-lg text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
              <span>Web push notifications are not supported on this browser version.</span>
            </div>
          )}

          {isSubscribed && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card border rounded-lg text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-warning" />
                <span>Device is registered for instant web push dispatch.</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTestPush}
                disabled={testingNotification}
                className="h-8 text-xs gap-1.5"
              >
                {testingNotification ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-warning" />
                )}
                Send Test Alert
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Topic Subscriptions & Alert Categories */}
      <Card className="card-shadow">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <CardTitle className="font-heading text-base sm:text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Notification Topics
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Choose which events trigger instant alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {loadingPrefs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Rent & Payment Events</p>
                    <p className="text-xs text-muted-foreground">
                      Instant alerts when rent payments, M-Pesa STK pushes, or bank transactions settle
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.topicPayments}
                  onCheckedChange={(checked) => setPreferences((p) => ({ ...p, topicPayments: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Maintenance & Work Orders</p>
                    <p className="text-xs text-muted-foreground">
                      Updates on new repair tickets, contractor assignments, and completion notices
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.topicMaintenance}
                  onCheckedChange={(checked) => setPreferences((p) => ({ ...p, topicMaintenance: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-navy-mid/10 text-navy-mid flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Leases & Tenant Onboarding</p>
                    <p className="text-xs text-muted-foreground">
                      Alerts for tenant invite acceptances, lease expirations, and vacation notices
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.topicLeases}
                  onCheckedChange={(checked) => setPreferences((p) => ({ ...p, topicLeases: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Security & System Alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Critical security events, rate limit breaches, and system status updates
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.topicSecurity}
                  onCheckedChange={(checked) => setPreferences((p) => ({ ...p, topicSecurity: checked }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Delivery Channels */}
      <Card className="card-shadow">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <CardTitle className="font-heading text-base sm:text-lg">Delivery Channels</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Manage which communication methods deliver your notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Email Delivery</p>
                  <p className="text-xs text-muted-foreground">Receive detailed PDF invoices and summaries by email</p>
                </div>
              </div>
              <Switch
                checked={preferences.notifyEmail}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, notifyEmail: checked }))}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">SMS Delivery</p>
                  <p className="text-xs text-muted-foreground">Send/receive urgent SMS reminders via Africa's Talking gateway</p>
                </div>
              </div>
              <Switch
                checked={preferences.notifySms}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, notifySms: checked }))}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">WhatsApp Delivery</p>
                  <p className="text-xs text-muted-foreground">Send automated receipt links & reminders via WhatsApp API</p>
                </div>
              </div>
              <Switch
                checked={preferences.notifyWhatsapp}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, notifyWhatsapp: checked }))}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSavePreferences}
              disabled={savingPreferences}
              size="sm"
              className="btn-brand"
            >
              {savingPreferences && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Notification Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Registered Device Context */}
      <Card className="card-shadow bg-muted/30">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="font-heading text-sm text-muted-foreground flex items-center gap-2">
            <Laptop className="h-4 w-4" />
            Current Device Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-medium text-foreground">{deviceInfo.browser} ({deviceInfo.os})</p>
              <p className="text-muted-foreground">
                Push Permission: <span className="font-mono text-foreground">{permission}</span> | Subscription: <span className="font-mono text-foreground">{isSubscribed ? "Active" : "Inactive"}</span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkSubscription}
              className="h-8 text-xs gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className="h-3 w-3" />
              Sync Device Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
