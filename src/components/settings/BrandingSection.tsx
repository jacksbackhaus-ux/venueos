import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import {
  BRANDING_DEFAULTS,
  darkenHex,
  resolveLogoUrl,
  shouldUseDarkText,
} from "@/contexts/BrandingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2, Palette, Image as ImageIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function normaliseHex(v: string, fallback: string): string {
  const t = v.trim();
  if (!HEX_RE.test(t)) return fallback;
  return t.startsWith("#") ? t.toLowerCase() : `#${t.toLowerCase()}`;
}

interface Props {
  /** Hide the card chrome — used inside onboarding wizard. */
  embedded?: boolean;
  onSaved?: () => void;
}

export function BrandingSection({ embedded, onSaved }: Props) {
  const { organisationId, currentSite } = useSite();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: org } = useQuery({
    queryKey: ["organisation", organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data } = await supabase
        .from("organisations")
        .select("name")
        .eq("id", organisationId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: branding, isLoading } = useQuery({
    queryKey: ["org-branding", organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_branding" as any)
        .select("*")
        .eq("organisation_id", organisationId!)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data as any;
    },
  });

  const [businessName, setBusinessName] = useState("");
  const [primary, setPrimary] = useState(BRANDING_DEFAULTS.primary);
  const [secondary, setSecondary] = useState(BRANDING_DEFAULTS.secondary);
  const [primaryInput, setPrimaryInput] = useState(BRANDING_DEFAULTS.primary);
  const [secondaryInput, setSecondaryInput] = useState(BRANDING_DEFAULTS.secondary);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setBusinessName(branding?.business_display_name ?? org?.name ?? "");
    const p = branding?.primary_colour || BRANDING_DEFAULTS.primary;
    const s = branding?.secondary_colour || BRANDING_DEFAULTS.secondary;
    setPrimary(p); setPrimaryInput(p);
    setSecondary(s); setSecondaryInput(s);
  }, [branding, org]);

  const logoUrl = resolveLogoUrl(branding?.logo_url ?? null);

  const saveMutation = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!organisationId) throw new Error("No organisation");
      const payload = {
        organisation_id: organisationId,
        business_display_name: businessName.trim() || null,
        primary_colour: primary,
        secondary_colour: secondary,
        ...patch,
      };
      const { error } = await supabase
        .from("org_branding" as any)
        .upsert(payload, { onConflict: "organisation_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-branding", organisationId] });
      toast.success("Branding saved");
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message || "Could not save"),
  });

  const handleFile = async (file: File) => {
    if (!organisationId) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Use PNG, JPG, SVG or WEBP");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${organisationId}/logo.${ext}`;
      // Remove other extensions first to avoid stale files of different types
      const { data: existing } = await supabase.storage.from("org-logos").list(organisationId);
      if (existing?.length) {
        await supabase.storage
          .from("org-logos")
          .remove(existing.map((f) => `${organisationId}/${f.name}`));
      }
      const { error: upErr } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await saveMutation.mutateAsync({ logo_url: path });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!organisationId || !branding?.logo_url) return;
    setUploading(true);
    try {
      await supabase.storage.from("org-logos").remove([branding.logo_url]);
      await saveMutation.mutateAsync({ logo_url: null });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const Wrap = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <div className="space-y-6">{children}</div>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> Branding
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Add your logo, business name, and brand colours. These appear in the app header, login page, and across {currentSite?.name ? "your sites" : "the app"}.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">{children}</CardContent>
      </Card>
    );

  const primaryFg = shouldUseDarkText(primary) ? "#0f172a" : "#ffffff";

  return (
    <Wrap>
      {/* Logo */}
      <div className="space-y-3">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          <div
            className="h-20 w-20 rounded-full border bg-muted flex items-center justify-center overflow-hidden shrink-0"
            aria-label="Current logo preview"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Org logo" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(",")}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Logo
            </Button>
            {branding?.logo_url && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="block text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3 inline mr-1" /> Remove logo
              </button>
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG, SVG or WEBP. Max 2MB.</p>
          </div>
        </div>
      </div>

      {/* Business display name */}
      <div className="space-y-2">
        <Label htmlFor="biz-name">Business display name</Label>
        <Input
          id="biz-name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder={org?.name || "Your business"}
        />
        <p className="text-xs text-muted-foreground">
          Shown in the app header, site switcher, and on your team's login page instead of your organisation name.
        </p>
      </div>

      {/* Colour pickers */}
      <ColourPicker
        label="Primary colour"
        helpText="Used for your nav bar and primary action buttons."
        value={primary}
        inputValue={primaryInput}
        onChange={(c) => { setPrimary(c); setPrimaryInput(c); }}
        onTextChange={(v) => {
          setPrimaryInput(v);
          if (HEX_RE.test(v.trim())) setPrimary(normaliseHex(v, primary));
        }}
        onReset={() => {
          setPrimary(BRANDING_DEFAULTS.primary);
          setPrimaryInput(BRANDING_DEFAULTS.primary);
        }}
      />
      <ColourPicker
        label="Secondary colour"
        helpText="Used for accents and highlight elements."
        value={secondary}
        inputValue={secondaryInput}
        onChange={(c) => { setSecondary(c); setSecondaryInput(c); }}
        onTextChange={(v) => {
          setSecondaryInput(v);
          if (HEX_RE.test(v.trim())) setSecondary(normaliseHex(v, secondary));
        }}
        onReset={() => {
          setSecondary(BRANDING_DEFAULTS.secondary);
          setSecondaryInput(BRANDING_DEFAULTS.secondary);
        }}
      />

      {/* Live preview */}
      <div className="space-y-2">
        <Label>Preview</Label>
        <div className="rounded-lg border overflow-hidden">
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ background: primary, color: primaryFg }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
            ) : (
              <div className="h-6 w-6 rounded bg-white/20" />
            )}
            <span className="font-semibold text-sm">{businessName || org?.name || "MiseOS"}</span>
          </div>
          <div className="p-4 flex items-center gap-2 bg-card">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{
                background: primary,
                color: primaryFg,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = darkenHex(primary, 0.1))}
              onMouseLeave={(e) => (e.currentTarget.style.background = primary)}
            >
              Save
            </button>
            <span
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: secondary, color: shouldUseDarkText(secondary) ? "#0f172a" : "#fff" }}
            >
              Highlight
            </span>
            <span
              className={cn("text-xs px-2 py-1 rounded-full")}
              style={{ background: `${primary}1A`, color: primary }}
            >
              Active tab
            </span>
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => saveMutation.mutate({})}
        disabled={saveMutation.isPending || !organisationId}
        className="gap-2"
      >
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save branding
      </Button>
    </Wrap>
  );
}

function ColourPicker({
  label, helpText, value, inputValue, onChange, onTextChange, onReset,
}: {
  label: string; helpText: string; value: string; inputValue: string;
  onChange: (v: string) => void; onTextChange: (v: string) => void; onReset: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <label
          className="h-10 w-10 rounded-md border cursor-pointer relative overflow-hidden shrink-0"
          style={{ background: value }}
          aria-label={`Choose ${label.toLowerCase()}`}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <Input
          value={inputValue}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="#0D9488"
          className="font-mono uppercase max-w-[140px]"
          maxLength={7}
        />
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to default
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{helpText}</p>
    </div>
  );
}
