import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DEFAULT_PROFILES, type Channel, type ChannelProfile } from "@/lib/channelMath";

const DTC_FIELDS: { key: keyof ChannelProfile; label: string; suffix?: string }[] = [
  { key: "payment_fees_percent", label: "Payment fees", suffix: "%" },
  { key: "platform_fees_percent", label: "Platform fees (Shopify/till)", suffix: "%" },
  { key: "packaging_cost_per_unit", label: "Packaging cost per unit", suffix: "£" },
  { key: "shipping_cost_per_unit", label: "Shipping cost per unit", suffix: "£" },
  { key: "default_target_gp_percent", label: "Default target GP", suffix: "%" },
];
const WS_FIELDS: { key: keyof ChannelProfile; label: string; suffix?: string }[] = [
  { key: "wholesale_discount_percent", label: "Wholesale discount off DTC", suffix: "%" },
  { key: "wholesale_commission_percent", label: "Distributor commission", suffix: "%" },
  { key: "packaging_cost_per_unit", label: "Packaging cost per unit", suffix: "£" },
  { key: "default_target_gp_percent", label: "Default target GP", suffix: "%" },
];

export default function ChannelsSettings({
  siteId,
  orgId,
}: {
  siteId: string | null;
  orgId: string | null;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["site-channel-profiles", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_channel_profiles")
        .select("*")
        .eq("site_id", siteId!);
      if (error) throw error;
      return data || [];
    },
  });

  const profiles: Record<Channel, ChannelProfile> = {
    dtc:
      (q.data?.find((p: any) => p.channel === "dtc") as any) || {
        ...DEFAULT_PROFILES.dtc,
      },
    wholesale:
      (q.data?.find((p: any) => p.channel === "wholesale") as any) || {
        ...DEFAULT_PROFILES.wholesale,
      },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChannelCard
        title="Direct-to-Customer"
        description="Website, in-store till, app."
        channel="dtc"
        profile={profiles.dtc}
        fields={DTC_FIELDS}
        siteId={siteId}
        orgId={orgId}
        onSaved={() => qc.invalidateQueries({ queryKey: ["site-channel-profiles", siteId] })}
      />
      <ChannelCard
        title="Wholesale"
        description="Cafés, shops, distributors."
        channel="wholesale"
        profile={profiles.wholesale}
        fields={WS_FIELDS}
        siteId={siteId}
        orgId={orgId}
        onSaved={() => qc.invalidateQueries({ queryKey: ["site-channel-profiles", siteId] })}
      />
    </div>
  );
}

function ChannelCard({
  title, description, channel, profile, fields, siteId, orgId, onSaved,
}: {
  title: string;
  description: string;
  channel: Channel;
  profile: ChannelProfile;
  fields: { key: keyof ChannelProfile; label: string; suffix?: string }[];
  siteId: string | null;
  orgId: string | null;
  onSaved: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of fields) next[f.key as string] = String((profile as any)[f.key] ?? 0);
    setVals(next);
  }, [profile, fields]);

  const save = async () => {
    if (!siteId || !orgId) return;
    setSaving(true);
    try {
      const payload: any = {
        organisation_id: orgId,
        site_id: siteId,
        channel,
      };
      for (const f of fields) payload[f.key] = Number(vals[f.key as string]) || 0;
      const { error } = await supabase
        .from("site_channel_profiles")
        .upsert(payload, { onConflict: "site_id,channel" });
      if (error) throw error;
      toast.success(`${title} saved`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((f) => (
          <div key={f.key as string} className="grid grid-cols-[1fr_8rem] items-center gap-3">
            <Label className="text-sm">{f.label}</Label>
            <div className="flex items-center gap-1">
              {f.suffix === "£" && <span className="text-muted-foreground text-sm">£</span>}
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={vals[f.key as string] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key as string]: e.target.value }))}
              />
              {f.suffix === "%" && <span className="text-muted-foreground text-sm">%</span>}
            </div>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
