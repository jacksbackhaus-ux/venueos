import { useState } from "react";
import { Coins, Plus, Download, CheckCircle2, Users, Calendar, ChevronLeft, ChevronRight, PieChart, AlertCircle } from "lucide-react";
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
import { toast } from "sonner";

type TipEntry = {
  id: string;
  date: string;
  total_amount: number;
  distribution_method: "equal" | "hours" | "manual";
  status: "draft" | "confirmed" | "exported";
  staff_count: number;
  per_person: number;
};

type StaffTip = {
  id: string;
  display_name: string;
  hours_worked: number;
  tip_amount: number;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const DISTRIBUTION_METHODS = [
  { value: "equal", label: "Split equally between all staff" },
  { value: "hours", label: "Split proportionally by hours worked" },
  { value: "manual", label: "Enter amounts manually" },
];

const MOCK_ENTRIES: TipEntry[] = [];

export default function TipTracker() {
  const { appUser, staffSession } = useAuth();
  const { currentSite } = useSite();
  const role = useRole();

  const userName = appUser?.display_name || staffSession?.display_name || "You";
  const [entries] = useState<TipEntry[]>(MOCK_ENTRIES);
  const [showAdd, setShowAdd] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<string>("equal");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  // Week navigation
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const totalWeekTips = entries.reduce((sum, e) => sum + e.total_amount, 0);

  const handleSave = () => {
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast.error("Please enter a valid tip amount");
      return;
    }
    toast.success("Tip entry recorded! (Database coming soon)");
    setShowAdd(false);
    setFormAmount("");
    setFormMethod("equal");
  };

  const handleExport = () => {
    toast.info("CSV export will be available once the database is connected.");
  };

  const statusBadge = (status: TipEntry["status"]) => {
    switch (status) {
      case "draft": return <Badge variant="outline" className="text-[10px]">Draft</Badge>;
      case "confirmed": return <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case "exported": return <Badge className="bg-primary/10 text-primary border-0 text-[10px]"><Download className="h-3 w-3 mr-1" />Exported</Badge>;
    }
  };

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
              <Button size="sm" onClick={() => setShowAdd(true)}>
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
          {entries.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Coins className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No tip entries this week.</p>
              {role.isSupervisorPlus && (
                <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Entry
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{formatDate(entry.date)}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.staff_count} staff · {DISTRIBUTION_METHODS.find(m => m.value === entry.distribution_method)?.label.split(" ")[1]} split · {formatCurrency(entry.per_person)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatCurrency(entry.total_amount)}</span>
                    {statusBadge(entry.status)}
                  </div>
                </div>
              ))}
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
            <div className="text-center py-6 space-y-1">
              <p className="text-sm text-muted-foreground">Your tip allocations will appear here.</p>
              <p className="text-xs text-muted-foreground">Your manager logs tips and you'll see your share here automatically.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution breakdown placeholder */}
      {role.isSupervisorPlus && entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Distribution Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Per-staff breakdown will appear here once the database is connected.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Tips Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
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
            </div>
            <div className="space-y-1.5">
              <Label>Distribution method</Label>
              <Select value={formMethod} onValueChange={setFormMethod}>
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
            <Button className="w-full" onClick={handleSave}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Save Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
