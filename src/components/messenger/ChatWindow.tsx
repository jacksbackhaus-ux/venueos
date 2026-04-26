import { useEffect, useRef } from "react";
import { ArrowLeft, Hash, Lock, Bell, Users, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChannelMessages, markChannelRead, type MessengerChannel, type MessengerMessage } from "@/hooks/useMessenger";
import { useAuth } from "@/contexts/AuthContext";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
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
      </header>

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
    </div>
  );
}
