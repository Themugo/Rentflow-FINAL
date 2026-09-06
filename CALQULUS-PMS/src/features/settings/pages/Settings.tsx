// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/shared/components/layout/Layout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import { logError } from "@/shared/lib/errorLogger";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { Loader2, Upload, X } from "lucide-react";
import { UserRoleManagement } from "@/features/settings/components/UserRoleManagement";
import { PasswordChange } from "@/features/settings/components/PasswordChange";
import { CompanySettings } from "@/features/settings/components/CompanySettings";
import OrgBrandStudio from "@/features/settings/components/OrgBrandStudio";
import { ReceiptSettings } from "@/features/settings/components/ReceiptSettings";
import { PaymentReminderSettings } from "@/features/settings/components/PaymentReminderSettings";
import { CurrencySettings } from "@/features/settings/components/CurrencySettings";
import { PaymentSettings } from "@/features/settings/components/PaymentSettings";
import { PaymentSetupStatus } from "@/features/settings/components/PaymentSetupStatus";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import SubmanagerManagement from "@/features/settings/components/SubmanagerManagement";
import BankIntegrationSettings from "@/features/payments/components/BankIntegrationSettings";
import UnmatchedBankTransactions from "@/features/payments/components/UnmatchedBankTransactions";
import { DateSettings } from "@/features/settings/components/DateSettings";
import { CacheManagementSettings } from "@/features/settings/components/CacheManagementSettings";
import { PushNotificationSettings } from "@/features/settings/components/PushNotificationSettings";
import { cn } from "@/shared/lib/utils";
import PortalDeviceSecuritySettings from "@/shared/components/PortalDeviceSecuritySettings";
import { imageExtension, publicStoragePath } from "@/features/settings/lib/storagePaths";
import { useSignedStorageUrl } from "@/shared/hooks/useSignedStorageUrl";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import {
  SETTINGS_GROUPS,
  findSettingsItem,
  isSettingsPanelId,
} from "@/features/settings/lib/settingsGroups";

const Settings = () => {
  // One-device portal control with explicit second-device authorization.

  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("profile");

  const selectTab = (id: string) => {
    const item = findSettingsItem(id);
    if (item?.href) {
      navigate(item.href);
      return;
    }
    if (!isSettingsPanelId(id)) return;
    setActiveTab(id);
    setSearchParams(id === "profile" ? {} : { tab: id }, { replace: true });
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && isSettingsPanelId(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const displayPhotoUrl = useSignedStorageUrl(photoUrl);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, email, phone, photo_url")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        setFullName(data?.full_name || "");
        setEmail(data?.email || user.email || "");
        setPhone(data?.phone || "");
        setPhotoUrl(data?.photo_url || null);
      } catch (error) {
        toast({
          title: "Profile Load Failed",
          description: error instanceof Error ? error.message : "Could not load your profile settings.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Photo must be less than 2MB", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const fileExt = imageExtension(file);
      const fileName = `${user.id}/profile.${fileExt}`;
      if (photoUrl) {
        const oldPath = publicStoragePath(photoUrl, "profile-photos");
        if (oldPath && oldPath !== fileName) {
          const { error: removeError } = await supabase.storage.from("profile-photos").remove([oldPath]);
          if (removeError) logError("Settings.photoCleanup", removeError);
        }
      }
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { cacheControl: "3600", contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(fileName);
      const newPhotoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: profileError } = await supabase.rpc('update_profile_photo_atomic' as never, { p_photo_url: newPhotoUrl });
      if (profileError) throw profileError;
      setPhotoUrl(newPhotoUrl);
      toast({ title: "Photo Uploaded", description: "Your profile photo has been updated." });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!photoUrl || !user) return;
    setUploadingPhoto(true);
    try {
      const filePath = publicStoragePath(photoUrl, "profile-photos");
      if (filePath) {
        const { error: removeError } = await supabase.storage.from("profile-photos").remove([filePath]);
        if (removeError) throw removeError;
      }
      const { error: profileError } = await supabase.rpc('update_profile_photo_atomic' as never, { p_photo_url: null });
      if (profileError) throw profileError;
      setPhotoUrl(null);
      toast({ title: "Photo Removed", description: "Your profile photo has been removed." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_profile_settings_atomic', {
        p_full_name: fullName,
        p_phone: phone,
        p_email: user.email || email,
      });
      if (error) throw error;
      toast({ title: "Profile Updated", description: "Your profile information has been saved." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <Card className="card-shadow animate-fade-in">
            <CardHeader>
              <CardTitle className="font-heading">Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Profile Photo</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                          <AvatarImage src={displayPhotoUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-foreground text-lg sm:text-xl">
                            {getInitials(fullName)}
                          </AvatarFallback>
                        </Avatar>
                        {photoUrl && (
                          <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 h-5 w-5 sm:h-6 sm:w-6 rounded-full" onClick={handleRemovePhoto} disabled={uploadingPhoto} aria-label="Remove photo">
                            <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                        <Button variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                          {uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {photoUrl ? "Change Photo" : "Upload Photo"}
                        </Button>
                        <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" className="h-9 sm:h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <Input id="email" type="email" value={email} disabled className="bg-muted h-9 sm:h-10 text-sm" />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm">Phone</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter your phone number" className="h-9 sm:h-10" />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={saving} size="sm">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Profile
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      case "password":
        return <PasswordChange />;
      case "notifications":
        return <PushNotificationSettings />;
      case "payments":
        return (
          <div className="space-y-6">
            <PaymentSetupStatus />
            <PaymentSettings />
          </div>
        );
      case "bank-integration":
        return (
          <div className="space-y-6">
            <BankIntegrationSettings />
            <UnmatchedBankTransactions />
          </div>
        );
      case "currency":
        return <CurrencySettings />;
      case "company":
        return <CompanySettings section="organization" />;
      case "branding":
        return <OrgBrandStudio />;
      case "receipts":
        return <ReceiptSettings />;
      case "reminders":
        return <PaymentReminderSettings />;
      case "date-time":
        return <DateSettings />;
      case "submanagers":
        return <SubmanagerManagement />;
      case "roles":
        return <UserRoleManagement />;
      case "cache":
        return <CacheManagementSettings />;
      default:
        return null;
    }
  };

  const currentTab = findSettingsItem(activeTab);

  return (
    <Layout title="Settings" subtitle="Organization, users, roles, notifications, billing, integrations, security, branding">
      <div className="space-y-5">
        <DashboardSectionHeader
          eyebrow="Workspace"
          title="Settings, kept in order"
          description="Manage your profile, organization, payments, notifications and access from one place."
        />
        <PortalDeviceSecuritySettings />
        <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile: Dropdown selector */}
        <div className="lg:hidden">
          <Select value={activeTab} onValueChange={selectTab}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {currentTab && (
                  <span className="flex items-center gap-2">
                    <currentTab.icon className="h-4 w-4" />
                    {currentTab.label}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SETTINGS_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((tab) => (
                    <SelectItem key={tab.id} value={tab.id}>
                      <span className="flex items-center gap-2">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </span>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: Left sidebar nav */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <nav aria-label="Settings groups" className="sticky top-20 space-y-4">
            {SETTINGS_GROUPS.map((group) => (
              <div key={group.id} className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((tab) =>
                  tab.href ? (
                    <Link
                      key={tab.id}
                      to={tab.href}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"
                    >
                      <tab.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </Link>
                  ) : (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => selectTab(tab.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-11",
                        activeTab === tab.id
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <tab.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  )
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 max-w-2xl">
          {renderContent()}
        </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
