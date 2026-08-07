import { useState } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSiteTransfer } from "@/hooks/useSiteTransfer";
import { useAuth } from "@/contexts/AuthContext";
import { promptDismissed, dismissPrompt } from "@/lib/premises";

/**
 * Slim, dismissible banner shown on both sites during a move / close window.
 * Shows the close date and lets an owner cancel the move.
 */
export function SiteTransferBanner() {
  const { transfer, fromSite, toSite, daysLeft, relevantToCurrentSite, cancel } = useSiteTransfer();
  const { orgRole } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!transfer || !relevantToCurrentSite) return null;
  const alreadyDismissed = promptDismissed("transfer", transfer.id);
  if (dismissed || alreadyDismissed) return null;

  const isOwner =
    orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";
  const closeDate = format(new Date(transfer.expires_at), "d MMM yyyy");

  const hide = () => {
    dismissPrompt("transfer", transfer.id);
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
      <ArrowRightLeft className="h-3.5 w-3.5 text-primary shrink-0" />
      <p className="min-w-0 flex-1 truncate text-muted-foreground">
        {toSite ? (
          <>
            Moving from <span className="font-semibold text-foreground">{fromSite?.name ?? "old site"}</span>{" "}
            to <span className="font-semibold text-foreground">{toSite.name}</span> —{" "}
          </>
        ) : (
          <>
            <span className="font-semibold text-foreground">{fromSite?.name ?? "This site"}</span> closes —{" "}
          </>
        )}
        both stay editable until {closeDate} ({daysLeft} day{daysLeft === 1 ? "" : "s"} left). Billed for one site.
      </p>
      {isOwner && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate(undefined, {
              onSuccess: () => toast.success("Move cancelled — both sites stay open."),
              onError: (e: any) => toast.error(e.message ?? "Could not cancel the move"),
            })
          }
        >
          Cancel move
        </Button>
      )}
      <button type="button" onClick={hide} aria-label="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
