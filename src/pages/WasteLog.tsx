import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Trash2, Plus, Loader2, PoundSterling, TrendingDown, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  startOfWeek, endOfWeek, format, eachDayOfInterval, parseISO,
} from "date-fns";

type Category =
  | "food_prep" | "overproduction" | "spoilage" | "returned" | "packaging" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "food_prep", label: "Food Prep" },
  { value: "overproduction", label: "Overproduction" },
  { value: "spoilage", label: "Spoilage" },
  { value: "returned", label: "Returned" },
  { value: "packaging", label: "Packaging" },
  { value: "other", label: "Other" },
];

const UNITS = ["kg", "g", "units", "portions", "litres", "ml"];

const CATEGORY_LABEL: Record<Category, string> =
  Object.fromEntries(CATEGORIES.map(c => [c.value, c.label])) as Record<Category, string>;

interface WasteRow {
  id: string;
  site_id: string;
  organisation_id: string;
  logged_by: string | null;
  logged_by_name: string;
  logged_at: string;
  shift_date: string;
  category: Category;
  item_name: string;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  notes: string | null;
}

function formatGBP(n: number) {
  return `£${n.toFixed(2)}`;
}

const WasteLog = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userId = appUser?.id || staffSession?.user_id || null;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  const [showLog, setShowLog] = useState(false);

  // Form state
  const [category, setCategory] = useState<Category>("food_prep");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [notes, setNotes] = useState("");
  const [shiftDate, setShiftDate] = useState(todayStr);

  // Week bounds (Mon–Sun)
  const week = useMemo(() => {
    const d = new Date();
    return {
      from: format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      to: format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    };
  }, []);

  const { data: weekLogs = [], isLoading } = useQuery({
    queryKey: ["waste_logs", siteId, week.from, week.to],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("waste_logs")
        .select("*")
        .eq("site_id", siteId)
        .gte("shift_date", week.from)
        .lte("shift_date", week.to)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WasteRow[];
    },
    enabled: !!siteId,
  });

  const todayLogs = weekLogs.filter(l => l.shift_date === todayStr);

  const todayByCategory = useMemo(() => {
    const map = new Map<Category, { qty: number; cost: number; entries: WasteRow[] }>();
    for (const l of todayLogs) {
      const existing = map.get(l.category) || { qty: 0, cost: 0, entries: [] };
      existing.qty += Number(l.quantity || 0);
      existing.cost += Number(l.estimated_cost || 0);
      existing.entries.push(l);
      map.set(l.category, existing);
    }
    return map;
  }, [todayLogs]);

  const todayTotalCost = todayLogs.reduce((s, l) => s + Number(l.estimated_cost || 0), 0);

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: parseISO(week.from), end: parseISO(week.to) }),
    [week.from, week.to],
  );
  const weekByDay = useMemo(() => {
    return weekDays.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayLogs = weekLogs.filter(l => l.shift_date === dayStr);
      return {
        day,
        dayStr,
        count: dayLogs.length,
        cost: dayLogs.reduce((s, l) => s + Number(l.estimated_cost || 0), 0),
      };
    });
  }, [weekDays, weekLogs]);
  const weekTotalCost = weekByDay.reduce((s, d) => s + d.cost, 0);
  const maxDayCost = Math.max(1, ...weekByDay.map(d => d.cost));

  const logWaste = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("No site selected");
      if (!itemName.trim()) throw new Error("Item name is required");
      const qty = Number(quantity);
      if (!qty || qty <= 0) throw new Error("Quantity must be greater than 0");

      const { error } = await supabase.from("waste_logs").insert({
        site_id: siteId,
        organisation_id: organisationId,
        logged_by: userId,
        logged_by_name: userName,
        shift_date: shiftDate,
        category,
        item_name: itemName.trim(),
        quantity: qty,
        unit,
        estimated_cost: estimatedCost ? Number(estimatedCost) : null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Waste logged");
      queryClient.invalidateQueries({ queryKey: ["waste_logs", siteId] });
      setShowLog(false);
      // reset
      setItemName(""); setQuantity(""); setEstimatedCost(""); setNotes("");
      setCategory("food_prep"); setUnit("kg"); setShiftDate(todayStr);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trash2 className="h-7 w-7 text-primary" />
            Waste Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track food waste to reduce costs and identify trends.
          </p>
        </div>
        <Button onClick={() => setShowLog(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Log Waste
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "daily" | "weekly")}>
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="daily">Today</TabsTrigger>
          <TabsTrigger value="weekly">This Week</TabsTrigger>
        </TabsList>

        {/* DAILY */}
        <TabsContent value="daily" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Today's Waste
                </CardTitle>
                <Badge variant="secondary" className="font-semibold">
                  {todayLogs.length} entr{todayLogs.length === 1 ? "y" : "ies"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 mb-4">
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <PoundSterling className="h-4 w-4" />
                  Estimated total cost
                </div>
                <div className="font-heading font-bold text-xl">
                  {formatGBP(todayTotalCost)}
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : todayLogs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Trash2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No waste logged yet today.
                </div>
              ) : (
                <div className="space-y-2">
                  {CATEGORIES.map(cat => {
                    const group = todayByCategory.get(cat.value);
                    if (!group) return null;
                    return (
                      <motion.div
                        key={cat.value}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-border rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                          <div className="font-heading font-semibold text-sm">{cat.label}</div>
                          <div className="text-sm">
                            <span className="text-muted-foreground mr-3">
                              {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
                            </span>
                            <span className="font-semibold">{formatGBP(group.cost)}</span>
                          </div>
                        </div>
                        <ul className="divide-y divide-border">
                          {group.entries.map(e => (
                            <li key={e.id} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{e.item_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {e.quantity} {e.unit} · {e.logged_by_name}
                                  {e.notes ? ` · ${e.notes}` : ""}
                                </div>
                              </div>
                              <div className="text-sm font-medium tabular-nums shrink-0">
                                {e.estimated_cost != null ? formatGBP(Number(e.estimated_cost)) : "—"}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEEKLY */}
        <TabsContent value="weekly" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  Week of {format(parseISO(week.from), "d MMM")} – {format(parseISO(week.to), "d MMM")}
                </CardTitle>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total cost</div>
                  <div className="font-heading font-bold">{formatGBP(weekTotalCost)}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {weekByDay.map(d => {
                  const isToday = d.dayStr === todayStr;
                  const pct = (d.cost / maxDayCost) * 100;
                  return (
                    <div key={d.dayStr} className="flex items-center gap-3">
                      <div className={`w-16 text-xs ${isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                        {format(d.day, "EEE d")}
                      </div>
                      <div className="flex-1 h-7 rounded-md bg-muted/40 overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.4 }}
                          className="h-full bg-primary/80"
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
                          <span className="text-muted-foreground">
                            {d.count} {d.count === 1 ? "entry" : "entries"}
                          </span>
                          <span className="font-medium">{formatGBP(d.cost)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* LOG WASTE DIALOG */}
      <Dialog open={showLog} onOpenChange={setShowLog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Log Waste</DialogTitle>
            <DialogDescription>Record a waste entry for tracking and reporting.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="item">Item</Label>
              <Input
                id="item"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Sourdough loaves"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger id="unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cost">Estimated cost (£)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything useful for context"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLog(false)}>Cancel</Button>
            <Button onClick={() => logWaste.mutate()} disabled={logWaste.isPending}>
              {logWaste.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Log Waste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WasteLog;
