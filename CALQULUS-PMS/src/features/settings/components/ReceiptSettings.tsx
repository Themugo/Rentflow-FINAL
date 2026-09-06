import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { Loader2, Receipt, Palette, Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthContext";

interface ReceiptSettingsData {
  id?: string;
  auto_send_receipts: boolean;
  primary_color: string;
  secondary_color: string;
  footer_message: string;
  include_logo: boolean;
}

const defaultSettings: ReceiptSettingsData = {
  auto_send_receipts: true,
  // Brand primary blue (CALQULUS_COLOR.primary), not green — a payment
  // receipt is a financial document and money is never colored green
  // by default in this app.
  primary_color: "#356FE5",
  secondary_color: "#1e293b",
  footer_message: "Thank you for being a valued tenant!",
  include_logo: true,
};

export const ReceiptSettings = () => {
  const { toast } = useToast();
  const { user, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReceiptSettingsData>(defaultSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!isManager || !user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("receipt_settings")
          .select("*")
          .eq("manager_user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSettings({
            id: data.id,
            auto_send_receipts: data.auto_send_receipts,
            primary_color: data.primary_color || defaultSettings.primary_color,
            secondary_color: data.secondary_color || defaultSettings.secondary_color,
            footer_message: data.footer_message || defaultSettings.footer_message,
            include_logo: data.include_logo ?? defaultSettings.include_logo,
          });
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, user?.id]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('save_manager_receipt_settings_atomic', {
        p_payload: { ...settings, id: settings.id || null },
      });
      if (error) throw error;
      if (!settings.id) setSettings((prev) => ({ ...prev, id: data }));

      toast({
        title: "Settings Saved",
        description: "Your receipt settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save receipt settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isManager) {
    return null;
  }

  return (
    <Card className="card-shadow animate-fade-in" style={{ animationDelay: "200ms" }}>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Receipt Settings
        </CardTitle>
        <CardDescription>
          Customize your payment receipts and enable automatic email sending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Auto-send Receipts Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-400/12 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Auto-send Receipts</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically email receipts to tenants when payments are received
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.auto_send_receipts}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, auto_send_receipts: checked }))
                }
              />
            </div>

            {settings.auto_send_receipts && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  Receipts will be sent automatically when payments are confirmed
                </span>
              </div>
            )}

            {/* Branding Colors */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-medium">Branding Colors</Label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor" className="text-sm">
                    Primary Color (Success)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={settings.primary_color}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, primary_color: e.target.value }))
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={settings.primary_color}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, primary_color: e.target.value }))
                      }
                      placeholder="#22c55e"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor" className="text-sm">
                    Secondary Color (Header)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={settings.secondary_color}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, secondary_color: e.target.value }))
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={settings.secondary_color}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, secondary_color: e.target.value }))
                      }
                      placeholder="#1e293b"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Color Preview */}
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-3">Preview</p>
                <div className="flex items-center gap-4">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    ✓
                  </div>
                  <div
                    className="h-8 flex-1 rounded flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: settings.secondary_color }}
                  >
                    Receipt Header
                  </div>
                  <div
                    className="h-8 px-4 rounded flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    Amount Paid
                  </div>
                </div>
              </div>
            </div>

            {/* Include Logo Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium text-foreground">Include Company Logo</p>
                <p className="text-sm text-muted-foreground">
                  Display your company logo on receipt emails and PDFs
                </p>
              </div>
              <Switch
                checked={settings.include_logo}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, include_logo: checked }))
                }
              />
            </div>

            {/* Footer Message */}
            <div className="space-y-2">
              <Label htmlFor="footerMessage">Custom Footer Message</Label>
              <Textarea
                id="footerMessage"
                value={settings.footer_message}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, footer_message: e.target.value }))
                }
                placeholder="Thank you for being a valued tenant!"
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This message will appear at the bottom of receipt emails
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Receipt Settings
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
