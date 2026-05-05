import { useMemo } from "react";
import { CheckCircle2, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChannelAcks, acknowledgeMessage, useSiteMembers } from "@/hooks/useMessengerPinsAcks";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  messageId: string;
  channelId: string;
  siteId: string;
  senderId: string | null;
  isOwn: boolean;
}

/**
 * Acknowledgement strip rendered under a message that requires confirmation.
 * - Non-acknowledged members see an Acknowledge button.
 * - Sender (and any viewer) sees a list of who has acknowledged + who hasn't.
 */
export function AckStrip({ messageId, channelId, siteId, senderId, isOwn }: Props) {
  const { appUser } = useAuth();
  const userId = appUser?.id ?? null;
  const messageIds = useMemo(() => [messageId], [messageId]);
  const { acks } = useChannelAcks(channelId, messageIds);
  const members = useSiteMembers(siteId);

  const myAck = acks.find((a) => a.user_id === userId);
  const ackedIds = new Set(acks.map((a) => a.user_id));

  // Outstanding members = active site members minus the sender minus those already acked
  const pending = members.filter((m) => m.id !== senderId && !ackedIds.has(m.id));
  const acknowledged = acks.slice().sort((a, b) => a.acknowledged_at.localeCompare(b.acknowledged_at));

  const handleAck = async () => {
    if (!userId || !siteId) return;
    const { error } = await acknowledgeMessage({ message_id: messageId, site_id: siteId, user_id: userId });
    if (error) toast.error(error.message ?? "Failed to acknowledge");
    else toast.success("Acknowledged");
  };

  // Staff-side: show button if not yet acked and not the sender
  const canAck = !!userId && userId !== senderId && !myAck;

  return (
    <div className="mt-1.5 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-warning">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Acknowledgement required</span>
      </div>

      {canAck && (
        <Button
          size="sm"
          className="h-7 text-xs w-full sm:w-auto"
          onClick={handleAck}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          Acknowledge
        </Button>
      )}

      {myAck && !isOwn && (
        <p className="text-[11px] text-success inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          You acknowledged at{" "}
          {new Date(myAck.acknowledged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      <div className="flex items-start gap-3 text-[11px] text-muted-foreground pt-1 border-t border-warning/20">
        <div className="flex-1 min-w-0">
          <p className="font-semibold inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success" />
            Acknowledged ({acknowledged.length})
          </p>
          {acknowledged.length === 0 ? (
            <p className="opacity-70">Nobody yet</p>
          ) : (
            <p className="line-clamp-2">
              {acknowledged.map((a) => a.user_name ?? "—").join(", ")}
            </p>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            Pending ({pending.length})
          </p>
          {pending.length === 0 ? (
            <p className="opacity-70">All in</p>
          ) : (
            <p className="line-clamp-2">{pending.map((m) => m.display_name).join(", ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
