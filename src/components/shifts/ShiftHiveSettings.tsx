import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompSettings } from "@/hooks/useShiftHive";

export function ShiftHiveSettings() {
  const { settings, loading, update } = useCompSettings();
  const [shortHrs, setShortHrs] = useState(48);
  const [veryShortHrs, setVeryShortHrs] = useState(24);
  const [shortPct, setShortPct] = useState(25);
  const [veryShortPct, setVeryShortPct] = useState(50);
  const [defaultRate, setDefaultRate] = useState<string>("");

  useEffect(() => {
    if (!settings) return;
    setShortHrs(settings.short_notice_hours);
    setVeryShortHrs(settings.very_short_notice_hours);
    setShortPct(Number(settings.short_notice_pct));
    setVeryShortPct(Number(settings.very_short_notice_pct));
    setDefaultRate(settings.default_hourly_rate?.toString() ?? "");
  }, [settings]);

  const save = async () => {
    await update({
      short_notice_hours: shortHrs,
      very_short_notice_hours: veryShortHrs,
      short_notice_pct: shortPct,
      very_short_notice_pct: veryShortPct,
      default_hourly_rate: defaultRate ? Number(defaultRate) : null,
    });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <p className="font-heading font-semibold">Late cancellation rules</p>
          <p className="text-sm text-muted-foreground">
            Compliance with UK Employment Rights Bill 2025-26 / EU Predictability Directive
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Short notice threshold (hrs)</Label>
            <Input type="number" value={shortHrs} onChange={(e) => setShortHrs(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">% of shift value</Label>
            <Input type="number" step="0.01" value={shortPct} onChange={(e) => setShortPct(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Very short notice (hrs)</Label>
            <Input type="number" value={veryShortHrs} onChange={(e) => setVeryShortHrs(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">% of shift value</Label>
            <Input type="number" step="0.01" value={veryShortPct} onChange={(e) => setVeryShortPct(Number(e.target.value))} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Default hourly rate £ (used if a staff member has none)</Label>
          <Input type="number" step="0.01" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} placeholder="e.g. 12.00" />
        </div>

        <Button onClick={save} className="w-full">Save settings</Button>

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p><strong>Example:</strong> A 6-hour shift at £12/h cancelled 18h before start = £36 (50%).</p>
          <p>Compensation logs are auto-created when you delete a published shift inside the {shortHrs}h window.</p>
        </div>
      </CardContent>
    </Card>
  );
}
