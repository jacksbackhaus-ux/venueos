import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelList } from "@/components/messenger/ChannelList";
import { ChatWindow } from "@/components/messenger/ChatWindow";
import { NewChannelDialog } from "@/components/messenger/NewChannelDialog";
import { NewDMDialog } from "@/components/messenger/NewDMDialog";
import { MessengerDisclosureModal } from "@/components/messenger/MessengerDisclosureModal";
import { useChannels, useMessengerSettings } from "@/hooks/useMessenger";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";

export default function Messenger() {
  const { channels, loading } = useChannels();
  const { settings } = useMessengerSettings();
  const { orgRole, appUser, staffSession } = useAuth();
  const role = useRole();
  const userKey = appUser?.id ?? staffSession?.user_id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);

  // Auto-select first channel on desktop
  useEffect(() => {
    if (
      !selectedId &&
      channels.length > 0 &&
      typeof window !== "undefined" &&
      window.innerWidth >= 768
    ) {
      setSelectedId(channels[0].id);
    }
  }, [channels, selectedId]);

  const selected = useMemo(
    () => channels.find((c) => c.id === selectedId) || null,
    [channels, selectedId]
  );

  const canCreate =
    settings?.who_can_create_channels === "all" ||
    role.isManager ||
    orgRole?.org_role === "org_owner" ||
    orgRole?.org_role === "hq_admin";

  const handleChannelCreated = (id: string) => {
    setSelectedId(id);
  };

  const handleDMCreated = (id: string) => {
    setSelectedId(id);
  };

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-3.5rem)] flex bg-background">
      <MessengerDisclosureModal userKey={userKey} />
      {/* Channel list — full width on mobile when no chat selected */}
      <aside
        className={cn(
          "w-full md:w-72 lg:w-80 border-r border-border shrink-0 flex flex-col",
          selected && "hidden md:flex"
        )}
      >
        {channels.length === 0 && !loading ? (
          <div className="p-4">
            <Card>
              <CardContent className="py-8 text-center space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">No channels yet</p>
                <p className="text-xs text-muted-foreground">
                  System channels are being set up for your site.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <ChannelList
            channels={channels}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onNewChannel={canCreate ? () => setShowNewChannel(true) : undefined}
            onNewDM={() => setShowNewDM(true)}
            canCreate={!!canCreate}
          />
        )}
      </aside>

      {/* Chat window */}
      <main
        className={cn(
          "flex-1 min-w-0",
          !selected && "hidden md:flex md:items-center md:justify-center"
        )}
      >
        {selected ? (
          <ChatWindow
            channel={selected}
            readReceipts={settings?.read_receipts_enabled ?? true}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="text-center text-muted-foreground p-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Select a channel or start a DM</p>
            <p className="text-xs mt-1 opacity-70">
              Pick from the list on the left or tap the edit icon to message someone directly.
            </p>
          </div>
        )}
      </main>

      {/* New channel dialog */}
      <NewChannelDialog
        open={showNewChannel}
        onOpenChange={setShowNewChannel}
        onCreated={handleChannelCreated}
      />

      {/* New DM dialog */}
      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        onCreated={handleDMCreated}
      />
    </div>
  );
}
