import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Loader2, Wallet, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthContext";

interface EWalletSettingsData {
  id?: string;
  provider: string;
  wallet_id: string;
  wallet_phone: string;
  wallet_name: string;
  is_enabled: boolean;
  instructions: string;
}

const defaultSettings: EWalletSettingsData = {
  provider: "",
  wallet_id: "",
  wallet_phone: "",
  wallet_name: "",
  is_enabled: false,
  instructions: "",
};

const walletProviders = [
  { value: "airtel_money", label: "Airtel Money" },
  { value: "t_kash", label: "T-Kash (Telkom)" },
  { value: "equitel", label: "Equitel Money" },
  { value: "pesalink", label: "PesaLink" },
  { value: "paypal", label: "PayPal" },
  { value: "skrill", label: "Skrill" },
  { value: "other", label: "Other" },
];

interface Props { propertyId?: string; propertyName?: string }

export const EWalletSettings = ({ propertyId, propertyName }: Props = {}) => {
  const { toast } = useToast();
  const { user, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EWalletSettingsData>(defaultSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!isManager || !user) {
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from("manager_ewallet_settings")
          .select("*")
          .eq("manager_user_id", user.id);
        query = propertyId ? query.eq("property_id", propertyId) : query.is("property_id", null);
        const { data, error } = await query.maybeSingle();

        if (error) throw error;

        if (data) {
          setSettings({
            id: data.id,
            provider: data.provider || "",
            wallet_id: data.wallet_id || "",
            wallet_phone: data.wallet_phone || "",
            wallet_name: data.wallet_name || "",
            is_enabled: data.is_enabled,
            instructions: data.instructions || "",
          });
        } else {
          setSettings(defaultSettings);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, user?.id, propertyId]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const payload: TablesInsert<"manager_ewallet_settings"> = {
        manager_user_id: user.id,
        property_id: propertyId ?? null,
        provider: settings.provider,
        wallet_id: settings.wallet_id || null,
        wallet_phone: settings.wallet_phone || null,
        wallet_name: settings.wallet_name || null,
        is_enabled: settings.is_enabled,
        instructions: settings.instructions || null,
      };

      const { data, error } = await supabase.rpc('save_manager_ewallet_settings_atomic', {
        p_payload: { ...payload, id: settings.id || null },
      });
      if (error) throw error;
      if (!settings.id) setSettings((prev) => ({ ...prev, id: data }));

      toast({
        title: "Settings Saved",
        description: "Your e-wallet settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save e-wallet settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isManager) return null;

  return (
    <Card className="card-shadow animate-fade-in">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          E-Wallet Settings
        </CardTitle>
        <CardDescription>
          Configure an e-wallet payment option for your tenants
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-400/12 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Enable E-Wallet Payments</p>
                  <p className="text-sm text-muted-foreground">
                    Allow tenants to pay via e-wallet
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, is_enabled: checked }))
                }
              />
            </div>

            {settings.is_enabled && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  E-Wallet payment option will be shown to tenants
                </span>
              </div>
            )}

            {/* Provider */}
            <div className="space-y-2">
              <Label>Wallet Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(value) =>
                  setSettings((prev) => ({ ...prev, provider: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {walletProviders.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Wallet Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="walletName">Account Name</Label>
                <Input
                  id="walletName"
                  value={settings.wallet_name}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, wallet_name: e.target.value }))
                  }
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="walletPhone">Wallet Phone Number</Label>
                <Input
                  id="walletPhone"
                  value={settings.wallet_phone}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, wallet_phone: e.target.value }))
                  }
                  placeholder="e.g. 0712345678"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletId">Wallet ID / Account Number</Label>
              <Input
                id="walletId"
                value={settings.wallet_id}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, wallet_id: e.target.value }))
                }
                placeholder="Optional wallet identifier"
              />
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label htmlFor="walletInstructions">Payment Instructions for Tenants</Label>
              <Textarea
                id="walletInstructions"
                value={settings.instructions}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, instructions: e.target.value }))
                }
                placeholder="e.g. Send money to 0712345678 via Airtel Money and use your unit number as reference."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be displayed to tenants when they choose e-wallet payment
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save E-Wallet Settings
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
