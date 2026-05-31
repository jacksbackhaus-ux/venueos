import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSite } from "@/contexts/SiteContext";
import { SafeToTradeHero } from "@/components/dashboard/SafeToTradeHero";
import { PriorityFeed } from "@/components/dashboard/PriorityFeed";
import { TodayAtAGlance } from "@/components/dashboard/TodayAtAGlance";
import { ThisWeekSnapshot } from "@/components/dashboard/ThisWeekSnapshot";
import { ProfitSnapshot } from "@/components/dashboard/ProfitSnapshot";
import { DashboardFeedback } from "@/components/dashboard/DashboardFeedback";
import { Card } from "@/components/ui/card";

/**
 * Operator Command Centre.
 * Strict five-section layout (per v1 spec):
 *   1) Safe to Trade   2) Priority Feed   3) Today   4) This Week   5) Profit Snapshot
 * Reuses existing hooks/components — no new data systems.
 */
const Dashboard = () => {
  const { currentSite, currentMembership } = useSite();
  const { staffSession, appUser } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id;
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;
  const viewedDate = new Date(`${selectedDate}T12:00:00`);
  const dateStr = isToday
    ? "Today"
    : viewedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const role = currentMembership?.site_role || staffSession?.site_role;
  const canCloseDay = role === "owner" || role === "supervisor";
  const currentUserId = appUser?.id ?? staffSession?.user_id ?? null;
  const displayName = appUser?.display_name ?? (staffSession as any)?.display_name ?? undefined;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const minDate = currentSite?.created_at?.slice(0, 10);
  const isAtFloor = !!minDate && selectedDate <= minDate;

  const shiftDate = (days: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr) return;
    if (minDate && next < minDate) return;
    setSelectedDate(next);
  };

  // Lightweight closed-day check (drives the closed-day banner only).
  const { data: closedDay } = useQuery({
    queryKey: ["dashboard-closed-day", siteId, selectedDate],
    enabled: !!siteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("closed_days" as any)
        .select("id, closed_by_name")
        .eq("site_id", siteId!)
        .eq("closed_date", selectedDate)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });
  const isClosed = !!closedDay;

  const closeDayMutation = useMutation({
    mutationFn: async (close: boolean) => {
      if (!siteId || !currentSite) throw new Error("No site");
      if (close) {
        const { error } = await supabase.from("closed_days" as any).insert({
          site_id: siteId,
          organisation_id: currentSite.organisation_id,
          closed_date: selectedDate,
          closed_by_user_id: appUser?.id ?? null,
          closed_by_name: appUser?.display_name ?? (staffSession as any)?.display_name ?? null,
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("closed_days" as any)
          .delete()
          .eq("site_id", siteId)
          .eq("closed_date", selectedDate);
        if (error) throw error;
      }
    },
    onSuccess: (_d, close) => {
      toast.success(close ? "Day marked as closed" : "Day reopened");
      queryClient.invalidateQueries({ queryKey: ["dashboard-closed-day", siteId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["safe-to-trade", siteId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["priority-feed", siteId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-today-glance", siteId, selectedDate] });
    },
    onError: (e: any) => toast.error(e.message ?? "Action failed"),
  });

  const handleToggleClosed = () => {
    if (!canCloseDay) return;
    if (isClosed) {
      if (!confirm("Reopen this day? Tasks and tracking will resume counting.")) return;
      closeDayMutation.mutate(false);
    } else {
      if (!confirm(`Mark ${isToday ? "today" : dateStr} as a closed day? It won't count toward compliance.`)) return;
      closeDayMutation.mutate(true);
    }
  };

  if (!siteId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Select a site to view your dashboard.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto pb-12">
      {/* Date nav + closed-day control */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border bg-card px-2 py-1.5">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => shiftDate(-1)} disabled={isAtFloor} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span>{dateStr}</span>
            {!isToday && (
              <button type="button" onClick={() => setSelectedDate(todayStr)} className="text-xs text-primary underline-offset-2 hover:underline">
                Jump to today
              </button>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => shiftDate(1)} disabled={isToday} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {(isClosed || canCloseDay) && (
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isClosed ? "bg-muted/40" : "bg-card"}`}>
            <div className="flex items-center gap-2 min-w-0">
              {isClosed ? <Lock className="h-4 w-4 text-muted-foreground shrink-0" /> : <Unlock className="h-4 w-4 text-muted-foreground shrink-0" />}
              <p className="text-xs sm:text-sm truncate">
                {isClosed
                  ? `Closed${(closedDay as any)?.closed_by_name ? ` by ${(closedDay as any).closed_by_name}` : ""} — excluded from compliance.`
                  : "Site closed on this day? Mark it so it doesn't count against compliance."}
              </p>
            </div>
            {canCloseDay && (
              <Button size="sm" variant={isClosed ? "outline" : "secondary"} onClick={handleToggleClosed} disabled={closeDayMutation.isPending} className="shrink-0">
                {isClosed ? "Reopen" : "Mark closed"}
              </Button>
            )}
          </div>
        )}
      </motion.div>

      {/* 1 — SAFE TO TRADE (hero) */}
      <SafeToTradeHero
        siteId={siteId}
        dateISO={selectedDate}
        greeting={isToday ? greeting : undefined}
        displayName={displayName}
      />

      {/* 2 — PRIORITY FEED (what needs doing now) */}
      <PriorityFeed siteId={siteId} dateISO={selectedDate} currentUserId={currentUserId} />

      {/* 3 — TODAY OVERVIEW */}
      {!isClosed && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Today</h2>
          <TodayAtAGlance siteId={siteId} dateISO={selectedDate} />
        </section>
      )}

      {/* 4 — THIS WEEK OVERVIEW */}
      <ThisWeekSnapshot siteId={siteId} />

      {/* 5 — PROFIT SNAPSHOT (lightweight) */}
      <ProfitSnapshot siteId={siteId} />

      {/* Feedback link */}
      <div className="pt-4 flex justify-center">
        <DashboardFeedback />
      </div>
    </div>
  );
};

export default Dashboard;
