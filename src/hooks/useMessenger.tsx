import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";

export type ChannelType = "direct" | "group" | "system" | "role";

export interface MessengerChannel {
  id: string;
  site_id: string;
  organisation_id: string;
  name: string;
  description: string | null;
  type: ChannelType;
  is_private: boolean;
  is_system: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  // Augmented client-side:
  unread_count?: number;
  last_message_at?: string | null;
  last_read_at?: string | null;
}

export interface MessengerMessage {
  id: string;
  channel_id: string;
  site_id: string;
  sender_id: string | null;
  sender_name_snapshot: string | null;
  content: string | null;
  attachments: Array<{ name: string; path: string; mime: string; size: number; kind: "image" | "pdf" | "file" }>;
  message_type: "user" | "system" | "shift_card";
  system_payload: Record<string, unknown> | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  // Local-only:
  _optimistic?: boolean;
  _failed?: boolean;
}

export interface MessengerSettings {
  site_id: string;
  organisation_id: string;
  read_receipts_enabled: boolean;
  who_can_create_channels: "managers" | "all";
  short_notice_hours: number;
  short_notice_compensation_text: string;
}

export interface MessengerParticipant {
  id: string;
  channel_id: string;
  user_id: string;
  role: "admin" | "member";
  muted: boolean;
  last_read_at: string;
  joined_at: string;
}

/** Channels list with unread counts for the current site. */
export function useChannels() {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const siteId = currentSite?.id || null;
  const userId = appUser?.id || null;
  const [channels, setChannels] = useState<MessengerChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!siteId || !userId) {
      setChannels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Get channels participated in
    const { data: parts } = await supabase
      .from("messenger_participants")
      .select("channel_id, last_read_at")
      .eq("user_id", userId);

    const channelIds = (parts ?? []).map((p) => p.channel_id);
    if (channelIds.length === 0) {
      setChannels([]);
      setLoading(false);
      return;
    }

    const { data: chans } = await supabase
      .from("messenger_channels")
      .select("*")
      .in("id", channelIds)
      .eq("site_id", siteId)
      .eq("archived", false)
      .order("type", { ascending: true });

    // Last message per channel + unread counts
    const augmented: MessengerChannel[] = await Promise.all(
      (chans ?? []).map(async (c) => {
        const part = parts!.find((p) => p.channel_id === c.id);
        const { count } = await supabase
          .from("messenger_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", c.id)
          .gt("created_at", part?.last_read_at || "1970-01-01")
          .is("deleted_at", null);

        const { data: last } = await supabase
          .from("messenger_messages")
          .select("created_at")
          .eq("channel_id", c.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...(c as MessengerChannel),
          unread_count: count ?? 0,
          last_message_at: last?.created_at ?? null,
          last_read_at: part?.last_read_at ?? null,
        };
      })
    );

    augmented.sort((a, b) => {
      const at = a.last_message_at || a.created_at;
      const bt = b.last_message_at || b.created_at;
      return bt.localeCompare(at);
    });

    setChannels(augmented);
    setLoading(false);
  }, [siteId, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Realtime: any new message in our site triggers refresh
  const refRefresh = useRef(refresh);
  refRefresh.current = refresh;
  useEffect(() => {
    if (!siteId) return;
    const ch = supabase
      .channel(`msgr-channels-${siteId}`)
      .on("postgres_changes" as never,
        { event: "*", schema: "public", table: "messenger_messages", filter: `site_id=eq.${siteId}` },
        () => { void refRefresh.current(); })
      .on("postgres_changes" as never,
        { event: "*", schema: "public", table: "messenger_participants" },
        () => { void refRefresh.current(); })
      .on("postgres_changes" as never,
        { event: "*", schema: "public", table: "messenger_channels", filter: `site_id=eq.${siteId}` },
        () => { void refRefresh.current(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [siteId]);

  return { channels, loading, refresh };
}

/** Messages in a single channel, with realtime + optimistic send. */
export function useChannelMessages(channelId: string | null) {
  const { appUser } = useAuth();
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("messenger_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (!error) setMessages((data ?? []) as MessengerMessage[]);
    setLoading(false);
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`msgr-msgs-${channelId}`)
      .on("postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "messenger_messages", filter: `channel_id=eq.${channelId}` },
        (payload: { new: MessengerMessage }) => {
          setMessages((prev) => {
            // Replace optimistic match if any
            const withoutOptimistic = prev.filter(
              (m) => !(m._optimistic && m.sender_id === payload.new.sender_id && m.content === payload.new.content)
            );
            if (withoutOptimistic.some((m) => m.id === payload.new.id)) return withoutOptimistic;
            return [...withoutOptimistic, payload.new];
          });
        })
      .on("postgres_changes" as never,
        { event: "UPDATE", schema: "public", table: "messenger_messages", filter: `channel_id=eq.${channelId}` },
        (payload: { new: MessengerMessage }) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [channelId]);

  const send = useCallback(async (content: string, attachments: MessengerMessage["attachments"] = []) => {
    if (!channelId || !appUser) return;
    if (!content.trim() && attachments.length === 0) return;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimistic: MessengerMessage = {
      id: tempId,
      channel_id: channelId,
      site_id: "",
      sender_id: appUser.id,
      sender_name_snapshot: appUser.display_name,
      content: content.trim() || null,
      attachments,
      message_type: "user",
      system_payload: null,
      is_edited: false,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    // Resolve site_id from the channel
    const { data: ch } = await supabase
      .from("messenger_channels")
      .select("site_id")
      .eq("id", channelId)
      .single();

    const { data, error } = await supabase
      .from("messenger_messages")
      .insert({
        channel_id: channelId,
        site_id: ch?.site_id,
        sender_id: appUser.id,
        sender_name_snapshot: appUser.display_name,
        content: content.trim() || null,
        attachments,
        message_type: "user",
      })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _failed: true } : m)));
    } else if (data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? (data as MessengerMessage) : m)));
    }
  }, [channelId, appUser]);

  const editMessage = useCallback(async (id: string, content: string) => {
    const { error } = await supabase
      .from("messenger_messages")
      .update({ content, is_edited: true, edited_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, is_edited: true, edited_at: new Date().toISOString() } : m)));
    }
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("messenger_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m)));
    }
  }, []);

  return { messages, loading, send, editMessage, deleteMessage, reload: load };
}

/** Per-site messenger settings. */
export function useMessengerSettings() {
  const { currentSite } = useSite();
  const siteId = currentSite?.id || null;
  const [settings, setSettings] = useState<MessengerSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!siteId) { setSettings(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("messenger_settings")
      .select("*")
      .eq("site_id", siteId)
      .maybeSingle();
    setSettings(data as MessengerSettings | null);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = useCallback(async (patch: Partial<MessengerSettings>) => {
    if (!siteId) return;
    const { error } = await supabase
      .from("messenger_settings")
      .update(patch)
      .eq("site_id", siteId);
    if (!error) await refresh();
    return !error;
  }, [siteId, refresh]);

  return { settings, loading, update, refresh };
}

/** Mark a channel as read (updates last_read_at). */
export async function markChannelRead(channelId: string) {
  await supabase.rpc("messenger_mark_read", { _channel_id: channelId });
}
