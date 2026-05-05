import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function ImpersonationBanner() {
  const { session, isImpersonating, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();
  const [, force] = useState(0);

  // Re-render every 30s so the countdown stays fresh.
  useEffect(() => {
    if (!isImpersonating) return;
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [isImpersonating]);

  if (!isImpersonating || !session) return null;

  const minsLeft = Math.max(0, Math.round((new Date(session.expires_at).getTime() - Date.now()) / 60_000));

  const handleExit = async () => {
    await stopImpersonation();
    navigate("/admin", { replace: true });
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] w-full bg-destructive text-destructive-foreground shadow-md"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 text-sm font-medium">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 truncate">
          <span className="font-semibold">Impersonating {session.organisation_name}</span>
          <span className="opacity-80"> · {session.reason}</span>
          <span className="opacity-70"> · expires in {minsLeft}m · read-only</span>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-1 rounded-md bg-destructive-foreground/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-destructive-foreground/25 transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Exit
        </button>
      </div>
    </div>
  );
}
