import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import { useFeatureAccess } from "@/shared/hooks/useFeatureAccess";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { imageExtension, publicStoragePath } from "@/features/settings/lib/storagePaths";
import { BrandLivePreview } from "@/features/settings/components/BrandLivePreview";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import { canEditOrgBrand } from "@/core/brand/authorize";
import type { OrgBrandRecord } from "@/core/brand/parseOrgRecord";
import {
  DOCUMENT_KINDS,
  emptyOrgBrandDraft,
  orgBrandDraftFromRecord,
  orgBrandDraftToOverlay,
  sanitizeOrgBrandDraft,
  type OrgBrandDraft,
} from "@/core/brand/orgBrandDraft";
import { isHexColor } from "@/core/brand/hex";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";
import type { Json } from "@/integrations/supabase/types";
import { toUserFacingError } from "@/shared/lib/errorLogger";

const PORTAL_FIELDS = [
  ["portalManager", "Manager"],
  ["portalLandlord", "Landlord"],
  ["portalAgency", "Agency"],
  ["portalTenant", "Tenant"],
] as const;

export default function OrgBrandStudio() {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const allowed = canEditOrgBrand(userRole?.role);
  const { enabled: whiteLabelOnPlan } = useFeatureAccess("white_label");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [saved, setSaved] = useState<OrgBrandDraft>(emptyOrgBrandDraft());
  const [draft, setDraft] = useState<OrgBrandDraft>(emptyOrgBrandDraft());

  useEffect(() => {
    if (!allowed || !user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("*")
          .eq("manager_user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const row = (data ?? null) as OrgBrandRecord & { id?: string } | null;
        setCompanyId(row?.id ?? null);
        const next = orgBrandDraftFromRecord(row, row?.logo_url ?? null);
        setSaved(next);
        setDraft(next);
      } catch (error) {
        toast({
          title: "Could not load branding",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, toast, user?.id]);

  const primaryPalette = useMemo(() => deriveBrandPalette(draft.primaryHex), [draft.primaryHex]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const chromeLocked = !whiteLabelOnPlan;

  const patch = (partial: Partial<OrgBrandDraft>) => setDraft((current) => ({ ...current, ...partial }));

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Upload a PNG or JPG.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fileName = `${user.id}/logo.${imageExtension(file)}`;
      if (draft.logoUrl) {
        const oldPath = publicStoragePath(draft.logoUrl, "company-logos");
        if (oldPath && oldPath !== fileName) {
          await supabase.storage.from("company-logos").remove([oldPath]);
        }
      }
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, { cacheControl: "3600", contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      patch({ logoUrl: `company-logos/${fileName}?t=${Date.now()}` });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload the logo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!allowed || !user?.id) return;
    const clean = sanitizeOrgBrandDraft(draft);
    const palette = deriveBrandPalette(clean.primaryHex);
    if (clean.whiteLabelEnabled && !palette.approved) {
      toast({
        title: "Colour needs contrast",
        description: palette.reasons[0] ?? "Choose a colour that can be read on a white desk.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_name: clean.companyName || "My Company",
        logo_url: clean.logoUrl,
        brand_primary_hex: palette.approved ? palette.hex : null,
        white_label_enabled: whiteLabelOnPlan ? clean.whiteLabelEnabled : false,
        brand_config: orgBrandDraftToOverlay(clean) as Json,
      };
      const { data: savedCompanyId, error } = await supabase.rpc('save_manager_company_settings_atomic', { p_payload: payload });
      if (error) throw error;
      if (savedCompanyId) setCompanyId(savedCompanyId);
      setDraft(clean);
      setSaved(clean);
      invalidateManagerActivation(queryClient);
      queryClient.invalidateQueries({ queryKey: ["org-brand"] });
      toast({ title: "Branding saved", description: "Desks pick this up on the next load." });
    } catch (error) {
      toast({
        title: "Could not save branding",
        description: toUserFacingError(error, "Nothing was overwritten. Check the fields and try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Organization branding can be edited by the manager or agency that owns this book. Submanagers, landlords, and
        tenants cannot change it.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-studio="org-brand">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="page-title">Brand Studio</h2>
          <p className="supporting-text mt-1 max-w-2xl">
            Named fields on the company record. No custom CSS. Status colours stay success, warning, and danger.
            Preview the draft, then save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setDraft(saved)}>
            Discard draft
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save branding
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-medium">White-label desks</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When on, Manager, Landlord, Agency, and Tenant desks use this identity. Login and Platform Admin stay
            CALQULUS.
          </p>
          {!whiteLabelOnPlan ? (
            <p className="mt-2 text-xs text-muted-foreground">
              White-label chrome is an Enterprise plan feature. Name and logo still print on invoices.
            </p>
          ) : null}
        </div>
        <Switch
          checked={draft.whiteLabelEnabled}
          disabled={chromeLocked}
          onCheckedChange={(checked) => patch({ whiteLabelEnabled: checked })}
          aria-label="Enable white-label"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-8">
          <StudioSection title="Identity" description="Company name, logo, favicon, tagline.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" value={draft.companyName} onChange={(value) => patch({ companyName: value })} />
              <Field label="Tagline" value={draft.tagline} onChange={(value) => patch({ tagline: value })} locked={chromeLocked} />
              <Field label="Legal name" value={draft.legalName} onChange={(value) => patch({ legalName: value })} />
              <Field
                label="Favicon URL"
                value={draft.faviconUrl}
                onChange={(value) => patch({ faviconUrl: value })}
                locked={chromeLocked}
                mono
              />
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[11px] text-muted-foreground">Logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleLogoUpload(event)} />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {draft.logoUrl ? "Change logo" : "Upload logo"}
                </Button>
                {draft.logoUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => patch({ logoUrl: null })}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">PNG or JPG, up to 2MB. Stored in company-logos.</p>
              </div>
            </div>
          </StudioSection>

          <StudioSection title="Colours" description="Primary, secondary, and accent. Validated before they apply.">
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorField
                label="Primary"
                value={draft.primaryHex}
                onChange={(value) => patch({ primaryHex: value })}
                locked={chromeLocked}
              />
              <ColorField
                label="Secondary"
                value={draft.secondaryHex}
                onChange={(value) => patch({ secondaryHex: value })}
                locked={chromeLocked}
              />
              <ColorField
                label="Accent"
                value={draft.accentHex}
                onChange={(value) => patch({ accentHex: value })}
                locked={chromeLocked}
              />
            </div>
            {!primaryPalette.approved ? (
              <p className="mt-2 text-xs text-destructive">{primaryPalette.reasons[0]}</p>
            ) : (
              <p className="mt-2 text-xs text-success">Primary meets contrast on a white desk.</p>
            )}
            <div className="mt-4">
              <p className="text-xs font-medium">Semantic status — not editable</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-success/15 px-2 py-1 text-success">Success {CALQULUS_COLOR.success}</span>
                <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">Warning {CALQULUS_COLOR.warning}</span>
                <span className="rounded-full bg-destructive/15 px-2 py-1 text-destructive">Danger {CALQULUS_COLOR.danger}</span>
              </div>
            </div>
          </StudioSection>

          <StudioSection title="Portal themes" description="2px identity stripe per desk. Not a second design system.">
            <div className="grid gap-3 sm:grid-cols-2">
              {PORTAL_FIELDS.map(([key, label]) => (
                <ColorField
                  key={key}
                  label={label}
                  value={draft[key]}
                  onChange={(value) => patch({ [key]: value } as Partial<OrgBrandDraft>)}
                  locked={chromeLocked}
                />
              ))}
            </div>
          </StudioSection>

          <StudioSection title="Communications" description="From-name and notification product name. SMTP is not changed here.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email from-name" value={draft.emailFromName} onChange={(value) => patch({ emailFromName: value })} locked={chromeLocked} />
              <Field
                label="Notification product name"
                value={draft.notificationProductName}
                onChange={(value) => patch({ notificationProductName: value })}
                locked={chromeLocked}
              />
              <Field
                label="Email from-address"
                value={draft.emailFromAddress}
                onChange={(value) => patch({ emailFromAddress: value })}
                locked={chromeLocked}
              />
              <Field label="Reply-to" value={draft.emailReplyTo} onChange={(value) => patch({ emailReplyTo: value })} locked={chromeLocked} />
            </div>
          </StudioSection>

          <StudioSection title="Documents" description="Invoices, receipts, statements, reports.">
            <div className="space-y-4">
              {DOCUMENT_KINDS.map((kind) => {
                const row = draft.documents[kind];
                return (
                  <div key={kind} className="rounded-lg border border-border p-3">
                    <p className="mb-3 text-sm font-medium capitalize">{kind}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label={`${kind} title`}
                        value={row.title}
                        onChange={(value) =>
                          patch({ documents: { ...draft.documents, [kind]: { ...row, title: value } } })
                        }
                      />
                      <Field
                        label={`${kind} footer`}
                        value={row.footerNote}
                        onChange={(value) =>
                          patch({ documents: { ...draft.documents, [kind]: { ...row, footerNote: value } } })
                        }
                      />
                      <ColorField
                        label={`${kind} accent`}
                        value={row.accentColor || draft.primaryHex}
                        onChange={(value) =>
                          patch({ documents: { ...draft.documents, [kind]: { ...row, accentColor: value } } })
                        }
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={row.showLogo}
                          onCheckedChange={(checked) =>
                            patch({ documents: { ...draft.documents, [kind]: { ...row, showLogo: checked } } })
                          }
                        />
                        Show logo
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </StudioSection>

          <StudioSection
            title="Domain"
            description="Stored on the brand record. DNS and TLS are not provisioned from this screen."
          >
            <Field
              label="Custom domain"
              value={draft.customDomain}
              onChange={(value) => patch({ customDomain: value })}
              locked={chromeLocked}
              mono
              placeholder="app.yourcompany.co.ke"
            />
          </StudioSection>
        </div>

        <div className="xl:sticky xl:top-20 h-fit">
          <BrandLivePreview draft={draft} />
        </div>
      </div>
    </div>
  );
}

function StudioSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="section-title">{title}</h3>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  locked,
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locked?: boolean;
  mono?: boolean;
  placeholder?: string;
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={locked}
        placeholder={placeholder}
        className={mono ? "font-mono" : undefined}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  locked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locked?: boolean;
}) {
  const id = `color-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const hex = isHexColor(value) ? value : CALQULUS_COLOR.primary;
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-3">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={hex}
          disabled={locked}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-9 w-10 cursor-pointer rounded border border-input"
        />
        <Input
          value={value}
          disabled={locked}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono"
        />
      </div>
    </div>
  );
}
