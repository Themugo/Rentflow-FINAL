import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import type { BeforeInstallPromptEvent } from "@/shared/types/pwa";
import { Download, X, Share, MoreVertical, Zap, Wifi, Bell } from "lucide-react";


export const MobileInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem("pwa-mobile-install-dismissed");
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Detect Android
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    setIsAndroid(isAndroidDevice);

    // Only show on mobile devices
    if (!isIOSDevice && !isAndroidDevice) return;

    // For iOS, show banner immediately since there's no install prompt event
    if (isIOSDevice) {
      setTimeout(() => setIsVisible(true), 1500);
      return;
    }

    // For Android, wait for the install prompt
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

    // Show banner for Android even without prompt (manual instructions)
    if (isAndroidDevice) {
      setTimeout(() => setIsVisible(true), 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem("pwa-mobile-install-dismissed", "true");
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5 fade-in duration-500 safe-area-inset-bottom">
      <div className="bg-gradient-to-br from-primary/5 via-card to-card border-t border-primary/20 shadow-2xl p-4 mx-3 mb-3 rounded-2xl backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-primary/20">
              <img src="/pwa-192x192.png" alt="CALQULUS PMS" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
              <Zap className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-foreground text-base">Get the CALQULUS PMS App</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {isIOS 
                ? "Add to your Home Screen for the best experience" 
                : "Install for lightning-fast access"
              }
            </p>
            
            {/* Feature highlights */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wifi className="h-3 w-3 text-success" />
                <span>Offline</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Bell className="h-3 w-3 text-primary" />
                <span>Alerts</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                <span>Fast</span>
              </div>
            </div>
            
            {isIOS ? (
              <div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 rounded-lg">
                <Share className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-xs text-foreground">Tap Share → "Add to Home Screen"</span>
              </div>
            ) : deferredPrompt ? (
              <Button size="sm" onClick={handleInstallClick} className="h-9 mt-3 w-full sm:w-auto shadow-lg">
                <Download className="h-4 w-4 mr-2" />
                Install Free
              </Button>
            ) : (
              <div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 rounded-lg">
                <MoreVertical className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-xs text-foreground">Tap Menu → "Install app"</span>
              </div>
            )}
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss"
            className="h-8 w-8 -mt-1 -mr-1 text-muted-foreground hover:text-foreground rounded-full"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
