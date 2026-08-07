import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Home } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { KITCHEN_SETUP_ITEMS, type KitchenSetupAnswers } from "@/lib/premises";

/**
 * Settings → Site → Kitchen setup (home sites only).
 * One-time 10-item check with optional notes. Available anytime, included on
 * the Inspection Pack. Stored as JSONB on site_kitchen_setup.
 */
export function KitchenSetupCard({ canEdit }: { canEdit: boolean }) {
  const { currentSite, organisationId } = useSite();
  const [answers, setAnswers] = useState<KitchenSetupAnswers>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentSite?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("site_kitchen_setup" as any)
        .select("items")
        .eq("site_id", currentSite.id)
        .maybeSingle();
      if (cancelled) return;
      setAnswers(((data as any)?.items as KitchenSetupAnswers) ?? {});
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentSite?.id]);

  const done = KITCHEN_SETUP_ITEMS.filter((i) => answers[i.key]?.checked).length;
  const complete = done === KITCHEN_SETUP_ITEMS.length;

  const save = async () => {
    if (!currentSite?.id || !organisationId) return;
    setSaving(true);
    const allChecked = KITCHEN_SETUP_ITEMS.every((i) => answers[i.key]?.checked);
    const { error } = await supabase.from("site_kitchen_setup" as any).upsert(
      {
        site_id: currentSite.id,
        organisation_id: organisationId,
        items: answers as any,
        completed_at: allChecked ? new Date().toISOString() : null,
      } as any,
      { onConflict: "site_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save kitchen setup.");
      return;
    }
    toast.success("Kitchen setup saved");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" /> Kitchen setup
            </CardTitle>
            <CardDescription>
              A one-time check that your home kitchen is set up safely. Included on your Inspection Pack.
            </CardDescription>
          </div>
          <Badge variant={complete ? "outline" : "secondary"} className={complete ? "border-success/40 text-success" : ""}>
            {done}/{KITCHEN_SETUP_ITEMS.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {KITCHEN_SETUP_ITEMS.map((item) => {
              const a = answers[item.key];
              return (
                <div key={item.key} className="rounded-md border p-3 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={!!a?.checked}
                      disabled={!canEdit}
                      onCheckedChange={(v) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [item.key]: { ...prev[item.key], checked: v === true },
                        }))
                      }
                    />
                    <span className="text-sm leading-snug">{item.label}</span>
                  </label>
                  <Input
                    placeholder="Note (optional)"
                    className="h-8 text-xs"
                    value={a?.note ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [item.key]: { checked: !!prev[item.key]?.checked, note: e.target.value },
                      }))
                    }
                  />
                </div>
              );
            })}
            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save kitchen setup
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
