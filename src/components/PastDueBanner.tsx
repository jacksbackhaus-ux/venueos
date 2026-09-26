import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Persistent (non-dismissible) notice shown on every page while the
 * organisation's subscription is past_due. Does not block the app.
 */
export function PastDueBanner() {
  const { isPastDue } = useOrgAccess();
  const { orgRole, staffSession } = useAuth();
  const navigate = useNavigate();
  if (!isPastDue || staffSession) return null;
  const isOwner = orgRole?.org_role === "org_owner";

  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 bg-destructive/10 border-b border-destructive/30 text-sm">
      <div className="flex items-start gap-2 flex-1">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
        <p className="text-foreground">
          <span className="font-semibold">Your last payment didn't go through.</span>{" "}
          {isOwner
            ? "Please update your card to keep using MiseOS without interruption."
            : "Please ask your account owner to update the card on file."}
        </p>
      </div>
      {isOwner && (
        <Button size="sm" variant="destructive" onClick={() => navigate("/account")}>
          Update card
        </Button>
      )}
    </div>
  );
}
