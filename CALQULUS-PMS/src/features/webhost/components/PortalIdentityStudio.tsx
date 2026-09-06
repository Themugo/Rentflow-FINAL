import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Loader2, Palette, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";
import { DEFAULT_PORTAL_IDENTITIES, type PortalId } from "@/core/product/portals";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const PORTALS: PortalId[] = ["manager", "landlord", "agency", "tenant", "platform_admin"];

type Draft = { displayName: string; shortName: string; tagline: string; primaryHex: string; backgroundImageUrl: string };

export default function PortalIdentityStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [portal, setPortal] = useState<PortalId>("manager");
  const fallback = DEFAULT_PORTAL_IDENTITIES[portal];
  const [draft, setDraft] = useState<Draft>({ displayName: fallback.name, shortName: fallback.shortName, tagline: fallback.tagline, primaryHex: fallback.primaryHex, backgroundImageUrl: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: identity } = useQuery({
    queryKey: ["portal-identity", portal],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_portal_identities" as any).select("*").eq("portal_id", portal).maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const next = identity;
    setDraft({
      displayName: typeof next?.display_name === "string" ? next.display_name : fallback.name,
      shortName: typeof next?.short_name === "string" ? next.short_name : fallback.shortName,
      tagline: typeof next?.tagline === "string" ? next.tagline : fallback.tagline,
      primaryHex: typeof next?.primary_hex === "string" ? next.primary_hex : fallback.primaryHex,
      backgroundImageUrl: typeof next?.background_image_url === "string" ? next.background_image_url : "",
    });
  }, [identity, portal]);

  const palette = useMemo(() => deriveBrandPalette(draft.primaryHex), [draft.primaryHex]);

  const uploadBackground = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast({ title: "Invalid image", description: "Use JPG, PNG, or WebP.", variant: "destructive" });
    if (file.size > 5 * 1024 * 1024) return toast({ title: "Image too large", description: "Portal backgrounds must be under 5MB.", variant: "destructive" });
    setUploading(true);
    try {
      const path = `platform/${portal}/background.${file.name.split(".").pop()?.toLowerCase() || "webp"}`;
      const { error } = await supabase.storage.from("portal-media").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("portal-media").getPublicUrl(path);
      setDraft((current) => ({ ...current, backgroundImageUrl: `${data.publicUrl}?v=${Date.now()}` }));
      toast({ title: "Background uploaded", description: "Save the portal identity to publish it." });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Could not upload image.", variant: "destructive" });
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!palette.approved) return toast({ title: "Colour needs contrast", description: palette.reasons[0], variant: "destructive" });
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("save_platform_portal_identity", {
        p_portal_id: portal,
        p_payload: { display_name: draft.displayName, short_name: draft.shortName, tagline: draft.tagline, primary_hex: palette.hex, background_image_url: draft.backgroundImageUrl || null },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["portal-identity", portal] });
      toast({ title: "Portal identity published", description: `${draft.shortName} now uses this identity on the next load.` });
    } catch (error) {
      toast({ title: "Could not save identity", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Card className="border-border/80 bg-card shadow-sm">
      <CardHeader className="border-b bg-muted/20 p-4">
        <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" /> Portal identities</CardTitle>
        <CardDescription className="text-xs">Define the default identity, primary theme and login background for each desk. Images are platform-controlled assets, not arbitrary CSS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        <Select value={portal} onValueChange={(value) => setPortal(value as PortalId)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PORTALS.map((id) => <SelectItem key={id} value={id}>{DEFAULT_PORTAL_IDENTITIES[id].shortName}</SelectItem>)}</SelectContent>
        </Select>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Display name</Label><Input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Short label</Label><Input value={draft.shortName} onChange={(e) => setDraft({ ...draft, shortName: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Portal tagline</Label><Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5"><Label>Primary theme colour</Label><div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.primaryHex) ? draft.primaryHex : fallback.primaryHex} onChange={(e) => setDraft({ ...draft, primaryHex: e.target.value.toUpperCase() })} className="h-10 w-12 rounded border border-input" /><Input value={draft.primaryHex} onChange={(e) => setDraft({ ...draft, primaryHex: e.target.value })} className="font-mono" /></div>{palette.approved ? <p className="text-xs text-success">Approved for white surfaces.</p> : <p className="text-xs text-destructive">{palette.reasons[0]}</p>}</div>
          <div className="flex items-end"><Button type="button" onClick={save} disabled={saving || uploading || !palette.approved}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Publish identity</Button></div>
        </div>
        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-3"><div><Label>Login background</Label><p className="text-xs text-muted-foreground">Use a relatable property/operations image. The system applies a readability veil.</p></div><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
          {draft.backgroundImageUrl ? <img src={draft.backgroundImageUrl} alt="Portal background preview" className="h-36 w-full rounded-lg object-cover" /> : null}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadBackground(file); }} disabled={uploading} className="block w-full text-xs" />
        </div>
      </CardContent>
    </Card>
  );
}
