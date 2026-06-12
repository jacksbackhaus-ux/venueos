import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Headset, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

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
  const startedLabel = format(new Date(session.started_at), "HH:mm");

  const handleExit = async () => {
    const returnTo = session.return_to || "/admin";
    await stopImpersonation();
    navigate(returnTo, { replace: true });
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] w-full bg-primary text-primary-foreground shadow-md"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 text-sm font-medium">
        <Headset className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 truncate">
          <span className="font-semibold">Support mode — impersonating {session.organisation_name}</span>
          {session.site_name && <span className="opacity-90"> · {session.site_name}</span>}
          <span className="opacity-80"> · started {startedLabel}</span>
          <span className="opacity-80"> · {session.access_level}</span>
          <span className="opacity-70"> · read-only · {minsLeft}m left</span>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary-foreground/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-primary-foreground/25 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Exit impersonation
        </button>
      </div>
    </div>
  );
}
