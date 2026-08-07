import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Loader2, MapPin, Plus, Thermometer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { toast } from "sonner";

interface SiteEvent {
  id: string;
  name: string;
  location: string | null;
  event_date: string;
  batch_ids: string[];
  transport_temp_checked: boolean;
  transport_temp: number | null;
  notes: string | null;
  logged_by_name: string | null;
}

export interface EventBatchOption {
  id: string;
  label: string;
}

/**
 * Markets & events log — a tab inside Batch & Traceability for home and
 * mobile premises. Records where food went, which batches travelled, and the
 * transport temperature check.
 */
export function MarketsEventsTab({
  batchOptions,
  readOnly,
}: {
  batchOptions: EventBatchOption[];
  readOnly: boolean;
}) {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const siteId = currentSite?.id;

  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState(today);
  const [pickedBatches, setPickedBatches] = useState<string[]>([]);
  const [tempChecked, setTempChecked] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!siteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("site_events" as any)
      .select("*")
      .eq("site_id", siteId)
      .order("event_date", { ascending: false });
    if (error) {
      console.error("Failed to load events", error);
      toast.error("Could not load your events.");
    } else {
      setEvents((data ?? []) as any as SiteEvent[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [siteId]);

  const batchLabel = useMemo(
    () => new Map(batchOptions.map((b) => [b.id, b.label])),
    [batchOptions],
  );

  const reset = () => {
    setName(""); setLocation(""); setEventDate(today);
    setPickedBatches([]); setTempChecked(false); setTempValue(""); setNotes("");
  };

  const save = async () => {
    if (!siteId || !organisationId) return;
    if (!name.trim()) { toast.error("Give the event a name."); return; }
    setSaving(true);
    const { error } = await supabase.from("site_events" as any).insert({
      site_id: siteId,
      organisation_id: organisationId,
      name: name.trim(),
      location: location.trim() || null,
      event_date: eventDate,
      batch_ids: pickedBatches,
      transport_temp_checked: tempChecked,
      transport_temp: tempChecked && tempValue !== "" ? Number(tempValue) : null,
      notes: notes.trim() || null,
      logged_by: appUser?.id ?? staffSession?.user_id ?? null,
      logged_by_name: appUser?.display_name ?? (staffSession as any)?.display_name ?? null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not log the event.");
      return;
    }
    toast.success("Event logged");
    setOpen(false);
    reset();
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Where your food went — markets, fairs and events, with the batches you took.
        </p>
        {!readOnly && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Log event
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No events logged yet"
          description="Log a market or event to show inspectors where your food went and how it travelled."
          action={!readOnly && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log first event</Button>}
        />
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <Card key={e.id} className="shadow-soft">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(parseISO(e.event_date), "d MMM yyyy")}
                      {e.location && (
                        <>
                          <MapPin className="h-3 w-3 ml-1.5" /> {e.location}
                        </>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={e.transport_temp_checked ? "border-success/40 text-success shrink-0" : "shrink-0"}
                  >
                    <Thermometer className="h-3 w-3 mr-1" />
                    {e.transport_temp_checked
                      ? e.transport_temp != null ? `${e.transport_temp}°C` : "Checked"
                      : "Not checked"}
                  </Badge>
                </div>
                {e.batch_ids?.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Batches: {e.batch_ids.map((id) => batchLabel.get(id) ?? "—").join(", ")}
                  </p>
                )}
                {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                {e.logged_by_name && (
                  <p className="text-[11px] text-muted-foreground">Logged by {e.logged_by_name}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log an event</DialogTitle>
            <DialogDescription>Takes under a minute — it all goes into your Inspection Pack.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="event-name">Event name</Label>
              <Input id="event-name" placeholder="e.g. Saturday farmers' market"
                value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-location">Location</Label>
                <Input id="event-location" placeholder="Town square"
                  value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-date">Date</Label>
                <Input id="event-date" type="date" value={eventDate}
                  max={today} onChange={(e) => setEventDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Batches taken</Label>
              {batchOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No batches logged yet.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                  {batchOptions.map((b) => (
                    <label key={b.id} className="flex items-center gap-2.5 p-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={pickedBatches.includes(b.id)}
                        onCheckedChange={(v) =>
                          setPickedBatches((prev) =>
                            v === true ? [...prev, b.id] : prev.filter((x) => x !== b.id),
                          )
                        }
                      />
                      <span className="truncate">{b.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                <Checkbox checked={tempChecked} onCheckedChange={(v) => setTempChecked(v === true)} />
                Transport temperature checked
              </label>
              {tempChecked && (
                <Input
                  type="number" step="0.1" placeholder="Reading in °C"
                  value={tempValue} onChange={(e) => setTempValue(e.target.value)}
                  className="h-9"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-notes">Notes</Label>
              <Textarea id="event-notes" rows={2} placeholder="Anything worth recording"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
