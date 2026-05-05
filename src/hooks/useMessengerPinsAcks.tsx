import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export interface PinnedMessage {
  id: string;
  channel_id: string;
  site_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
  // joined
  message_content: string | null;
  message_sender_name: string | null;
  message_created_at: string | null;
  message_deleted: boolean;
  pinned_by_name: string | null;
}

export interface AckRecord {
  id: string;
  message_id: string;
  user_id: string;
  acknowledged_at: string;
  user_name?: string | null;
}

/** Pinned messages for a channel, with realtime + joined message/sender info. */
export function useChannelPins(channelId: string | null) {
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!channelId) {
      setPins([]);
      return;
    }
    setLoading(true);
    const { data: pinRows } = await sb
      .from("messenger_pins")
      .select("*")
      .eq("channel_id", channelId)
      .order("pinned_at", { ascending: false });

    const list = (pinRows ?? []) as Array<{
      id: string;
      channel_id: string;
      site_id: string;
      message_id: string;
      pinned_by: string;
      pinned_at: string;
    }>;

    if (list.length === 0) {
      setPins([]);
      setLoading(false);
      return;
    }

    const messageIds = list.map((p) => p.message_id);
    const userIds = Array.from(new Set(list.map((p) => p.pinned_by)));

    const [msgsRes, usersRes] = await Promise.all([
      sb
        .from("messenger_messages")
        .select("id, content, sender_name_snapshot, created_at, deleted_at")
        .in("id", messageIds),
      sb.from("users").select("id, display_name").in("id", userIds),
    ]);

    const msgById = new Map(
      (msgsRes.data ?? []).map((m: { id: string; content: string | null; sender_name_snapshot: string | null; created_at: string; deleted_at: string | null }) => [m.id, m])
    );
    const userById = new Map(
      (usersRes.data ?? []).map((u: { id: string; display_name: string }) => [u.id, u.display_name])
    );

    const augmented: PinnedMessage[] = list.map((p) => {
      const m = msgById.get(p.message_id) as { content: string | null; sender_name_snapshot: string | null; created_at: string; deleted_at: string | null } | undefined;
      return {
        ...p,
        message_content: m?.content ?? null,
        message_sender_name: m?.sender_name_snapshot ?? null,
        message_created_at: m?.created_at ?? null,
        message_deleted: !!m?.deleted_at,
        pinned_by_name: (userById.get(p.pinned_by) as string | undefined) ?? null,
      };
    });

    setPins(augmented);
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refRefresh = useRef(refresh);
  refRefresh.current = refresh;
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`msgr-pins-${channelId}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "messenger_pins", filter: `channel_id=eq.${channelId}` },
        () => {
          void refRefresh.current();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId]);

  return { pins, loading, refresh };
}

export async function unpinMessage(pinId: string) {
  const { error } = await sb.from("messenger_pins").delete().eq("id", pinId);
  return { error };
}

/** Acknowledgements for messages currently visible in a channel. */
export function useChannelAcks(channelId: string | null, messageIds: string[]) {
  const [acks, setAcks] = useState<AckRecord[]>([]);
  const key = messageIds.join(",");

  const refresh = useCallback(async () => {
    if (!channelId || messageIds.length === 0) {
      setAcks([]);
      return;
    }
    const { data: ackRows } = await sb
      .from("messenger_acknowledgements")
      .select("*")
      .in("message_id", messageIds);

    const rows = (ackRows ?? []) as AckRecord[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    let userById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersRes } = await sb.from("users").select("id, display_name").in("id", userIds);
      userById = new Map(
        (usersRes ?? []).map((u: { id: string; display_name: string }) => [u.id, u.display_name])
      );
    }
    setAcks(rows.map((r) => ({ ...r, user_name: userById.get(r.user_id) ?? null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refRefresh = useRef(refresh);
  refRefresh.current = refresh;
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`msgr-acks-${channelId}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "messenger_acknowledgements" },
        () => {
          void refRefresh.current();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId]);

  return { acks, refresh };
}

export async function acknowledgeMessage(input: { message_id: string; site_id: string; user_id: string }) {
  const { error } = await sb.from("messenger_acknowledgements").insert(input);
  return { error };
}

export async function setMessageRequiresAck(messageId: string, requires: boolean) {
  const { error } = await sb
    .from("messenger_messages")
    .update({ requires_ack: requires })
    .eq("id", messageId);
  return { error };
}

/** Active site members (id + name) — used to compute who hasn't acknowledged. */
export function useSiteMembers(siteId: string | null) {
  const [members, setMembers] = useState<Array<{ id: string; display_name: string }>>([]);

  useEffect(() => {
    if (!siteId) {
      setMembers([]);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("memberships")
        .select("user_id, active, users:user_id(id, display_name, status)")
        .eq("site_id", siteId)
        .eq("active", true);
      if (!active) return;
      const list = (data ?? [])
        .map((r: { users: { id: string; display_name: string; status: string } | null }) => r.users)
        .filter((u): u is { id: string; display_name: string; status: string } => !!u && u.status === "active")
        .map((u) => ({ id: u.id, display_name: u.display_name }));
      setMembers(list);
    })();
    return () => {
      active = false;
    };
  }, [siteId]);

  return members;
}
