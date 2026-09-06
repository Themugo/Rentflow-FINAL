import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Download, X, Monitor, Zap, Wifi, Bell, Shield } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const DesktopInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Detect if desktop (Windows/Mac) and Chrome/Edge
    const isDesktop = !/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isChromium = /Chrome|Chromium|Edg/i.test(navigator.userAgent) && !/Firefox|Safari/i.test(navigator.userAgent);
    const isSafariOnly = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium/i.test(navigator.userAgent);
    
    // Show banner only on desktop Chrome/Edge (not Safari-only)
    const shouldShow = isDesktop && isChromium && !isSafariOnly;

    if (!shouldShow) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsVisible(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-gradient-to-br from-primary/5 via-card to-card border border-primary/20 rounded-2xl shadow-2xl p-5 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-primary/10">
              <Monitor className="h-6 w-6 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 bg-success rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Zap className="h-3 w-3 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-base text-foreground">Install CALQULUS PMS Desktop App</h4>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Get faster access and a native app experience on your computer
            </p>
            
            {/* Feature badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 rounded-full">
                <Wifi className="h-3 w-3 text-success" />
                <span className="text-xs font-medium text-success dark:text-success">Works Offline</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full">
                <Bell className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary dark:text-primary">Notifications</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full">
                <Shield className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">Secure</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-4">
              <Button size="sm" onClick={handleInstallClick} className="h-9 shadow-lg px-4">
                <Download className="h-4 w-4 mr-2" />
                Install Now
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-9 text-muted-foreground hover:text-foreground">
                Maybe later
              </Button>
            </div>
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss"
            className="h-7 w-7 -mt-1 -mr-1 text-muted-foreground hover:text-foreground rounded-full"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
