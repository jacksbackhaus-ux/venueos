import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMessengerSettings } from "@/hooks/useMessenger";
import { MessageSquare, Eye, Users, Clock, Save } from "lucide-react";
import { toast } from "sonner";

export function MessengerSettingsSection() {
  const { settings, loading, update } = useMessengerSettings();
  const [readReceipts, setReadReceipts] = useState(true);
  const [whoCreate, setWhoCreate] = useState<"managers" | "all">("managers");
  const [shortHours, setShortHours] = useState("48");
  const [compText, setCompText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setReadReceipts(settings.read_receipts_enabled);
      setWhoCreate(settings.who_can_create_channels);
      setShortHours(String(settings.short_notice_hours));
      setCompText(settings.short_notice_compensation_text);
    }
  }, [settings]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!settings) return <p className="text-sm text-muted-foreground">Select a site to configure messenger.</p>;

  const onSave = async () => {
    setSaving(true);
    const ok = await update({
      read_receipts_enabled: readReceipts,
      who_can_create_channels: whoCreate,
      short_notice_hours: Math.max(1, parseInt(shortHours) || 48),
      short_notice_compensation_text: compText.trim() || settings.short_notice_compensation_text,
    });
    setSaving(false);
    toast[ok ? "success" : "error"](ok ? "Messenger settings saved" : "Could not save settings");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" />
          Messenger Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-3.5 w-3.5" /> Read receipts
            </Label>
            <p className="text-xs text-muted-foreground">Show "Seen by…" beneath messages.</p>
          </div>
          <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-3.5 w-3.5" /> Who can create channels
          </Label>
          <Select value={whoCreate} onValueChange={(v) => setWhoCreate(v as "managers" | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="managers">Managers & supervisors only</SelectItem>
              <SelectItem value="all">Everyone on the site</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-3.5 w-3.5" /> Short-notice cancellation threshold
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={336}
              value={shortHours}
              onChange={(e) => setShortHours(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">hours before shift start</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cancellations within this window will trigger a compliance card in #notifications.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Compensation policy text</Label>
          <Textarea
            value={compText}
            onChange={(e) => setCompText(e.target.value)}
            rows={3}
            placeholder="Shown to staff when a shift is cancelled at short notice."
          />
          <p className="text-xs text-muted-foreground">
            Per UK/EU 2026 Predictable Working Conditions — describe your venue's compensation policy.
          </p>
        </div>

        <Button onClick={onSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save messenger settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
