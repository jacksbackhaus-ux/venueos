import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";

export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high";

export interface MessengerTask {
  id: string;
  site_id: string;
  organisation_id: string;
  channel_id: string | null;
  message_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  completed_at: string | null;
  // augmented
  assigned_to_name?: string | null;
  assigned_by_name?: string | null;
  channel_name?: string | null;
}

async function attachNames(tasks: MessengerTask[]): Promise<MessengerTask[]> {
  if (tasks.length === 0) return tasks;
  const userIds = Array.from(new Set(tasks.flatMap((t) => [t.assigned_to, t.assigned_by]).filter(Boolean)));
  const channelIds = Array.from(new Set(tasks.map((t) => t.channel_id).filter(Boolean) as string[]));

  const [usersRes, chansRes] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string }> }),
    channelIds.length
      ? supabase.from("messenger_channels").select("id, name").in("id", channelIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const nameById = new Map((usersRes.data ?? []).map((u) => [u.id, u.display_name]));
  const chanById = new Map((chansRes.data ?? []).map((c) => [c.id, c.name]));

  return tasks.map((t) => ({
    ...t,
    assigned_to_name: nameById.get(t.assigned_to) ?? null,
    assigned_by_name: nameById.get(t.assigned_by) ?? null,
    channel_name: t.channel_id ? chanById.get(t.channel_id) ?? null : null,
  }));
}

/** All tasks for a single channel, grouped via consumer. */
export function useChannelTasks(channelId: string | null) {
  const [tasks, setTasks] = useState<MessengerTask[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!channelId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabase;
    const { data, error } = await sb
      .from("messenger_tasks")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false });
    if (!error) {
      const augmented = await attachNames((data ?? []) as MessengerTask[]);
      setTasks(augmented);
    }
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime
  const refRefresh = useRef(refresh);
  refRefresh.current = refresh;
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`msgr-tasks-${channelId}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "messenger_tasks", filter: `channel_id=eq.${channelId}` },
        () => {
          void refRefresh.current();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId]);

  return { tasks, loading, refresh };
}

/** Open tasks for the logged-in user across all channels on the current site. */
export function useMyMessengerTasks() {
  const { currentSite } = useSite();
  const { appUser, staffSession } = useAuth();
  const siteId = currentSite?.id || null;
  const userId = appUser?.id ?? staffSession?.user_id ?? null;
  const [tasks, setTasks] = useState<MessengerTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!siteId || !userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("messenger_tasks" as never)
      .select("*")
      .eq("site_id", siteId)
      .eq("assigned_to", userId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    const augmented = await attachNames((data ?? []) as MessengerTask[]);
    setTasks(augmented);
    setLoading(false);
  }, [siteId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refRefresh = useRef(refresh);
  refRefresh.current = refresh;
  useEffect(() => {
    if (!siteId || !userId) return;
    const ch = supabase
      .channel(`msgr-mytasks-${userId}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "messenger_tasks", filter: `assigned_to=eq.${userId}` },
        () => {
          void refRefresh.current();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [siteId, userId]);

  return { tasks, loading, refresh };
}

export interface CreateTaskInput {
  site_id: string;
  organisation_id: string;
  channel_id: string | null;
  message_id: string | null;
  title: string;
  description?: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date?: string | null;
  priority?: TaskPriority;
}

// Cast supabase to a loose client because the auto-generated types lag behind
// the new tables introduced in this migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export async function createMessengerTask(input: CreateTaskInput) {
  const { data, error } = await sb
    .from("messenger_tasks")
    .insert({
      ...input,
      status: "open",
      priority: input.priority ?? "normal",
    })
    .select()
    .single();
  return { data, error };
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === "done") patch.completed_at = new Date().toISOString();
  else patch.completed_at = null;
  const { error } = await sb
    .from("messenger_tasks")
    .update(patch)
    .eq("id", id);
  return { error };
}

export async function pinMessage(input: {
  channel_id: string;
  site_id: string;
  message_id: string;
  pinned_by: string;
}) {
  const { error } = await sb.from("messenger_pins").insert(input);
  return { error };
}
