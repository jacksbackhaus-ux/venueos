import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { useChannelPins, unpinMessage } from "@/hooks/useMessengerPinsAcks";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
}

export function PinnedPanel({ open, onOpenChange, channelId }: Props) {
  const { pins, loading } = useChannelPins(channelId);
  const role = useRole();

  const handleUnpin = async (pinId: string) => {
    const { error } = await unpinMessage(pinId);
    if (error) toast.error(error.message ?? "Failed to unpin");
    else toast.success("Message unpinned");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Pin className="h-4 w-4" />
            Pinned messages
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {loading && (
              <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
            )}
            {!loading && pins.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                No pinned messages in this channel yet.
              </p>
            )}
            {pins.map((p) => (
              <div key={p.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {p.message_sender_name ?? "Unknown"}
                      {p.message_created_at && (
                        <span className="font-normal opacity-70">
                          {" · "}
                          {new Date(p.message_created_at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </p>
                    <p
                      className={`text-sm whitespace-pre-wrap mt-1 ${
                        p.message_deleted ? "italic text-muted-foreground" : ""
                      }`}
                    >
                      {p.message_deleted
                        ? "(Original message deleted)"
                        : p.message_content || "(No text)"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
                  <span>
                    Pinned by {p.pinned_by_name ?? "—"} ·{" "}
                    {new Date(p.pinned_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {role.isSupervisorPlus && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnpin(p.id)}
                    >
                      <PinOff className="h-3 w-3 mr-1" />
                      Unpin
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
