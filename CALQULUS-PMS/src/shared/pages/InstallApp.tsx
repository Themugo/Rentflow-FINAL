import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Download, Smartphone, CheckCircle, Share, Plus, MoreVertical, QrCode, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/shared/hooks/use-toast";
import { downloadQrCodeAsPng } from "@/shared/lib/downloadQrCode";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallApp = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleCopyUrl = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      toast({ title: "Application URL copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy URL", variant: "destructive" });
    }
  };

  const handleDownloadQrCode = () => {
    const success = downloadQrCodeAsPng("install-app-qr-code", "calqulus-rms-app-qr.png");
    if (success) {
      toast({ title: "QR code downloaded as PNG!" });
    } else {
      toast({ title: "Failed to download QR code", variant: "destructive" });
    }
  };

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Detect Android
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    setIsAndroid(isAndroidDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
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
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="font-heading">App Installed!</CardTitle>
            <CardDescription>
              CALQULUS PMS has been installed on your device. You can now access it from your home screen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Open App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-400/15 to-background pt-safe-top pt-8 sm:pt-12 pb-6 sm:pb-8 px-4 text-center">
        <div className="mx-auto mb-3 sm:mb-4 h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden shadow-lg">
          <img src="/pwa-192x192.png" alt="CALQULUS PMS" className="h-full w-full object-cover" />
        </div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">CALQULUS PMS</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Property Management</p>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Install Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install the App
            </CardTitle>
            <CardDescription>
              Get the full app experience with offline access and quick launch from your home screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deferredPrompt ? (
              <Button onClick={handleInstallClick} className="w-full" size="lg">
                <Download className="mr-2 h-5 w-5" />
                Install CALQULUS PMS
              </Button>
            ) : isIOS ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To install on your iPhone or iPad:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-full bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <Share className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">1. Tap the Share button</p>
                      <p className="text-xs text-muted-foreground">At the bottom of Safari</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-full bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <Plus className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">2. Select "Add to Home Screen"</p>
                      <p className="text-xs text-muted-foreground">Scroll down in the share menu</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">3. Tap "Add"</p>
                      <p className="text-xs text-muted-foreground">The app will appear on your home screen</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : isAndroid ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To install on your Android device:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-full bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <MoreVertical className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">1. Tap the menu button</p>
                      <p className="text-xs text-muted-foreground">Three dots in Chrome's toolbar</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-full bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <Download className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">2. Select "Install app" or "Add to Home screen"</p>
                      <p className="text-xs text-muted-foreground">In the dropdown menu</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10">
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">3. Confirm installation</p>
                      <p className="text-xs text-muted-foreground">The app will be added to your home screen</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Visit this page on your mobile device to install the app.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-warning" />
              Scan or Share App Link
            </CardTitle>
            <CardDescription>
              Scan this QR code on a mobile device or copy the application link below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-white rounded-xl shadow-sm border border-border flex flex-col items-center justify-center gap-3">
              {appUrl ? (
                <>
                  <QRCodeSVG
                    id="install-app-qr-code"
                    value={appUrl}
                    size={180}
                    bgColor="#FFFFFF"
                    fgColor="#0F172A"
                    level="H"
                    includeMargin={false}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadQrCode}
                    className="w-full text-xs font-semibold gap-1.5 shadow-xs border-primary/20 text-primary hover:bg-primary/5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download QR Code (PNG)
                  </Button>
                </>
              ) : (
                <div className="h-[180px] w-[180px] flex items-center justify-center text-muted-foreground text-xs">
                  Loading QR code...
                </div>
              )}
            </div>

            <div className="w-full space-y-2">
              <p className="text-xs font-medium text-muted-foreground text-center">Application URL</p>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/60 border border-border/50">
                <span className="text-xs font-mono text-foreground truncate flex-1 px-1">
                  {appUrl || "Loading..."}
                </span>
                <Button
                  size="sm"
                  variant={copied ? "default" : "secondary"}
                  onClick={handleCopyUrl}
                  className="h-8 px-3 shrink-0 gap-1.5 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>App Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="text-sm">Works offline</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="text-sm">Fast loading from home screen</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="text-sm">Full-screen experience</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="text-sm">Manage properties on the go</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="text-sm">Pay rent with M-Pesa</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Continue to app */}
        <Button variant="outline" onClick={() => navigate("/")} className="w-full">
          Continue in Browser
        </Button>
      </div>
    </div>
  );
};

export default InstallApp;
