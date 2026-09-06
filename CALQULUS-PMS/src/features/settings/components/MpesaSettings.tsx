// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { toast } from "@/shared/hooks/use-toast";
import { Loader2, Eye, EyeOff, CreditCard, Store, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";

// Public-safe settings that come from the edge function (no actual credentials)
interface MpesaSettingsPublic {
  id?: string;
  paybill_enabled: boolean;
  paybill_shortcode: string;
  paybill_account_reference: string;
  till_enabled: boolean;
  till_shortcode: string;
  is_live: boolean;
  // Indicates if credentials are configured without exposing actual values
  has_consumer_key: boolean;
  has_consumer_secret: boolean;
  has_paybill_passkey: boolean;
  has_till_passkey: boolean;
}

// Data sent to edge function for updates (credentials only sent when updating)
interface MpesaSettingsUpdate {
  paybill_enabled?: boolean;
  paybill_shortcode?: string;
  paybill_passkey?: string;
  paybill_account_reference?: string;
  till_enabled?: boolean;
  till_shortcode?: string;
  till_passkey?: string;
  consumer_key?: string;
  consumer_secret?: string;
  is_live?: boolean;
}

const defaultSettings: MpesaSettingsPublic = {
  paybill_enabled: false,
  paybill_shortcode: '',
  paybill_account_reference: '',
  till_enabled: false,
  till_shortcode: '',
  is_live: false,
  has_consumer_key: false,
  has_consumer_secret: false,
  has_paybill_passkey: false,
  has_till_passkey: false,
};

interface MpesaSettingsProps {
  /** When set, configures M-Pesa for this property only. Omit for company-wide default. */
  propertyId?: string | null;
  propertyName?: string;
}

async function fetchMpesaSettings(propertyId?: string | null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-mpesa-settings`;
  const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '?propertyId=default';
  const res = await fetch(`${base}${qs}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to load M-Pesa settings');
  }
  return res.json();
}

