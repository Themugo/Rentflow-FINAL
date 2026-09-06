import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Loader2, Send, CheckCircle2, Mail, MessageSquare, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

interface ReminderSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  daysBeforeDue: number[];
}

const defaultSettings: ReminderSettings = {
  emailEnabled: true,
  smsEnabled: true,
  daysBeforeDue: [1, 3, 7],
};

const reminderDayOptions = [
  { value: '1', label: '1 day before' },
  { value: '2', label: '2 days before' },
  { value: '3', label: '3 days before' },
  { value: '5', label: '5 days before' },
  { value: '7', label: '7 days before' },
  { value: '14', label: '14 days before' },
];

export const PaymentReminderSettings = () => {
  const { toast } = useToast();
  const { userRole, user } = useAuth();
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [settings, setSettings] = useState<ReminderSettings>(defaultSettings);
  const [selectedDays, setSelectedDays] = useState<string>('3');

  // Only visible to managers
  if (userRole?.role !== 'manager') {
    return null;
  }

  const handleSendReminders = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-payment-reminders', {
        body: { 
          manual: true,
          emailEnabled: settings.emailEnabled,
          smsEnabled: settings.smsEnabled,
        }
      });

      if (error) throw error;

      setLastSent(new Date());
      toast({
        title: 'Reminders Sent',
        description: `Successfully sent ${data?.sent || 0} payment reminder(s) to tenants.`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to Send Reminders',
        description: error.message || 'An error occurred while sending payment reminders.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleEmail = (checked: boolean) => {
    setSettings(prev => ({ ...prev, emailEnabled: checked }));
  };

  const handleToggleSms = (checked: boolean) => {
    setSettings(prev => ({ ...prev, smsEnabled: checked }));
  };

  return (
    <Card className="card-shadow animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Bell className="h-5 w-5 text-warning" />
          Payment Reminders
        </CardTitle>
        <CardDescription>
          Configure and send payment reminders to tenants with pending or overdue invoices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Channels */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Notification Channels</h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Email Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Send payment reminders via email
                </p>
              </div>
            </div>
            <Switch
              checked={settings.emailEnabled}
              onCheckedChange={handleToggleEmail}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>SMS Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Send payment reminders via SMS
                </p>
              </div>
            </div>
            <Switch
              checked={settings.smsEnabled}
              onCheckedChange={handleToggleSms}
            />
          </div>
        </div>

        <Separator />

        {/* Reminder Schedule */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label>Default Reminder Timing</Label>
              <p className="text-sm text-muted-foreground">
                When automatic reminders are sent before due date
              </p>
            </div>
          </div>
          <Select value={selectedDays} onValueChange={setSelectedDays}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select timing" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {reminderDayOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Manual Send Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Manual Reminders</h4>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Reminders will be sent for:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>Overdue invoices</li>
                <li>Invoices due today</li>
                <li>Invoices due within {selectedDays} day(s)</li>
              </ul>
            </div>
            <Button
              onClick={handleSendReminders}
              disabled={sending || (!settings.emailEnabled && !settings.smsEnabled)}
              className="shrink-0"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Reminders Now
                </>
              )}
            </Button>
          </div>

          {!settings.emailEnabled && !settings.smsEnabled && (
            <p className="text-sm text-destructive">
              Please enable at least one notification channel to send reminders.
            </p>
          )}
        </div>

        {lastSent && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>
              Last sent: {lastSent.toLocaleString()}
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-medium mb-1">Note:</p>
          <p>
            Automatic reminders are sent daily based on your schedule settings. Use the button above to send immediate reminders when needed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
