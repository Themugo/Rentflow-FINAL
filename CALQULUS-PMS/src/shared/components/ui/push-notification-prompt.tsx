import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Bell, BellOff, X, Sparkles } from "lucide-react";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";
import { useAuth } from "@/features/auth/AuthContext";

export const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
  } = usePushNotifications();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    const dismissed = localStorage.getItem("push-notification-dismissed");
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Only show if supported, user is logged in, and not already subscribed
    if (isSupported && user && permission !== "denied" && !isSubscribed) {
      // Delay showing the prompt to not overwhelm users
      const timer = setTimeout(() => setIsVisible(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, user?.id, permission, isSubscribed]);

  const handleEnable = async () => {
    if (permission === "default") {
      const granted = await requestPermission();
      if (granted) {
        await subscribe();
        setIsVisible(false);
      }
    } else if (permission === "granted") {
      await subscribe();
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem("push-notification-dismissed", "true");
  };

  if (!isVisible || isDismissed || !user) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top-5 fade-in duration-300">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-xl shadow-xl p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 animate-pulse">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-foreground">Stay Updated</h4>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Get instant alerts for payments, maintenance updates, and important notices
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleEnable} 
                disabled={isLoading}
                className="h-8 btn-brand"
              >
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                {isLoading ? "Enabling..." : "Enable"}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleDismiss} 
                className="h-8 text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </Button>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss"
            className="h-6 w-6 -mt-1 -mr-1 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const NotificationSettingsCard = () => {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <BellOff className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">Push Notifications</p>
            <p className="text-xs text-muted-foreground">Not supported on this device</p>
          </div>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      if (permission === "default") {
        const granted = await requestPermission();
        if (granted) {
          await subscribe();
        }
      } else if (permission === "granted") {
        await subscribe();
      }
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
          isSubscribed ? "bg-primary/10" : "bg-muted"
        }`}>
          {isSubscribed ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">Push Notifications</p>
          <p className="text-xs text-muted-foreground">
            {permission === "denied" 
              ? "Blocked in browser settings" 
              : isSubscribed 
                ? "Receiving notifications" 
                : "Enable to stay updated"
            }
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={isSubscribed ? "outline" : "default"}
        onClick={handleToggle}
        disabled={isLoading || permission === "denied"}
      >
        {isLoading ? "..." : isSubscribed ? "Disable" : "Enable"}
      </Button>
    </div>
  );
};
