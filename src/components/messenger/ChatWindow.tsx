import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Hash, Lock, Bell, Users, MessageCircle, ListTodo, Pin, ChevronRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChannelMessages, markChannelRead, type MessengerChannel, type MessengerMessage } from "@/hooks/useMessenger";
import { useAuth } from "@/contexts/AuthContext";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TasksPanel } from "./TasksPanel";
import { PinnedPanel } from "./PinnedPanel";
import { HandoverDialog } from "./HandoverDialog";
import { useChannelPins } from "@/hooks/useMessengerPinsAcks";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  channel: MessengerChannel;
  readReceipts: boolean;
  onBack?: () => void;
}

export function ChatWindow({ channel, readReceipts, onBack }: Props) {
  const { appUser } = useAuth();
  const { messages, loading, send, editMessage, deleteMessage } = useChannelMessages(channel.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userId = appUser?.id;
  const [tasksOpen, setTasksOpen] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const { pins } = useChannelPins(channel.id);

  const isMainSiteChannel = channel.is_system && channel.name === "whole-site";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, channel.id]);

  // Mark read on mount, on visibility, and when new messages arrive
  useEffect(() => {
    if (!channel.id || !userId) return;
    void markChannelRead(channel.id);
    // Insert read receipts for messages from others
    const others = messages.filter((m) => m.sender_id && m.sender_id !== userId && !m._optimistic);
    if (others.length > 0 && readReceipts) {
      void supabase.from("messenger_read_receipts").upsert(
        others.map((m) => ({ message_id: m.id, user_id: userId })),
        { onConflict: "message_id,user_id", ignoreDuplicates: true }
      );
    }
  }, [channel.id, userId, messages, readReceipts]);

  const isSystemReadOnly = channel.type === "system" && channel.name === "notifications";

  const Icon = channel.type === "system" ? Bell
    : channel.type === "direct" ? MessageCircle
    : channel.is_private ? Lock
    : channel.type === "role" ? Users
    : Hash;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        {onBack && (
          <Button size="icon" variant="ghost" className="h-8 w-8 md:hidden" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm truncate">{channel.name}</h2>
          {channel.description && <p className="text-[11px] text-muted-foreground truncate">{channel.description}</p>}
        </div>
        {isMainSiteChannel && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5"
            onClick={() => setHandoverOpen(true)}
            title="Post shift handover"
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Handover</span>
          </Button>
        )}
        {channel.type !== "system" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => setTasksOpen(true)}
            aria-label="Channel tasks"
            title="Tasks"
          >
            <ListTodo className="h-4 w-4" />
          </Button>
        )}
      </header>

      {pins.length > 0 && (
        <button
          type="button"
          onClick={() => setPinsOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 border-b border-border bg-muted/30 hover:bg-muted/50 text-left transition-colors"
          aria-label="View pinned messages"
        >
          <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground">
            {pins.length} pinned message{pins.length === 1 ? "" : "s"}
          </span>
          <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0">
            · {pins[0].message_content?.slice(0, 80) || "(no text)"}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      )}

      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No messages yet. {channel.type !== "system" && "Say hi 👋"}
            </p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const sameSender = prev && prev.sender_id === m.sender_id && prev.message_type === m.message_type;
            const showName = !sameSender && !!m.sender_id && m.sender_id !== userId;
            const showAvatar = !messages[i + 1] || messages[i + 1].sender_id !== m.sender_id;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.sender_id === userId}
                showAvatar={showAvatar}
                showName={showName}
                readReceipts={readReceipts}
                onEdit={editMessage}
                onDelete={deleteMessage}
              />
            );
          })}
        </div>
      </ScrollArea>

      <MessageInput
        channelId={channel.id}
        disabled={isSystemReadOnly}
        onSend={async (content, atts) => { await send(content, atts); }}
      />

      <TasksPanel open={tasksOpen} onOpenChange={setTasksOpen} channelId={channel.id} />
      <PinnedPanel open={pinsOpen} onOpenChange={setPinsOpen} channelId={channel.id} />
      {isMainSiteChannel && (
        <HandoverDialog open={handoverOpen} onOpenChange={setHandoverOpen} channelId={channel.id} siteId={channel.site_id} />
      )}
    </div>
  );
}
