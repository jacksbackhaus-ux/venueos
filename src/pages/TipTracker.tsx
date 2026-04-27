import { useEffect, useMemo, useState } from "react";
import { Coins, Plus, Download, CheckCircle2, Calendar, ChevronLeft, ChevronRight, PieChart, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DistributionMethod = "equal" | "hours" | "manual";
type PoolStatus = "draft" | "confirmed" | "exported";

type TipPool = {
  id: string;
  site_id: string;
  organisation_id: string;
  date: string;
  total_amount: number;
  distribution_method: DistributionMethod;
  status: PoolStatus;
  notes: string | null;
  created_by: string | null;
};

type TipAllocation = {
  id: string;
  tip_pool_id: string;
  user_id: string;
  hours_worked: number | null;
  tip_amount: number;
};

type Staff = { id: string; display_name: string };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}
function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function toCSV(rows: (string | number)[][]) {
  return rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}

const DISTRIBUTION_METHODS: { value: DistributionMethod; label: string; short: string }[] = [
  { value: "equal", label: "Split equally between all staff", short: "Equal" },
  { value: "hours", label: "Split proportionally by hours worked", short: "By hours" },
  { value: "manual", label: "Enter amounts manually", short: "Manual" },
];

export default function TipTracker() {
  const { appUser, staffSession } = useAuth();
  const { currentSite } = useSite();
  const role = useRole();

  const currentUserId = appUser?.id || staffSession?.user_id || null;
  const siteId = currentSite?.id || null;
  const orgId = currentSite?.organisation_id || appUser?.organisation_id || null;

  const [pools, setPools] = useState<TipPool[]>([]);
  const [allocations, setAllocations] = useState<TipAllocation[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<DistributionMethod>("equal");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formNotes, setFormNotes] = useState("");
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Week range (Mon–Sun)
  const { weekStart, weekEnd, weekLabel, weekStartStr, weekEndStr } = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const mondayDelta = day === 0 ? -6 : 1 - day;
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(today.getDate() + mondayDelta + weekOffset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return {
      weekStart: start,
      weekEnd: end,
      weekStartStr: fmt(start),
      weekEndStr: fmt(end),
      weekLabel: `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    };
  }, [weekOffset]);

  // Load active staff at the site (managers only)
  useEffect(() => {
    if (!siteId || !role.isSupervisorPlus) return;
    (async () => {
      const { data: members } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("site_id", siteId)
        .eq("active", true);
      const ids = (members || []).map((m: any) => m.user_id);
      if (!ids.length) { setStaff([]); return; }
      const { data: users } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", ids)
        .eq("status", "active");
      const list = ((users as Staff[] | null) || []).sort((a, b) => a.display_name.localeCompare(b.display_name));
      setStaff(list);
      const map: Record<string, string> = {};
      list.forEach(u => { map[u.id] = u.display_name; });
      setStaffMap(map);
    })();
  }, [siteId, role.isSupervisorPlus]);

  // Load pools + allocations for week
  const loadData = async () => {
    if (!siteId) return;
    const { data: poolRows } = await supabase
      .from("tip_pools")
      .select("*")
      .eq("site_id", siteId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr)
      .order("date", { ascending: false });
    const ps = (poolRows || []) as TipPool[];
    setPools(ps);

    if (ps.length) {
      const { data: allocRows } = await supabase
        .from("tip_allocations")
        .select("*")
        .in("tip_pool_id", ps.map(p => p.id));
      const allocs = (allocRows || []) as TipAllocation[];
      setAllocations(allocs);

      // Backfill staff name lookups for staff view
      const missing = Array.from(new Set(allocs.map(a => a.user_id))).filter(id => !staffMap[id]);
      if (missing.length) {
        const { data: users } = await supabase.from("users").select("id, display_name").in("id", missing);
        const next = { ...staffMap };
        ((users as Staff[] | null) || []).forEach(u => { next[u.id] = u.display_name; });
        setStaffMap(next);
      }
    } else {
      setAllocations([]);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [siteId, weekStartStr, weekEndStr]);

  // Realtime
  useEffect(() => {
    if (!siteId) return;
    const ch = supabase
      .channel(`tips-${siteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tip_pools", filter: `site_id=eq.${siteId}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tip_allocations" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [siteId, weekStartStr]);

  const totalWeekTips = pools.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

  // Staff: my allocations across the visible pools
  const myAllocations = useMemo(
    () => allocations.filter(a => a.user_id === currentUserId),
    [allocations, currentUserId]
  );
  const myWeekTotal = myAllocations.reduce((s, a) => s + Number(a.tip_amount || 0), 0);

  function allocCountForPool(poolId: string) {
    return allocations.filter(a => a.tip_pool_id === poolId).length;
  }

  const openAddDialog = () => {
    setFormAmount("");
    setFormMethod("equal");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormNotes("");
    const init: Record<string, string> = {};
    staff.forEach(s => { init[s.id] = ""; });
    setManualAmounts(init);
    setShowAdd(true);
  };

  // Build allocations based on chosen method
  async function buildAllocations(method: DistributionMethod, total: number, date: string): Promise<{ user_id: string; hours_worked: number | null; tip_amount: number }[]> {
    if (!staff.length) return [];

    if (method === "manual") {
      return staff
        .map(s => ({ user_id: s.id, hours_worked: null as number | null, tip_amount: Math.round((parseFloat(manualAmounts[s.id] || "0") || 0) * 100) / 100 }))
        .filter(a => a.tip_amount > 0);
    }

    if (method === "hours") {
      // Pull timesheets for the date for all staff
      const dayStart = new Date(date + "T00:00:00").toISOString();
      const dayEnd = new Date(new Date(date + "T00:00:00").getTime() + 24 * 60 * 60 * 1000).toISOString();
      const { data: ts } = await supabase
        .from("timesheet_entries")
        .select("user_id, clock_in, clock_out, break_minutes")
        .eq("site_id", siteId)
        .gte("clock_in", dayStart)
        .lt("clock_in", dayEnd)
        .not("clock_out", "is", null);

      const hoursByUser: Record<string, number> = {};
      ((ts as any[]) || []).forEach(e => {
        const mins = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 60000 - (e.break_minutes || 0);
        const hrs = Math.max(0, mins / 60);
        hoursByUser[e.user_id] = (hoursByUser[e.user_id] || 0) + hrs;
      });
      const totalHours = Object.values(hoursByUser).reduce((s, h) => s + h, 0);

      if (totalHours <= 0) {
        toast.info("No timesheet hours for that date — splitting equally instead.");
        return splitEqual(total);
      }

      const usersWithHours = staff.filter(s => (hoursByUser[s.id] || 0) > 0);
      const allocs = usersWithHours.map(s => ({
        user_id: s.id,
        hours_worked: Math.round(hoursByUser[s.id] * 100) / 100,
        tip_amount: Math.round(((hoursByUser[s.id] / totalHours) * total) * 100) / 100,
      }));
      return reconcileRounding(allocs, total);
    }

    return splitEqual(total);
  }

  function splitEqual(total: number) {
    const share = Math.floor((total / staff.length) * 100) / 100;
    const allocs = staff.map(s => ({ user_id: s.id, hours_worked: null as number | null, tip_amount: share }));
    return reconcileRounding(allocs, total);
  }

  function reconcileRounding<T extends { tip_amount: number }>(allocs: T[], total: number): T[] {
    if (!allocs.length) return allocs;
    const sum = allocs.reduce((s, a) => s + a.tip_amount, 0);
    const diff = Math.round((total - sum) * 100) / 100;
    if (diff !== 0) {
      allocs[0] = { ...allocs[0], tip_amount: Math.round((allocs[0].tip_amount + diff) * 100) / 100 };
    }
    return allocs;
  }

  const handleSave = async () => {
    if (!siteId || !orgId || !currentUserId) {
      toast.error("Missing site or user context");
      return;
    }
    const total = parseFloat(formAmount);
    if (formMethod !== "manual" && (!formAmount || isNaN(total) || total <= 0)) {
      toast.error("Please enter a valid tip amount");
      return;
    }
    if (!staff.length) {
      toast.error("No active staff at this site to distribute tips to");
      return;
    }

    setSaving(true);
    const allocs = await buildAllocations(formMethod, total || 0, formDate);
    const computedTotal = formMethod === "manual"
      ? Math.round(allocs.reduce((s, a) => s + a.tip_amount, 0) * 100) / 100
      : total;

    if (computedTotal <= 0) {
      setSaving(false);
      toast.error("Total tips must be greater than zero");
      return;
    }

    const { data: pool, error: poolErr } = await supabase
      .from("tip_pools")
      .insert({
        site_id: siteId,
        organisation_id: orgId,
        date: formDate,
        total_amount: computedTotal,
        distribution_method: formMethod,
        status: "confirmed",
        notes: formNotes || null,
        created_by: currentUserId,
      })
      .select()
      .single();

    if (poolErr || !pool) {
      setSaving(false);
      toast.error(poolErr?.message || "Could not save tip pool");
      return;
    }

    if (allocs.length) {
      const { error: allocErr } = await supabase
        .from("tip_allocations")
        .insert(allocs.map(a => ({ ...a, tip_pool_id: (pool as any).id })));
      if (allocErr) {
        setSaving(false);
        toast.error(allocErr.message);
        return;
      }
    }

    setSaving(false);
    toast.success(`Tip pool of ${formatCurrency(computedTotal)} saved`);
    setShowAdd(false);
    loadData();
  };

  const handleExport = async () => {
    if (!pools.length) { toast.info("No tips to export this week"); return; }
    const header = ["Date", "Staff", "Hours worked", "Tip amount (£)", "Distribution", "Pool total (£)"];
    const body: (string | number)[][] = [];
    pools.forEach(p => {
      const allocs = allocations.filter(a => a.tip_pool_id === p.id);
      if (!allocs.length) {
        body.push([p.date, "(no allocations)", "", "", p.distribution_method, Number(p.total_amount).toFixed(2)]);
      } else {
        allocs.forEach(a => {
          body.push([
            p.date,
            staffMap[a.user_id] || a.user_id,
            a.hours_worked != null ? Number(a.hours_worked).toFixed(2) : "",
            Number(a.tip_amount).toFixed(2),
            p.distribution_method,
            Number(p.total_amount).toFixed(2),
          ]);
        });
      }
    });
    const csv = toCSV([header, ...body]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tips_${weekStartStr}_to_${weekEndStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // Mark exported
    const ids = pools.map(p => p.id);
    await supabase.from("tip_pools").update({ status: "exported" }).in("id", ids);
    toast.success(`Exported ${body.length} rows`);
  };

  const statusBadge = (status: PoolStatus) => {
    switch (status) {
      case "draft": return <Badge variant="outline" className="text-[10px]">Draft</Badge>;
      case "confirmed": return <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case "exported": return <Badge className="bg-primary/10 text-primary border-0 text-[10px]"><Download className="h-3 w-3 mr-1" />Exported</Badge>;
    }
  };

  const manualSum = useMemo(
    () => staff.reduce((s, st) => s + (parseFloat(manualAmounts[st.id] || "0") || 0), 0),
    [manualAmounts, staff]
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-heading text-2xl font-bold">Tip Tracker</h1>
            <p className="text-xs text-muted-foreground">{currentSite?.name || "Your site"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {role.isSupervisorPlus && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add Tips
              </Button>
            </>
          )}
        </div>
      </div>

      {/* UK Legal notice */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Under the <strong>Employment (Allocation of Tips) Act 2023</strong>, 100% of tips must be passed to staff with transparent records. This module helps you comply.
          </p>
        </CardContent>
      </Card>

      {/* Week summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Week Summary
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-1 min-w-[140px] text-center">{weekLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pools.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Coins className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No tip entries this week.</p>
              {role.isSupervisorPlus && (
                <Button size="sm" variant="outline" onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Entry
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pools.map(pool => {
                const count = allocCountForPool(pool.id);
                const perPerson = count > 0 ? Number(pool.total_amount) / count : 0;
                const methodShort = DISTRIBUTION_METHODS.find(m => m.value === pool.distribution_method)?.short || pool.distribution_method;
                return (
                  <div key={pool.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{formatDate(pool.date)}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} staff · {methodShort}{pool.distribution_method === "equal" && count > 0 ? ` · ${formatCurrency(perPerson)} each` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatCurrency(Number(pool.total_amount))}</span>
                      {statusBadge(pool.status)}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2">
                <span className="text-sm text-muted-foreground">Total tips this week</span>
                <span className="text-sm font-bold text-success">{formatCurrency(totalWeekTips)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff view — my tips */}
      {!role.isSupervisorPlus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4" />
              My Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myAllocations.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <p className="text-sm text-muted-foreground">No tip allocations for you this week yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myAllocations.map(a => {
                  const pool = pools.find(p => p.id === a.tip_pool_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{pool ? formatDate(pool.date) : "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.hours_worked != null ? `${Number(a.hours_worked).toFixed(2)}h worked` : "Equal share"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-success">{formatCurrency(Number(a.tip_amount))}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Your total this week</span>
                  <span className="text-sm font-bold text-success">{formatCurrency(myWeekTotal)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Distribution breakdown — managers */}
      {role.isSupervisorPlus && pools.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Per-Staff Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const totalsByUser: Record<string, number> = {};
              allocations.forEach(a => { totalsByUser[a.user_id] = (totalsByUser[a.user_id] || 0) + Number(a.tip_amount || 0); });
              const rows = Object.entries(totalsByUser).sort((a, b) => b[1] - a[1]);
              if (!rows.length) return <p className="text-sm text-muted-foreground text-center py-4">No allocations yet.</p>;
              return (
                <div className="space-y-2">
                  {rows.map(([uid, total]) => (
                    <div key={uid} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm">{staffMap[uid] || "Unknown"}</span>
                      <span className="text-sm font-semibold">{formatCurrency(total)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Add Tips Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Tip Pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Distribution method</Label>
              <Select value={formMethod} onValueChange={(v) => setFormMethod(v as DistributionMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISTRIBUTION_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formMethod !== "manual" && (
              <div className="space-y-1.5">
                <Label htmlFor="amount">Total tip amount (£)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                />
                {formMethod === "equal" && staff.length > 0 && formAmount && parseFloat(formAmount) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(parseFloat(formAmount) / staff.length)} per person across {staff.length} staff
                  </p>
                )}
              </div>
            )}

            {formMethod === "manual" && (
              <div className="space-y-2">
                <Label>Per-staff amounts (£)</Label>
                {staff.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active staff at this site.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {staff.map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate">{s.display_name}</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={manualAmounts[s.id] || ""}
                          onChange={e => setManualAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                          className="w-24 h-8"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground">Pool total</span>
                  <span className="font-semibold">{formatCurrency(manualSum)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="e.g. Saturday dinner service"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {saving ? "Saving…" : "Save Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
