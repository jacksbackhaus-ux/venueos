import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

interface RegistrationForm {
  local_authority_name: string;
  registration_date: string;
  registration_reference: string;
  last_inspection_date: string;
  fhrs_rating: string; // "" = not yet rated
  notes: string;
}

const EMPTY: RegistrationForm = {
  local_authority_name: "",
  registration_date: "",
  registration_reference: "",
  last_inspection_date: "",
  fhrs_rating: "",
  notes: "",
};

/**
 * Settings → Site → Registration.
 * One row per site in site_registrations; also printed on the Inspection Pack cover.
 */
export function RegistrationCard({ canEdit }: { canEdit: boolean }) {
  const { currentSite, organisationId } = useSite();
  const [form, setForm] = useState<RegistrationForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentSite?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("site_registrations" as any)
        .select("*")
        .eq("site_id", currentSite.id)
        .maybeSingle();
      if (cancelled) return;
      const r = data as any;
      setForm(
        r
          ? {
              local_authority_name: r.local_authority_name ?? "",
              registration_date: r.registration_date ?? "",
              registration_reference: r.registration_reference ?? "",
              last_inspection_date: r.last_inspection_date ?? "",
              fhrs_rating: r.fhrs_rating == null ? "" : String(r.fhrs_rating),
              notes: r.notes ?? "",
            }
          : EMPTY,
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentSite?.id]);

  const save = async () => {
    if (!currentSite?.id || !organisationId) return;
    setSaving(true);
    const { error } = await supabase.from("site_registrations" as any).upsert(
      {
        site_id: currentSite.id,
        organisation_id: organisationId,
        local_authority_name: form.local_authority_name.trim() || null,
        registration_date: form.registration_date || null,
        registration_reference: form.registration_reference.trim() || null,
        last_inspection_date: form.last_inspection_date || null,
        fhrs_rating: form.fhrs_rating === "" ? null : Number(form.fhrs_rating),
        notes: form.notes.trim() || null,
      } as any,
      { onConflict: "site_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save registration details.");
      return;
    }
    toast.success("Registration details saved");
  };

  const set = (k: keyof RegistrationForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Registration
        </CardTitle>
        <CardDescription>
          Your council food business registration — the first thing an inspector asks for. Included on your Inspection Pack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="reg-authority" className="text-sm">Local authority / council</Label>
              <Input
                id="reg-authority"
                placeholder="e.g. Leeds City Council"
                value={form.local_authority_name}
                onChange={(e) => set("local_authority_name")(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-date" className="text-sm">Registration date</Label>
                <Input id="reg-date" type="date" value={form.registration_date}
                  onChange={(e) => set("registration_date")(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-ref" className="text-sm">Reference number</Label>
                <Input id="reg-ref" placeholder="Optional" value={form.registration_reference}
                  onChange={(e) => set("registration_reference")(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-inspection" className="text-sm">Last inspection date</Label>
                <Input id="reg-inspection" type="date" value={form.last_inspection_date}
                  onChange={(e) => set("last_inspection_date")(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Food hygiene rating</Label>
                <Select
                  value={form.fhrs_rating === "" ? "none" : form.fhrs_rating}
                  onValueChange={(v) => set("fhrs_rating")(v === "none" ? "" : v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue placeholder="Not yet rated" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not yet rated</SelectItem>
                    {[5, 4, 3, 2, 1, 0].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-notes" className="text-sm">Notes</Label>
              <Textarea id="reg-notes" rows={2} placeholder="Anything an inspector should know"
                value={form.notes} onChange={(e) => set("notes")(e.target.value)} disabled={!canEdit} />
            </div>
            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save registration
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
