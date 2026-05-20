import { useEffect, useState } from "react";
import { CloudOff, RotateCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { countByStatus, onQueueChange, processQueue } from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [counts, setCounts] = useState({ queued: 0, syncing: 0, failed: 0, total: 0 });

  useEffect(() => {
    const refresh = () => countByStatus().then(setCounts);
    refresh();
    const off = onQueueChange(refresh);
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      off();
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  if (online && counts.total === 0) return null;

  const showOffline = !online;
  const showFailed = counts.failed > 0;
  const showSyncing = online && (counts.queued > 0 || counts.syncing > 0);

  return (
    <div
      className={cn(
        "fixed left-2 right-2 z-50 mx-auto max-w-md rounded-lg border px-3 py-2 text-xs shadow-sm",
        "top-[max(0.5rem,env(safe-area-inset-top))] md:top-2",
        showOffline && "border-amber-300 bg-amber-50 text-amber-900",
        !showOffline && showFailed && "border-destructive/30 bg-destructive/10 text-destructive",
        !showOffline && !showFailed && showSyncing && "border-primary/30 bg-primary/5 text-primary",
        !showOffline && !showFailed && !showSyncing && "border-emerald-300 bg-emerald-50 text-emerald-900"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {showOffline ? (
          <>
            <CloudOff className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Offline mode: actions will sync when you’re back online.
              {counts.total > 0 && ` ${counts.total} pending.`}
            </span>
          </>
        ) : showFailed ? (
          <>
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {counts.failed} item{counts.failed === 1 ? "" : "s"} need attention.
            </span>
          </>
        ) : showSyncing ? (
          <>
            <RotateCw className="h-4 w-4 shrink-0 animate-spin" />
            <span className="flex-1">
              Syncing {counts.queued + counts.syncing} offline action{counts.queued + counts.syncing === 1 ? "" : "s"}…
            </span>
            <button
              type="button"
              onClick={() => processQueue()}
              className="font-medium underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">All offline actions synced.</span>
          </>
        )}
      </div>
    </div>
  );
}