export const MpesaSettings = ({ propertyId, propertyName }: MpesaSettingsProps = {}) => {
  const { user } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const mpesaCallbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;
  const scopeLabel = propertyName
    ? `Property: ${propertyName}`
    : propertyId
      ? 'This property'
      : 'Company default (all properties without their own account)';
  const [settings, setSettings] = useState<MpesaSettingsPublic>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Credential input values (only for updating, not pre-filled)
  const [credentialInputs, setCredentialInputs] = useState({
    consumer_key: '',
    consumer_secret: '',
    paybill_passkey: '',
    till_passkey: '',
  });
  
  const [showSecrets, setShowSecrets] = useState({
    consumer_key: false,
    consumer_secret: false,
    paybill_passkey: false,
    till_passkey: false,
  });

  const fetchSettings = useCallback(async () => {
    try {
      const data = await fetchMpesaSettings(propertyId ?? null);
      if (data) setSettings(data);
    } catch {
      toast({ title: 'Failed to load M-Pesa settings', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchSettings();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fetchSettings]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const updateData: MpesaSettingsUpdate = {
        propertyId: propertyId ?? null,
        paybill_enabled: settings.paybill_enabled,
        paybill_shortcode: settings.paybill_shortcode || undefined,
        paybill_account_reference: settings.paybill_account_reference || undefined,
        till_enabled: settings.till_enabled,
        till_shortcode: settings.till_shortcode || undefined,
        is_live: settings.is_live,
      };

      // Only include credentials if user entered new values
      if (credentialInputs.consumer_key) {
        updateData.consumer_key = credentialInputs.consumer_key;
      }
      if (credentialInputs.consumer_secret) {
        updateData.consumer_secret = credentialInputs.consumer_secret;
      }
      if (credentialInputs.paybill_passkey) {
        updateData.paybill_passkey = credentialInputs.paybill_passkey;
      }
      if (credentialInputs.till_passkey) {
        updateData.till_passkey = credentialInputs.till_passkey;
      }

      const response = await supabase.functions.invoke('manage-mpesa-settings', {
        method: 'POST',
        body: updateData,
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.settings) {
        setSettings(response.data.settings);
        // Clear credential inputs after successful save
        setCredentialInputs({
          consumer_key: '',
          consumer_secret: '',
          paybill_passkey: '',
          till_passkey: '',
        });
      }

      toast({ title: 'M-Pesa settings saved successfully' });
    } catch (error) {
      toast({ title: 'Failed to save M-Pesa settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowSecret = (field: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const CredentialStatus = ({ isConfigured, label }: { isConfigured: boolean; label: string }) => (
    <div className="flex items-center gap-2">
      {isConfigured ? (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Configured
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-amber-50 text-warning border-amber-200">
          <XCircle className="h-3 w-3 mr-1" />
          Not Set
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );

  const renderCredentialInput = (
    label: string,
    field: keyof typeof credentialInputs,
    isConfigured: boolean,
    placeholder: string
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={field}>{label}</Label>
        <CredentialStatus isConfigured={isConfigured} label="" />
      </div>
      <div className="relative">
        <Input
          id={field}
          type={showSecrets[field] ? 'text' : 'password'}
          value={credentialInputs[field]}
          onChange={(e) => setCredentialInputs(prev => ({ ...prev, [field]: e.target.value }))}
          placeholder={isConfigured ? "Enter new value to update..." : placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={showSecrets[field] ? "Hide value" : "Show value"}
          className="absolute right-0 top-0 h-full"
          onClick={() => toggleShowSecret(field)}
        >
          {showSecrets[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {isConfigured && (
        <p className="text-xs text-muted-foreground">
          Leave empty to keep current value
        </p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          M-Pesa Payment Settings
        </CardTitle>
        <CardDescription>
          {scopeLabel} — M-Pesa Paybill / Till for tenant STK payments. Credentials stay on the server;
          each property can use a different Safaricom account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            To use M-Pesa payments, you need to register at{' '}
            <a 
              href="https://developer.safaricom.co.ke" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-warning underline"
            >
              Safaricom Daraja Portal
            </a>
            {' '}and create an app to get your API credentials.
          </AlertDescription>
        </Alert>

        {/* Environment Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label>Production Mode</Label>
            <p className="text-sm text-muted-foreground">
              {settings.is_live ? 'Using live M-Pesa API (real transactions)' : 'Using sandbox (test mode)'}
            </p>
          </div>
          <Switch
            checked={settings.is_live}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_live: checked }))}
          />
        </div>

        {/* API Credentials */}
        <div className="space-y-4">
          <h3 className="font-medium">Daraja API Credentials</h3>
          <p className="text-sm text-muted-foreground">
            These credentials are shared between Paybill and Till. Your credentials are stored securely and never exposed to your browser.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {renderCredentialInput(
              'Consumer Key', 
              'consumer_key', 
              settings.has_consumer_key, 
              'Your Daraja Consumer Key'
            )}
            {renderCredentialInput(
              'Consumer Secret', 
              'consumer_secret', 
              settings.has_consumer_secret, 
              'Your Daraja Consumer Secret'
            )}
          </div>
        </div>

        <Tabs defaultValue="paybill" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paybill" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Paybill
            </TabsTrigger>
            <TabsTrigger value="till" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Till (Buy Goods)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paybill" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Enable Paybill Payments</Label>
                <p className="text-sm text-muted-foreground">
                  Accept payments via M-Pesa Paybill
                </p>
              </div>
              <Switch
                checked={settings.paybill_enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, paybill_enabled: checked }))}
              />
            </div>

            {settings.paybill_enabled && (
              <div className="space-y-4 pl-4 border-l-2">
                <div className="space-y-2">
                  <Label htmlFor="paybill_shortcode">Paybill Number</Label>
                  <Input
                    id="paybill_shortcode"
                    value={settings.paybill_shortcode}
                    onChange={(e) => setSettings(prev => ({ ...prev, paybill_shortcode: e.target.value }))}
                    placeholder="e.g., 174379"
                  />
                </div>

                {renderCredentialInput(
                  'Paybill Passkey', 
                  'paybill_passkey', 
                  settings.has_paybill_passkey, 
                  'Your Paybill Lipa Na M-Pesa Passkey'
                )}

                <div className="space-y-2">
                  <Label htmlFor="paybill_account_reference">Default Account Reference</Label>
                  <Input
                    id="paybill_account_reference"
                    value={settings.paybill_account_reference}
                    onChange={(e) => setSettings(prev => ({ ...prev, paybill_account_reference: e.target.value }))}
                    placeholder="e.g., RENT (optional - will use invoice ID if empty)"
                  />
                  <p className="text-xs text-muted-foreground">
                    This appears in the M-Pesa SMS. If empty, the invoice ID will be used.
                  </p>
                </div>

                {/* Daraja API callback URL — shown so manager can configure Safaricom portal */}
                <div className="p-3 rounded-lg bg-[hsl(214_73%_48%/0.06)] border border-[hsl(214_73%_48%/0.25)] space-y-2">
                  <p className="text-xs font-semibold text-[hsl(214_73%_30%)]">Safaricom Daraja API Setup</p>
                  <p className="text-xs text-[hsl(214_73%_32%)]">
                    Register this callback URL in your Safaricom Daraja portal so M-Pesa payments are automatically processed:
                  </p>
                  <div className="flex items-center gap-2 bg-white rounded border border-[hsl(214_73%_48%/0.25)] px-2 py-1.5">
                    <code className="text-xs font-mono text-[hsl(214_73%_30%)] flex-1 break-all">
                      {`${mpesaCallbackUrl}?secret=YOUR_WEBHOOK_SECRET`}
                    </code>
                    <button
                      type="button"
                      className="text-xs text-[hsl(214_73%_45%)] hover:text-[hsl(214_73%_32%)] shrink-0 font-medium"
                      onClick={() => {
                        navigator.clipboard.writeText(mpesaCallbackUrl);
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-[hsl(214_73%_38%)]">
                    Replace YOUR_WEBHOOK_SECRET with the MPESA_CALLBACK_SECRET in your Supabase Edge Function secrets.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="till" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Enable Till (Buy Goods) Payments</Label>
                <p className="text-sm text-muted-foreground">
                  Accept payments via M-Pesa Buy Goods and Services
                </p>
              </div>
              <Switch
                checked={settings.till_enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, till_enabled: checked }))}
              />
            </div>

            {settings.till_enabled && (
              <div className="space-y-4 pl-4 border-l-2">
                <div className="space-y-2">
                  <Label htmlFor="till_shortcode">Till Number</Label>
                  <Input
                    id="till_shortcode"
                    value={settings.till_shortcode}
                    onChange={(e) => setSettings(prev => ({ ...prev, till_shortcode: e.target.value }))}
                    placeholder="e.g., 5757575"
                  />
                </div>

                {renderCredentialInput(
                  'Till Passkey', 
                  'till_passkey', 
                  settings.has_till_passkey, 
                  'Your Till Lipa Na M-Pesa Passkey'
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save M-Pesa Settings'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
