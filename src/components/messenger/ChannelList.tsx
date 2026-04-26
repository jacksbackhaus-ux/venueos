import { useState } from "react";
import {
  Hash, Lock, Bell, Users, Plus, MessageCircle, Search, Edit,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { MessengerChannel } from "@/hooks/useMessenger";

interface Props {
  channels: MessengerChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChannel?: () => void;
  onNewDM?: () => void;
  canCreate: boolean;
}

export function ChannelList({
  channels,
  selectedId,
  onSelect,
  onNewChannel,
  onNewDM,
  canCreate,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = channels.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const system = filtered.filter((c) => c.type === "system");
  const groups = filtered.filter(
    (c) => c.type === "group" || c.type === "role"
  );
  const direct = filtered.filter((c) => c.type === "direct");

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header */}
      <div className="p-3 border-b border-sidebar-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-sm text-sidebar-foreground">
            Messenger
          </h2>
          <div className="flex items-center gap-1">
            {onNewDM && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onNewDM}
                aria-label="New direct message"
                title="New direct message"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canCreate && onNewChannel && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onNewChannel}
                aria-label="New channel"
                title="New channel"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs bg-background/50"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {/* System / Notifications */}
          {system.length > 0 && (
            <Section title="System">
              {system.map((c) => (
                <ChannelRow
                  key={c.id}
                  channel={c}
                  selected={selectedId === c.id}
                  onClick={() => onSelect(c.id)}
                />
              ))}
            </Section>
          )}

          {/* Group channels */}
          {groups.length > 0 && (
            <Section
              title="Channels"
              action={
                canCreate && onNewChannel ? (
                  <button
                    onClick={onNewChannel}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    title="New channel"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                ) : undefined
              }
            >
              {groups.map((c) => (
                <ChannelRow
                  key={c.id}
                  channel={c}
                  selected={selectedId === c.id}
                  onClick={() => onSelect(c.id)}
                />
              ))}
            </Section>
          )}

          {/* Direct messages */}
          <Section
            title="Direct Messages"
            action={
              onNewDM ? (
                <button
                  onClick={onNewDM}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title="New direct message"
                >
                  <Plus className="h-3 w-3" />
                </button>
              ) : undefined
            }
          >
            {direct.length === 0 ? (
              <button
                onClick={onNewDM}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Start a conversation</span>
              </button>
            ) : (
              direct.map((c) => (
                <ChannelRow
                  key={c.id}
                  channel={c}
                  selected={selectedId === c.id}
                  onClick={() => onSelect(c.id)}
                />
              ))
            )}
          </Section>

          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No channels found.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function channelIcon(c: MessengerChannel) {
  if (c.type === "system") return Bell;
  if (c.type === "direct") return MessageCircle;
  if (c.is_private) return Lock;
  if (c.type === "role") return Users;
  return Hash;
}

function ChannelRow({
  channel,
  selected,
  onClick,
}: {
  channel: MessengerChannel;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = channelIcon(channel);
  const unread = channel.unread_count ?? 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors",
        selected
          ? "bg-sidebar-accent text-primary font-semibold"
          : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate flex-1">{channel.name}</span>
      {unread > 0 && (
        <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-primary text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </Badge>
      )}
    </button>
  );
}
