import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// =====================================================================
// Types
// =====================================================================
export type ShiftRequestType = "swap" | "cover";
export type ShiftRequestStatus =
  | "pending_teammate"
  | "pending_approval"
  | "approved"
  | "declined"
  | "cancelled"
  | "expired";

export interface ShiftRequest {
  id: string;
  organisation_id: string;
  site_id: string;
  original_shift_id: string;
  request_type: ShiftRequestType;
  requester_id: string;
  target_user_id: string | null;
  target_shift_id: string | null;
  status: ShiftRequestStatus;
  message: string | null;
  manager_id: string | null;
  manager_decision_at: string | null;
  manager_note: string | null;
  teammate_responded_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompensationLog {
  id: string;
  site_id: string;
  shift_id: string | null;
  user_id: string;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  shift_hours: number;
  hourly_rate_used: number;
  cancellation_reason: string | null;
  notice_given_hours: number;
  pct_applied: number;
  compensation_amount: number;
  is_paid: boolean;
  paid_at: string | null;
  payroll_export_ref: string | null;
  created_at: string;
}

export interface AvailabilityWindow {
  id: string;
  user_id: string;
  site_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes: string | null;
}

export interface CompSettings {
  site_id: string;
  short_notice_hours: number;
  very_short_notice_hours: number;
  short_notice_pct: number;
  very_short_notice_pct: number;
  default_hourly_rate: number | null;
}

// =====================================================================
// useShiftRequests — list, create, respond, approve/decline
// =====================================================================
export function useShiftRequests() {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const siteId = currentSite?.id || null;
  const myId = appUser?.id || null;
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!siteId) { setRequests([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("shift_requests")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests((data ?? []) as ShiftRequest[]);
    } catch (e) {
      console.error("Failed to load shift requests", e);
    } finally { setLoading(false); }
  }, [siteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Realtime
  useEffect(() => {
    if (!siteId) return;
    const ch = supabase
      .channel(`shift-requests-${siteId}`)
      .on("postgres_changes" as never,
        { event: "*", schema: "public", table: "shift_requests", filter: `site_id=eq.${siteId}` },
        () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [siteId, refresh]);

  const createSwap = useCallback(async (params: {
    originalShiftId: string;
    targetUserId: string;
    targetShiftId?: string;
    message?: string;
  }) => {
    if (!siteId || !myId || !currentSite) return;
    const { error } = await supabase.from("shift_requests").insert({
      organisation_id: currentSite.organisation_id,
      site_id: siteId,
      original_shift_id: params.originalShiftId,
      request_type: "swap",
      requester_id: myId,
      target_user_id: params.targetUserId,
      target_shift_id: params.targetShiftId ?? null,
      message: params.message ?? null,
      status: "pending_teammate",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Swap requested");
    void refresh();
  }, [siteId, myId, currentSite, refresh]);

  const createCover = useCallback(async (params: {
    originalShiftId: string;
    targetUserId?: string | null;
    message?: string;
  }) => {
    if (!siteId || !myId || !currentSite) return;
    const { error } = await supabase.from("shift_requests").insert({
      organisation_id: currentSite.organisation_id,
      site_id: siteId,
      original_shift_id: params.originalShiftId,
      request_type: "cover",
      requester_id: myId,
      target_user_id: params.targetUserId ?? null,
      message: params.message ?? null,
      status: params.targetUserId ? "pending_teammate" : "pending_approval",
    });
    if (error) { toast.error(error.message); return; }
    toast.success(params.targetUserId ? "Cover requested" : "Posted to cover pool");
    void refresh();
  }, [siteId, myId, currentSite, refresh]);

  const respondToSwap = useCallback(async (requestId: string, accept: boolean) => {
    const updates: Partial<ShiftRequest> = {
      teammate_responded_at: new Date().toISOString(),
      status: accept ? "pending_approval" : "declined",
    };
    const { error } = await supabase.from("shift_requests").update(updates).eq("id", requestId);
    if (error) { toast.error(error.message); return; }
    toast.success(accept ? "Swap accepted — awaiting manager" : "Swap declined");
  }, []);

  const claimCover = useCallback(async (requestId: string) => {
    if (!myId) return;
    const { error } = await supabase.from("shift_requests")
      .update({
        target_user_id: myId,
        teammate_responded_at: new Date().toISOString(),
        status: "pending_approval",
      })
      .eq("id", requestId);
    if (error) { toast.error(error.message); return; }
    toast.success("Cover claimed — awaiting manager approval");
  }, [myId]);

  const managerDecide = useCallback(async (req: ShiftRequest, approve: boolean, note?: string) => {
    if (!myId) return;
    // 1. Update the request
    const { error: reqErr } = await supabase.from("shift_requests")
      .update({
        status: approve ? "approved" : "declined",
        manager_id: myId,
        manager_decision_at: new Date().toISOString(),
        manager_note: note ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (reqErr) { toast.error(reqErr.message); return; }

    // 2. If approved, mutate rota_assignments
    if (approve && req.target_user_id) {
      if (req.request_type === "swap" && req.target_shift_id) {
        // Two-way swap
        await supabase.from("rota_assignments").update({ user_id: req.target_user_id }).eq("id", req.original_shift_id);
        await supabase.from("rota_assignments").update({ user_id: req.requester_id }).eq("id", req.target_shift_id);
      } else {
        // Cover or one-way swap: original shift goes to target
        await supabase.from("rota_assignments").update({ user_id: req.target_user_id }).eq("id", req.original_shift_id);
      }
    }
    toast.success(approve ? "Request approved" : "Request declined");
  }, [myId]);

  const cancelRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase.from("shift_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) { toast.error(error.message); return; }
    toast.success("Request cancelled");
  }, []);

  // Buckets for UI
  const myRequests = useMemo(() => requests.filter(r => r.requester_id === myId), [requests, myId]);
  const incomingForMe = useMemo(() => requests.filter(r =>
    r.target_user_id === myId && r.status === "pending_teammate"
  ), [requests, myId]);
  const openCoverPool = useMemo(() => requests.filter(r =>
    r.request_type === "cover" && r.target_user_id === null && r.status === "pending_approval"
  ), [requests]);
  const pendingManager = useMemo(() => requests.filter(r => r.status === "pending_approval"), [requests]);

  return {
    loading, requests, myRequests, incomingForMe, openCoverPool, pendingManager,
    createSwap, createCover, respondToSwap, claimCover, managerDecide, cancelRequest, refresh,
  };
}

// =====================================================================
// useStaffAvailability
// =====================================================================
export function useStaffAvailability(userId?: string | null) {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const siteId = currentSite?.id || null;
  const targetUserId = userId ?? appUser?.id ?? null;
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!siteId || !targetUserId) { setWindows([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase.from("staff_availability")
        .select("*")
        .eq("site_id", siteId)
        .eq("user_id", targetUserId)
        .order("day_of_week").order("start_time");
      if (error) throw error;
      setWindows((data ?? []) as AvailabilityWindow[]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [siteId, targetUserId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addWindow = useCallback(async (w: { day_of_week: number; start_time: string; end_time: string; is_available?: boolean; notes?: string }) => {
    if (!siteId || !targetUserId || !currentSite) return;
    const { error } = await supabase.from("staff_availability").insert({
      user_id: targetUserId, site_id: siteId, organisation_id: currentSite.organisation_id,
      day_of_week: w.day_of_week, start_time: w.start_time, end_time: w.end_time,
      is_available: w.is_available ?? true, notes: w.notes ?? null,
    });
    if (error) { toast.error(error.message); return; }
    void refresh();
  }, [siteId, targetUserId, currentSite, refresh]);

  const deleteWindow = useCallback(async (id: string) => {
    const { error } = await supabase.from("staff_availability").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void refresh();
  }, [refresh]);

  return { windows, loading, addWindow, deleteWindow, refresh };
}

// =====================================================================
// useCompensationLogs — manager view + payroll export
// =====================================================================
export function useCompensationLogs() {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const siteId = currentSite?.id || null;
  const [logs, setLogs] = useState<CompensationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!siteId) { setLogs([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase.from("shift_compensation_logs")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLogs((data ?? []) as CompensationLog[]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [siteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!siteId) return;
    const ch = supabase.channel(`comp-logs-${siteId}`)
      .on("postgres_changes" as never,
        { event: "*", schema: "public", table: "shift_compensation_logs", filter: `site_id=eq.${siteId}` },
        () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [siteId, refresh]);

  const markPaid = useCallback(async (ids: string[], exportRef?: string) => {
    if (!appUser?.id || !ids.length) return;
    const { error } = await supabase.from("shift_compensation_logs")
      .update({
        is_paid: true,
        paid_at: new Date().toISOString(),
        paid_by_user_id: appUser.id,
        payroll_export_ref: exportRef ?? `EXPORT-${Date.now()}`,
      })
      .in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} record(s) marked paid`);
  }, [appUser?.id]);

  const unpaidTotal = useMemo(() => logs.filter(l => !l.is_paid).reduce((s, l) => s + Number(l.compensation_amount), 0), [logs]);
  const unpaid = useMemo(() => logs.filter(l => !l.is_paid), [logs]);
  const paid = useMemo(() => logs.filter(l => l.is_paid), [logs]);

  return { logs, unpaid, paid, unpaidTotal, loading, markPaid, refresh };
}

// =====================================================================
// useCompSettings — per-site late-cancel rules
// =====================================================================
export function useCompSettings() {
  const { currentSite } = useSite();
  const siteId = currentSite?.id || null;
  const [settings, setSettings] = useState<CompSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!siteId || !currentSite) { setSettings(null); setLoading(false); return; }
    try {
      setLoading(true);
      let { data, error } = await supabase.from("site_compensation_settings")
        .select("*").eq("site_id", siteId).maybeSingle();
      if (error) throw error;
      if (!data) {
        const inserted = await supabase.from("site_compensation_settings")
          .insert({ site_id: siteId, organisation_id: currentSite.organisation_id })
          .select("*").single();
        data = inserted.data;
      }
      setSettings(data as CompSettings);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [siteId, currentSite]);

  useEffect(() => { void load(); }, [load]);

  const update = useCallback(async (patch: Partial<CompSettings>) => {
    if (!siteId) return;
    const { error } = await supabase.from("site_compensation_settings").update(patch).eq("site_id", siteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved");
    void load();
  }, [siteId, load]);

  return { settings, loading, update };
}

// =====================================================================
// Cancellation: preview + confirm with reason
// =====================================================================
export async function previewCompensation(args: {
  siteId: string;
  userId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}) {
  // Pull settings
  const { data: settings } = await supabase.from("site_compensation_settings")
    .select("*").eq("site_id", args.siteId).maybeSingle();
  const shortNotice = settings?.short_notice_hours ?? 48;
  const veryShort = settings?.very_short_notice_hours ?? 24;
  const shortPct = Number(settings?.short_notice_pct ?? 25);
  const veryPct = Number(settings?.very_short_notice_pct ?? 50);

  // Hours until
  const start = new Date(`${args.shiftDate}T${args.startTime}`);
  const hoursUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60);

  // Hourly rate fallback chain
  const { data: u } = await supabase.from("users").select("hourly_rate, organisation_id").eq("id", args.userId).maybeSingle();
  let rate = u?.hourly_rate ? Number(u.hourly_rate) : null;
  if (!rate) rate = settings?.default_hourly_rate ? Number(settings.default_hourly_rate) : null;
  if (!rate && u?.organisation_id) {
    const { data: org } = await supabase.from("org_cost_settings").select("labour_hourly_rate").eq("organisation_id", u.organisation_id).maybeSingle();
    rate = org?.labour_hourly_rate ? Number(org.labour_hourly_rate) : 12;
  }
  rate = rate ?? 12;

  // Shift hours
  const [sh, sm] = args.startTime.split(":").map(Number);
  const [eh, em] = args.endTime.split(":").map(Number);
  let shiftHours = (eh + em / 60) - (sh + sm / 60);
  if (shiftHours < 0) shiftHours += 24;

  let pct = 0;
  let isLate = false;
  if (hoursUntil < veryShort) { pct = veryPct; isLate = true; }
  else if (hoursUntil < shortNotice) { pct = shortPct; isLate = true; }

  const amount = isLate ? Math.round(shiftHours * rate * (pct / 100) * 100) / 100 : 0;

  return {
    isLate,
    hoursUntil: Math.max(0, Math.round(hoursUntil * 10) / 10),
    shiftHours: Math.round(shiftHours * 10) / 10,
    hourlyRate: rate,
    pct,
    amount,
    shortNoticeHours: shortNotice,
    veryShortNoticeHours: veryShort,
  };
}

export async function cancelShiftWithReason(args: {
  shiftId: string;
  reason: string;
  userId: string;
}) {
  // Stamp reason first (trigger reads cancellation_reason from OLD row)
  const { error: updErr } = await supabase.from("rota_assignments")
    .update({
      cancellation_reason: args.reason,
      cancelled_by_user_id: args.userId,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", args.shiftId);
  if (updErr) { toast.error(updErr.message); return false; }

  // Then delete (which triggers compensation log if late)
  const { error: delErr } = await supabase.from("rota_assignments").delete().eq("id", args.shiftId);
  if (delErr) { toast.error(delErr.message); return false; }
  return true;
}

// =====================================================================
// Smart Fill: candidates for an open shift
// =====================================================================
export interface SmartFillCandidate {
  user_id: string;
  display_name: string;
  weekly_hours: number;
  available: boolean;
  has_clopen: boolean;
  has_overlap: boolean;
  exceeds_48h: boolean;
  score: number;
}

export async function findSmartFillCandidates(args: {
  siteId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  excludeUserIds?: string[];
}): Promise<SmartFillCandidate[]> {
  // 1. All staff on the site
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, users!inner(id, display_name, status)")
    .eq("site_id", args.siteId).eq("active", true);

  if (!members) return [];

  // 2. Compute the week start (Monday) for weekly hours
  const date = new Date(`${args.shiftDate}T12:00:00`);
  const day = (date.getDay() + 6) % 7;
  const weekStart = new Date(date); weekStart.setDate(date.getDate() - day);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  // 3. Shift hours for the open shift
  const [sh, sm] = args.startTime.split(":").map(Number);
  const [eh, em] = args.endTime.split(":").map(Number);
  let openShiftHours = (eh + em / 60) - (sh + sm / 60);
  if (openShiftHours < 0) openShiftHours += 24;

  // 4. Weekly hours per user
  const userIds = members.map(m => m.user_id).filter(uid => !args.excludeUserIds?.includes(uid));
  const { data: weekShifts } = await supabase.from("rota_assignments")
    .select("user_id, shift_date, start_time, end_time")
    .eq("site_id", args.siteId)
    .gte("shift_date", weekStartIso)
    .lt("shift_date", new Date(weekStart.getTime() + 7 * 86400000).toISOString().slice(0, 10))
    .is("cancelled_at", null);

  const hoursMap = new Map<string, number>();
  for (const s of weekShifts ?? []) {
    const [a, b] = (s.start_time as string).split(":").map(Number);
    const [c, d] = (s.end_time as string).split(":").map(Number);
    let h = (c + d / 60) - (a + b / 60);
    if (h < 0) h += 24;
    hoursMap.set(s.user_id, (hoursMap.get(s.user_id) ?? 0) + h);
  }

  // 5. Clopen/overlap checks per user
  const { data: dayShifts } = await supabase.from("rota_assignments")
    .select("user_id, shift_date, start_time, end_time")
    .eq("site_id", args.siteId)
    .gte("shift_date", new Date(date.getTime() - 86400000).toISOString().slice(0, 10))
    .lte("shift_date", new Date(date.getTime() + 86400000).toISOString().slice(0, 10))
    .is("cancelled_at", null);

  // 6. Availability windows
  const dow = date.getDay();
  const { data: avail } = await supabase.from("staff_availability")
    .select("user_id, day_of_week, start_time, end_time, is_available")
    .eq("site_id", args.siteId).eq("day_of_week", dow);

  const availMap = new Map<string, boolean>();
  for (const a of avail ?? []) {
    if (!a.is_available) continue;
    if (a.start_time <= args.startTime && a.end_time >= args.endTime) {
      availMap.set(a.user_id, true);
    }
  }

  const candidates: SmartFillCandidate[] = [];
  for (const m of members) {
    const uid = m.user_id;
    if (args.excludeUserIds?.includes(uid)) continue;
    const u = (m.users as unknown) as { display_name: string; status: string };
    if (u.status !== "active") continue;

    const weeklyHours = hoursMap.get(uid) ?? 0;
    const available = availMap.get(uid) ?? false;

    // Same-day overlap?
    const sameDay = (dayShifts ?? []).filter(s => s.user_id === uid && s.shift_date === args.shiftDate);
    const hasOverlap = sameDay.some(s => !(s.end_time <= args.startTime || s.start_time >= args.endTime));

    // Clopen with adjacent days
    const prevDay = new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
    const nextDay = new Date(date.getTime() + 86400000).toISOString().slice(0, 10);
    const prev = (dayShifts ?? []).filter(s => s.user_id === uid && s.shift_date === prevDay);
    const next = (dayShifts ?? []).filter(s => s.user_id === uid && s.shift_date === nextDay);

    const hasClopen =
      prev.some(p => {
        const prevEnd = new Date(`${prevDay}T${p.end_time}`);
        const thisStart = new Date(`${args.shiftDate}T${args.startTime}`);
        return (thisStart.getTime() - prevEnd.getTime()) / 3600000 < 11;
      }) ||
      next.some(n => {
        const thisEnd = new Date(`${args.shiftDate}T${args.endTime}`);
        const nextStart = new Date(`${nextDay}T${n.start_time}`);
        return (nextStart.getTime() - thisEnd.getTime()) / 3600000 < 11;
      });

    const exceeds48 = (weeklyHours + openShiftHours) > 48;

    // Score: available > clean > low hours
    let score = 0;
    if (available) score += 100;
    if (!hasClopen) score += 30;
    if (!exceeds48) score += 30;
    if (!hasOverlap) score += 50;
    score += Math.max(0, 40 - weeklyHours); // reward people with fewer hours

    if (!hasOverlap) {
      candidates.push({
        user_id: uid, display_name: u.display_name,
        weekly_hours: Math.round(weeklyHours * 10) / 10,
        available, has_clopen: hasClopen, has_overlap: hasOverlap,
        exceeds_48h: exceeds48, score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
