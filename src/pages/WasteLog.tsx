import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trash2, Plus, Loader2, PoundSterling, CalendarDays, Search,
  TrendingDown, TrendingUp, Lightbulb, ShieldCheck, Filter, X,
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
import { WasteInsightStrip } from "@/components/waste/WasteInsightStrip";
import {
  startOfWeek, endOfWeek, startOfMonth, format, subDays, parseISO,
} from "date-fns";

// ─── Categories (kept compatible with existing waste_logs CHECK constraint) ──
type Category =
  | "food_prep" | "overproduction" | "spoilage" | "returned" | "packaging" | "other";

const CATEGORIES: { value: Category; label: string; preventable: boolean }[] = [
  { value: "overproduction", label: "Overproduction", preventable: true },
  { value: "food_prep",      label: "Damaged in production / Staff error", preventable: true },
  { value: "packaging",      label: "Damaged in storage / packaging", preventable: true },
  { value: "spoilage",       label: "Spoilage / expired", preventable: false },
  { value: "returned",       label: "Returned / customer issue", preventable: false },
  { value: "other",          label: "Unknown / other", preventable: false },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c])) as Record<Category, typeof CATEGORIES[number]>;
const UNITS = ["kg", "g", "units", "portions", "litres", "ml"];

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

interface ItemSuggestion {
  name: string;
  unit: string;
  costPerUnit: number | null;
  source: "ingredient" | "recipe";
}

