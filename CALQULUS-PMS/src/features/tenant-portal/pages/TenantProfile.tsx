import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import { DashboardSectionHeader } from '@/features/dashboard/components/DashboardSectionHeader';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { logError } from '@/shared/lib/errorLogger';
import { useBiometricAuth } from '@/shared/hooks/useBiometricAuth';
import { useSignedStorageUrl } from '@/shared/hooks/useSignedStorageUrl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Separator } from '@/shared/components/ui/separator';
import {
  User,
  Bell,
  Mail,
  Phone,
  Save,
  Camera,
  LogOut,
  Loader2,
  Fingerprint,
  ShieldCheck,
  ScanFace,
} from 'lucide-react';

interface TenantProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  property: string | null;
  unit: string | null;
  property_id: string | null;
  manager_id: string | null;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  paymentReminders: boolean;
  leaseAlerts: boolean;
  maintenanceUpdates: boolean;
}

const TenantProfile = () => {
  const navigate = useNavigate();
  const { user, signOut, userRole } = useAuth();
  const { toast } = useToast();
  const {
    isAvailable: biometricAvailable,
    biometryType,
    hasStoredCredentials,
    isLoading: biometricLoading,
    saveCredentials,
    deleteCredentials,
    refreshStatus,
  } = useBiometricAuth();

  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const displayPhotoUrl = useSignedStorageUrl(profile?.photo_url);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [biometricEnabling, setBiometricEnabling] = useState(false);
  const [showPasswordForBiometric, setShowPasswordForBiometric] = useState(false);
  const [biometricPassword, setBiometricPassword] = useState('');

  const [formData, setFormData] = useState<{
    email: string;
    name: string;
    phone: string;
  }>({
    email: '',
    name: '',
    phone: '',
  });

  const [notifications, setNotifications] = useState<NotificationPreferences>({
    emailNotifications: true,
    paymentReminders: true,
    leaseAlerts: true,
    maintenanceUpdates: true,
  });

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchProfile = useCallback(async () => {
    if (!userRole?.tenant_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, email, phone, photo_url, property, unit, property_id, manager_id')
        .eq('id', userRole.tenant_id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userRole?.tenant_id, toast]);

  const loadNotificationPreferences = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('tenant_notification_preferences')
        .select('*')
        .eq('tenant_user_id', user!.id)
        .maybeSingle();
      if (data) {
        const prefs = data as {
          email_enabled: boolean | null;
          payment_reminders: boolean | null;
          lease_alerts: boolean | null;
          maintenance_updates: boolean | null;
        };
        setNotifications({
          emailNotifications: prefs.email_enabled ?? true,
          paymentReminders: prefs.payment_reminders ?? true,
          leaseAlerts: prefs.lease_alerts ?? true,
          maintenanceUpdates: prefs.maintenance_updates ?? true,
        });
      }
      // No localStorage fallback — preferences are DB-only
    } catch (err) {}
  }, [user]);

  useEffect(() => {
    fetchProfile();
    loadNotificationPreferences();
  }, [userRole?.tenant_id, fetchProfile, loadNotificationPreferences]);

  const saveNotificationPreferences = async (prefs: NotificationPreferences) => {
    setNotifications(prefs);
    try {
      const { error } = await supabase.rpc('save_tenant_notification_preferences_atomic', {
        p_payload: {
          email_enabled: prefs.emailNotifications,
          payment_reminders: prefs.paymentReminders,
          lease_alerts: prefs.leaseAlerts,
          maintenance_updates: prefs.maintenanceUpdates,
        },
      });
      if (error) throw error;
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated',
      });
    } catch {
      toast({
        title: 'Save failed',
        description: 'Could not save preferences. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!userRole?.tenant_id) return;

    setSaving(true);
    try {
      const updateData: {
        name: string;
        phone: string | null;
        email?: string;
      } = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
      };

      // Allow email update only for orphaned tenants (no property_id or manager_id)
      const isOrphaned = !profile?.property_id && !profile?.manager_id;

      if (isOrphaned && formData.email.trim()) {
        updateData.email = formData.email.trim();
      }

      const { error } = await supabase.rpc('update_tenant_profile_atomic', { p_tenant_id: userRole.tenant_id, p_payload: updateData });

      if (error) {
        logError('TenantProfile.updateProfile', error);
        throw error;
      }

      setProfile((prev) => (prev ? { ...prev, ...updateData } : null));
      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully',
      });
    } catch (error) {
      logError('TenantProfile.saveProfile', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userRole?.tenant_id) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userRole.tenant_id}-${Date.now()}.${fileExt}`;
      const filePath = `${userRole.tenant_id}/${fileName}`;

      // Delete old photo if exists
      if (profile?.photo_url) {
        const oldPath = profile.photo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('tenant-photos').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('tenant-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('tenant-photos').getPublicUrl(filePath);

      const { error: updateError } = await supabase.rpc('update_tenant_profile_atomic' as any, { p_tenant_id: userRole.tenant_id, p_payload: { photo_url: publicUrl } });

      if (updateError) throw updateError;

      setProfile((prev) => (prev ? { ...prev, photo_url: publicUrl } : null));
      toast({
        title: 'Photo updated',
        description: 'Your profile photo has been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getBiometricLabel = () => {
    switch (biometryType) {
      case 'faceId':
        return 'Face ID';
      case 'fingerprint':
        return 'Fingerprint';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometric';
    }
  };

  const getBiometricIcon = () => {
    switch (biometryType) {
      case 'faceId':
        return <ScanFace className="h-5 w-5" />;
      default:
        return <Fingerprint className="h-5 w-5" />;
    }
  };

  const handleEnableBiometric = async () => {
    if (!profile?.email || !biometricPassword) {
      toast({
        title: 'Password required',
        description: 'Please enter your password to enable biometric login.',
        variant: 'destructive',
      });
      return;
    }

    setBiometricEnabling(true);
    try {
      // First verify the password is correct by attempting to sign in
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: biometricPassword,
      });

      if (error) {
        toast({
          title: 'Invalid password',
          description: 'Please enter your correct password.',
          variant: 'destructive',
        });
        setBiometricEnabling(false);
        return;
      }

      // Save credentials for biometric login
      const success = await saveCredentials(profile.email, biometricPassword);

      if (success) {
        toast({
          title: `${getBiometricLabel()} enabled`,
          description: `You can now sign in using ${getBiometricLabel()}.`,
        });
        setShowPasswordForBiometric(false);
        setBiometricPassword('');
        await refreshStatus();
      } else {
        toast({
          title: 'Failed to enable',
          description: `Could not enable ${getBiometricLabel()}. Please try again.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to enable biometric login.',
        variant: 'destructive',
      });
    } finally {
      setBiometricEnabling(false);
    }
  };

  const handleDisableBiometric = async () => {
    setBiometricEnabling(true);
    try {
      const success = await deleteCredentials();

      if (success) {
        toast({
          title: `${getBiometricLabel()} disabled`,
          description: 'Biometric login has been disabled.',
        });
        await refreshStatus();
      } else {
        toast({
          title: 'Failed to disable',
          description: 'Could not disable biometric login. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disable biometric login.',
        variant: 'destructive',
      });
    } finally {
      setBiometricEnabling(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout title="Profile" description="Your details and notifications.">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout title="Profile" description="Your details and notifications.">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <DashboardSectionHeader
          eyebrow="Account"
          title="Your profile"
          description="Keep your contact details, notifications and sign-in preferences up to date."
        />
        {/* Profile Photo & Basic Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={displayPhotoUrl || undefined} alt={profile?.name} />
                  <AvatarFallback className="text-2xl bg-warning text-warning">
                    {profile?.name ? getInitials(profile.name) : <User className="h-10 w-10" />}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="photo-upload"
                  className="absolute bottom-0 right-0 p-1.5 bg-gradient-to-br from-warning to-warning text-muted-foreground rounded-full cursor-pointer hover:bg-warning transition-colors"
                >
                  {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </div>
              <div className="text-center">
                <h2 className="font-semibold text-xl">{profile?.name}</h2>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.property && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {profile.property} {profile.unit && `• Unit ${profile.unit}`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={!profile?.property_id && !profile?.manager_id ? false : true}
                  className={!profile?.property_id && !profile?.manager_id ? '' : 'bg-muted'}
                />
              </div>
              {profile?.property_id || profile?.manager_id ? (
                <p className="text-xs text-muted-foreground">Contact your property manager to update your email</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You can update your email since you are not attached to a property
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+254 700 000000"
                  type="tel"
                />
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose what notifications you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notifications" className="font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch
                id="email-notifications"
                checked={notifications.emailNotifications}
                onCheckedChange={(checked) =>
                  saveNotificationPreferences({ ...notifications, emailNotifications: checked })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="payment-reminders" className="font-medium">
                  Payment Reminders
                </Label>
                <p className="text-sm text-muted-foreground">Get notified before payments are due</p>
              </div>
              <Switch
                id="payment-reminders"
                checked={notifications.paymentReminders}
                onCheckedChange={(checked) =>
                  saveNotificationPreferences({ ...notifications, paymentReminders: checked })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="lease-alerts" className="font-medium">
                  Lease Alerts
                </Label>
                <p className="text-sm text-muted-foreground">Notifications about your lease status</p>
              </div>
              <Switch
                id="lease-alerts"
                checked={notifications.leaseAlerts}
                onCheckedChange={(checked) => saveNotificationPreferences({ ...notifications, leaseAlerts: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="maintenance-updates" className="font-medium">
                  Maintenance Updates
                </Label>
                <p className="text-sm text-muted-foreground">Updates on your maintenance requests</p>
              </div>
              <Switch
                id="maintenance-updates"
                checked={notifications.maintenanceUpdates}
                onCheckedChange={(checked) =>
                  saveNotificationPreferences({ ...notifications, maintenanceUpdates: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings - Biometric */}
        {biometricAvailable && !biometricLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your login security options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-warning flex items-center justify-center">
                    {getBiometricIcon()}
                  </div>
                  <div>
                    <Label className="font-medium">{getBiometricLabel()} Login</Label>
                    <p className="text-sm text-muted-foreground">
                      {hasStoredCredentials
                        ? `Sign in quickly using ${getBiometricLabel()}`
                        : `Enable ${getBiometricLabel()} for faster login`}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={hasStoredCredentials}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setShowPasswordForBiometric(true);
                    } else {
                      handleDisableBiometric();
                    }
                  }}
                  disabled={biometricEnabling}
                />
              </div>

              {showPasswordForBiometric && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your password to enable {getBiometricLabel()} login. Your credentials will be securely stored
                    on this device.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="biometric-password">Password</Label>
                    <Input
                      id="biometric-password"
                      type="password"
                      value={biometricPassword}
                      onChange={(e) => setBiometricPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForBiometric(false);
                        setBiometricPassword('');
                      }}
                      disabled={biometricEnabling}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleEnableBiometric}
                      disabled={biometricEnabling || !biometricPassword}
                      className="flex-1"
                    >
                      {biometricEnabling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Enable
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sign Out */}
        <Card className="border-destructive/20">
          <CardContent className="pt-6">
            <Button variant="destructive" onClick={handleSignOut} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
};

export default TenantProfile;
