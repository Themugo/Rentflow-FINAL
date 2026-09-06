import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import type { BeforeInstallPromptEvent } from "@/shared/types/pwa";
import { Download, X, Share, Smartphone, Zap } from "lucide-react";


export const TopMobileInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already installed in standalone mode
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if dismissed in localStorage (dismissed state persists)
    const dismissed = localStorage.getItem("pwa-top-install-banner-dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
      return;
    }

    // Detect mobile device
    const userAgent = navigator.userAgent || "";
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as { MSStream?: unknown }).MSStream;
    const isAndroidDevice = /Android/.test(userAgent);
    const isMobileWidth = window.innerWidth <= 768;

    const isMobile = isIOSDevice || isAndroidDevice || (isMobileWidth && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

    if (!isMobile) return;

    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      setIsVisible(true);
      return;
    }

    // Handle beforeinstallprompt for Android / Chrome Mobile
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

    // Default trigger for supported Android mobile browsers even before prompt fires
    if (isAndroidDevice) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide((prev) => !prev);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instructions if prompt event was captured or unavailable
      setShowIOSGuide((prev) => !prev);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem("pwa-top-install-banner-dismissed", "true");
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="w-full bg-gradient-to-r from-primary/15 via-primary/10 to-navy-mid/10 border-b border-primary/20 text-foreground px-3 py-2.5 sm:px-4 sm:py-3 transition-all animate-in slide-in-from-top-2 duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-md text-primary-foreground font-bold text-xs">
              <Smartphone className="h-5 w-5 text-slate-950" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-success rounded-full flex items-center justify-center ring-2 ring-background">
              <Zap className="h-2 w-2 text-slate-950 fill-slate-950" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-xs sm:text-sm truncate">
                Install CALQULUS PMS App
              </p>
              <span className="hidden xs:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary dark:text-primary rounded-full">
                Mobile
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              {isIOS
                ? "Tap Share → Add to Home Screen for fast mobile access"
                : "Install app for offline access & instant dashboard alerts"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="h-8 px-3 text-xs font-medium bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm"
          >
            {isIOS ? (
              <>
                <Share className="h-3.5 w-3.5 mr-1.5" />
                <span>Add App</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                <span>Install</span>
              </>
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
            title="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="mt-2.5 p-2.5 bg-background/80 backdrop-blur-md rounded-xl border border-primary/30 text-xs text-foreground flex items-center justify-between gap-2 max-w-7xl mx-auto animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Share className="h-4 w-4 text-primary flex-shrink-0" />
            <span>
              Tap <strong>Share</strong> in your browser menu, then select <strong>"Add to Home Screen"</strong>.
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowIOSGuide(false)}
            className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
          >
            Got it
          </Button>
        </div>
      )}
    </div>
  );
};