const formatGBP = (n: number) =>
  `£${(Math.round(n * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WasteLog = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userId = appUser?.id || staffSession?.user_id || null;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const since90 = format(subDays(today, 90), "yyyy-MM-dd");

  // ── Fetch waste (last 90 days, used by all tabs) ──
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["waste_logs_v2", siteId, since90],
    queryFn: async (): Promise<WasteRow[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("waste_logs")
        .select("*")
        .eq("site_id", siteId)
        .gte("shift_date", since90)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WasteRow[];
    },
    enabled: !!siteId,
  });

  // ── Fetch item suggestions (ingredients + recipes) for fast add ──
  const { data: suggestions = [] } = useQuery({
    queryKey: ["waste_suggestions", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<ItemSuggestion[]> => {
      const [ing, rec] = await Promise.all([
        supabase.from("ingredients")
          .select("name, unit, cost_per_unit, active")
          .eq("site_id", siteId!).eq("active", true),
        supabase.from("recipes")
          .select("id, name, active, recipe_type")
          .eq("site_id", siteId!).eq("active", true),
      ]);
      const list: ItemSuggestion[] = [];
      (ing.data || []).forEach((i: any) => list.push({
        name: i.name, unit: i.unit || "kg",
        costPerUnit: i.cost_per_unit != null ? Number(i.cost_per_unit) : null,
        source: "ingredient",
      }));
      const recipeIds = (rec.data || []).map((r: any) => r.id);
      let recipeCost: Record<string, number> = {};
      if (recipeIds.length) {
        const { data: bs } = await supabase
          .from("batches")
          .select("recipe_id, unit_cost_snapshot, completed_at")
          .in("recipe_id", recipeIds)
          .not("unit_cost_snapshot", "is", null)
          .order("completed_at", { ascending: false })
          .limit(500);
        (bs || []).forEach((b: any) => {
          if (!recipeCost[b.recipe_id] && b.unit_cost_snapshot != null) {
            recipeCost[b.recipe_id] = Number(b.unit_cost_snapshot);
          }
        });
      }
      (rec.data || []).forEach((r: any) => list.push({
        name: r.name, unit: "units",
        costPerUnit: recipeCost[r.id] ?? null,
        source: "recipe",
      }));
      return list;
    },
  });

  // ── Derived metrics ──
  const enrich = (l: WasteRow) => ({
    ...l,
    cost: Number(l.estimated_cost || 0),
    preventable: CAT_MAP[l.category]?.preventable ?? false,
  });
  const enriched = useMemo(() => logs.map(enrich), [logs]);

  const sumCost = (rows: typeof enriched) => rows.reduce((s, r) => s + r.cost, 0);

  const todayLogs = enriched.filter(l => l.shift_date === todayStr);
  const weekLogs = enriched.filter(l => l.shift_date >= weekStart && l.shift_date <= weekEnd);
  const monthLogs = enriched.filter(l => l.shift_date >= monthStart);

  const valueToday = sumCost(todayLogs);
  const valueWeek = sumCost(weekLogs);
  const valueMonth = sumCost(monthLogs);
  const qtyWeek = weekLogs.reduce((s, r) => s + Number(r.quantity || 0), 0);

  // previous period comparison (previous week)
  const prevWeekStart = format(subDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  const prevWeekEnd = format(subDays(parseISO(weekStart), 1), "yyyy-MM-dd");
  const prevWeekValue = sumCost(enriched.filter(l => l.shift_date >= prevWeekStart && l.shift_date <= prevWeekEnd));
  const weekDelta = prevWeekValue === 0 ? null : ((valueWeek - prevWeekValue) / prevWeekValue) * 100;

  // preventable %
  const preventableCost = sumCost(monthLogs.filter(l => l.preventable));
  const preventablePct = valueMonth > 0 ? (preventableCost / valueMonth) * 100 : 0;

  // top items / reasons (this month)
  const topItems = useMemo(() => {
    const map = new Map<string, { cost: number; qty: number; unit: string }>();
    monthLogs.forEach(l => {
      const key = l.item_name.trim();
      const e = map.get(key) || { cost: 0, qty: 0, unit: l.unit };
      e.cost += l.cost; e.qty += Number(l.quantity || 0);
      map.set(key, e);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].cost - a[1].cost).slice(0, 5);
  }, [monthLogs]);

  const topReasons = useMemo(() => {
    const map = new Map<Category, { cost: number; count: number }>();
    monthLogs.forEach(l => {
      const e = map.get(l.category) || { cost: 0, count: 0 };
      e.cost += l.cost; e.count += 1;
      map.set(l.category, e);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].cost - a[1].cost).slice(0, 5);
  }, [monthLogs]);

  // recommended action — data-driven
  const recommendation = useMemo(() => {
    if (monthLogs.length === 0) return null;
    // 1. find item with most repeated preventable waste
    const preventableByItem = new Map<string, { cost: number; count: number; cat: Category }>();
    monthLogs.filter(l => l.preventable).forEach(l => {
      const e = preventableByItem.get(l.item_name) || { cost: 0, count: 0, cat: l.category };
      e.cost += l.cost; e.count += 1;
      preventableByItem.set(l.item_name, e);
    });
    const worst = Array.from(preventableByItem.entries()).sort((a, b) => b[1].cost - a[1].cost)[0];
    if (worst && worst[1].cost > 0) {
      const [name, info] = worst;
      if (info.cat === "overproduction")
        return `Review batch size or forecast for "${name}" — overproduction has cost ${formatGBP(info.cost)} this month.`;
      if (info.cat === "food_prep")
        return `Investigate repeated production issues for "${name}" — ${info.count} preventable entries this month.`;
      if (info.cat === "packaging")
        return `Review storage / handling for "${name}" — recurring damage cost ${formatGBP(info.cost)}.`;
    }
    // 2. spoilage pattern
    const spoilage = monthLogs.filter(l => l.category === "spoilage");
    if (spoilage.length >= 3) {
      const totalSpoil = sumCost(spoilage);
      return `Spoilage is recurring (${spoilage.length} entries, ${formatGBP(totalSpoil)}). Review shelf-life handling and ordering frequency.`;
    }
    return `Waste tracking is healthy — preventable waste is ${preventablePct.toFixed(0)}% of total this month.`;
  }, [monthLogs, preventablePct]);

  // ── Form state ──
  const [showLog, setShowLog] = useState(false);
  const [category, setCategory] = useState<Category>("overproduction");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [costEstimated, setCostEstimated] = useState(false);
  const [notes, setNotes] = useState("");
  const [shiftDate, setShiftDate] = useState(todayStr);

  // Auto-fill cost & unit when item matches a suggestion
  useEffect(() => {
    const match = suggestions.find(s => s.name.toLowerCase() === itemName.trim().toLowerCase());
    if (match) {
      if (match.unit) setUnit(match.unit);
      if (match.costPerUnit != null && quantity) {
        const c = match.costPerUnit * Number(quantity);
        if (!isNaN(c)) {
          setEstimatedCost(c.toFixed(2));
          setCostEstimated(true);
        }
      }
    }
  }, [itemName, quantity, suggestions]);

  const resetForm = () => {
    setItemName(""); setQuantity(""); setEstimatedCost(""); setNotes("");
    setCategory("overproduction"); setUnit("kg"); setShiftDate(todayStr);
    setCostEstimated(false);
  };

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
      queryClient.invalidateQueries({ queryKey: ["waste_logs_v2", siteId] });
      setShowLog(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateLast = () => {
    const last = enriched[0];
    if (!last) return toast.info("No previous entry to duplicate");
    setCategory(last.category);
    setItemName(last.item_name);
    setQuantity(String(last.quantity));
    setUnit(last.unit);
    setEstimatedCost(last.estimated_cost ? String(last.estimated_cost) : "");
    setNotes(last.notes || "");
    setShowLog(true);
  };

  // ── Log tab: filters ──
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [filterDate, setFilterDate] = useState<"7" | "30" | "90">("30");

  const filteredLogs = useMemo(() => {
    const cutoff = format(subDays(today, Number(filterDate)), "yyyy-MM-dd");
    return enriched.filter(l => {
      if (l.shift_date < cutoff) return false;
      if (filterCat !== "all" && l.category !== filterCat) return false;
      if (search && !l.item_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [enriched, search, filterCat, filterDate, today]);

  const recentItems = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of enriched) {
      const k = l.item_name.trim();
      if (!seen.has(k)) { seen.add(k); out.push(k); }
      if (out.length >= 6) break;
    }
    return out;
  }, [enriched]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-primary" />
            Waste tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Log waste in seconds. See what's costing you most.
          </p>
        </div>
        <Button onClick={() => setShowLog(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Log waste
        </Button>
      </div>

      <WasteInsightStrip />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="log">Waste Log</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Today" value={formatGBP(valueToday)} sub={`${todayLogs.length} ${todayLogs.length === 1 ? "entry" : "entries"}`} />
            <MetricCard
              label="This week" value={formatGBP(valueWeek)}
              sub={
                weekDelta == null
                  ? `${qtyWeek.toFixed(1)} units`
                  : `${weekDelta > 0 ? "▲" : "▼"} ${Math.abs(weekDelta).toFixed(0)}% vs last`
              }
              tone={weekDelta != null && weekDelta > 0 ? "warn" : "good"}
            />
            <MetricCard label="This month" value={formatGBP(valueMonth)} sub={`${monthLogs.length} entries`} />
            <MetricCard
              label="Preventable" value={`${preventablePct.toFixed(0)}%`}
              sub={formatGBP(preventableCost)} icon={<ShieldCheck className="h-3.5 w-3.5" />}
              tone={preventablePct > 50 ? "warn" : "good"}
            />
          </div>

          {recommendation && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4 flex gap-3 items-start">
                <div className="rounded-md bg-primary/10 p-2"><Lightbulb className="h-4 w-4 text-primary" /></div>
                <div>
                  <div className="text-xs font-medium text-primary mb-0.5">Recommended action</div>
                  <p className="text-sm text-foreground">{recommendation}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Top 5 wasted items (30d)</CardTitle></CardHeader>
              <CardContent>
                {topItems.length === 0 ? (
                  <EmptyHint text="No waste logged this month" />
                ) : (
                  <ul className="space-y-2">
                    {topItems.map(([name, info], i) => (
                      <li key={name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          <span className="font-medium truncate">{name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            · {info.qty.toFixed(1)} {info.unit}
                          </span>
                        </div>
                        <span className="font-semibold tabular-nums">{formatGBP(info.cost)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Top 5 waste reasons (30d)</CardTitle></CardHeader>
              <CardContent>
                {topReasons.length === 0 ? (
                  <EmptyHint text="No waste logged this month" />
                ) : (
                  <ul className="space-y-2">
                    {topReasons.map(([cat, info]) => (
                      <li key={cat} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant={CAT_MAP[cat]?.preventable ? "destructive" : "secondary"} className="font-normal text-[10px] uppercase tracking-wide">
                            {CAT_MAP[cat]?.preventable ? "Preventable" : "Non-prev."}
                          </Badge>
                          <span className="truncate">{CAT_MAP[cat]?.label || cat}</span>
                        </div>
                        <span className="font-semibold tabular-nums">{formatGBP(info.cost)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── WASTE LOG ── */}
        <TabsContent value="log" className="space-y-3">
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search item…" value={search}
                  onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
              <Select value={filterCat} onValueChange={(v) => setFilterCat(v as any)}>
                <SelectTrigger className="w-[200px]"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reasons</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterDate} onValueChange={(v) => setFilterDate(v as any)}>
                <SelectTrigger className="w-[140px]"><CalendarDays className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterCat !== "all" || filterDate !== "30") && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterCat("all"); setFilterDate("30"); }}>
                  <X className="h-3.5 w-3.5 mr-1" />Clear
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Trash2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No waste entries match these filters.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredLogs.map(l => (
                    <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {l.item_name}
                          <Badge variant="secondary" className="font-normal text-[10px]">
                            {CAT_MAP[l.category]?.label || l.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(l.shift_date), "EEE d MMM")} · {l.quantity} {l.unit} · {l.logged_by_name}
                          {l.notes ? ` · ${l.notes}` : ""}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums shrink-0">
                        {l.estimated_cost != null ? formatGBP(Number(l.estimated_cost)) : "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INSIGHTS ── */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading">Preventable vs non-preventable (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              {valueMonth === 0 ? (
                <EmptyHint text="No waste logged this month" />
              ) : (
                <div className="space-y-3">
                  <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${preventablePct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-destructive/70"
                    />
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${100 - preventablePct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-primary/40"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-destructive/70 mr-1.5" />
                      Preventable {formatGBP(preventableCost)} ({preventablePct.toFixed(0)}%)
                    </span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-primary/40 mr-1.5" />
                      Non-preventable {formatGBP(valueMonth - preventableCost)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Waste value — last 14 days</CardTitle></CardHeader>
            <CardContent>
              <DailyTrend rows={enriched} days={14} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add waste dialog ── */}
      <Dialog open={showLog} onOpenChange={(o) => { setShowLog(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Log waste</DialogTitle>
            <DialogDescription>Designed for speed — most fields auto-fill.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="item">Item</Label>
              <Input
                id="item" list="waste-item-suggestions"
                value={itemName} onChange={(e) => { setItemName(e.target.value); setCostEstimated(false); }}
                placeholder="Start typing — products & ingredients auto-suggest"
              />
              <datalist id="waste-item-suggestions">
                {suggestions.map(s => <option key={`${s.source}:${s.name}`} value={s.name} />)}
              </datalist>
              {recentItems.length > 0 && !itemName && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs text-muted-foreground self-center mr-1">Recent:</span>
                  {recentItems.map(r => (
                    <button key={r} type="button" onClick={() => setItemName(r)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border hover:bg-muted">
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="qty">Quantity</Label>
                <Input id="qty" type="number" step="0.01" min="0" inputMode="decimal"
                  value={quantity} onChange={(e) => { setQuantity(e.target.value); setCostEstimated(false); }}
                  placeholder="0" />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger id="unit"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="reason"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}{c.preventable ? " (preventable)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cost" className="flex items-center gap-1.5">
                  Cost (£)
                  {costEstimated && <span className="text-[10px] text-muted-foreground font-normal">estimated</span>}
                </Label>
                <Input id="cost" type="number" step="0.01" min="0" inputMode="decimal"
                  value={estimatedCost}
                  onChange={(e) => { setEstimatedCost(e.target.value); setCostEstimated(false); }}
                  placeholder="Optional" />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything useful for context" rows={2} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={duplicateLast} className="mr-auto">Duplicate last</Button>
            <Button variant="outline" onClick={() => setShowLog(false)}>Cancel</Button>
            <Button onClick={() => logWaste.mutate()} disabled={logWaste.isPending}>
              {logWaste.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Small presentational helpers ──
function MetricCard({
  label, value, sub, tone, icon,
}: { label: string; value: string; sub?: string; tone?: "good" | "warn"; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
        <div className="font-heading font-bold text-2xl mt-1 tabular-nums">{value}</div>
        {sub && (
          <div className={`text-xs mt-0.5 flex items-center gap-1 ${
            tone === "warn" ? "text-destructive" : tone === "good" ? "text-primary" : "text-muted-foreground"
          }`}>
            {tone === "warn" ? <TrendingUp className="h-3 w-3" /> : tone === "good" ? <TrendingDown className="h-3 w-3" /> : null}
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="text-center py-6 text-sm text-muted-foreground">{text}</div>;
}

function DailyTrend({ rows, days }: { rows: { shift_date: string; cost: number }[]; days: number }) {
  const out: { dayStr: string; cost: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    const cost = rows.filter(r => r.shift_date === d).reduce((s, r) => s + r.cost, 0);
    out.push({ dayStr: d, cost });
  }
  const max = Math.max(1, ...out.map(d => d.cost));
  return (
    <div className="space-y-1.5">
      {out.map(d => (
        <div key={d.dayStr} className="flex items-center gap-3">
          <div className="w-14 text-xs text-muted-foreground">{format(parseISO(d.dayStr), "EEE d")}</div>
          <div className="flex-1 h-5 rounded bg-muted/40 overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${(d.cost / max) * 100}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-primary/70"
            />
            <div className="absolute inset-0 flex items-center justify-end px-2 text-xs font-medium tabular-nums">
              {d.cost > 0 ? formatGBP(d.cost) : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WasteLog;
