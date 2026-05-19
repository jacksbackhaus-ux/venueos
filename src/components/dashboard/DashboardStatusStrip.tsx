import { Link } from "react-router-dom";
import { Thermometer, SprayCan, ClipboardCheck, AlertTriangle, Lock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSafeToTrade } from "@/hooks/useSafeToTrade";

interface Props {
  siteId: string | undefined;
  dateISO: string;
  completedToday?: number;
}

const BAND = {
  green: { text: "text-success", ring: "ring-success/30", emoji: "🟢", label: "Safe to trade" },
  amber: { text: "text-warning", ring: "ring-warning/40", emoji: "🟠", label: "Trade with caution" },
  red:   { text: "text-breach",  ring: "ring-breach/40",  emoji: "🔴", label: "Not safe to trade" },
} as const;

type PillState = "ok" | "warn" | "bad";

function Pill({ to, icon: Icon, label, state }: { to: string; icon: any; label: string; state: PillState }) {
  const tone =
    state === "bad" ? "border-breach/40 text-breach" :
    state === "warn" ? "border-warning/40 text-warning" :
    "border-border text-success";
  const mark = state === "bad" ? "❗" : state === "warn" ? "⚠️" : "✅";
  return (
    <Link
      to={to}
      className={`flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium bg-card hover:bg-muted/40 transition-colors ${tone}`}
    >
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="truncate">{label}</span>
      <span aria-hidden className="text-[11px] leading-none">{mark}</span>
    </Link>
  );
}

export function DashboardStatusStrip({ siteId, dateISO, completedToday = 0 }: Props) {
  const { data, isLoading } = useSafeToTrade(siteId, dateISO);

  if (isLoading || !data) {
    return (
      <Card className="p-3 md:p-4 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Skeleton className="h-7 w-48 mb-2" />
        <div className="flex gap-2"><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-7 w-20 rounded-full" /></div>
      </Card>
    );
  }

  if (data.isClosed) {
    return (
      <Card className="p-3 md:p-4 bg-muted/40">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Site closed today</p>
            <p className="text-xs text-muted-foreground">Tracking paused — excluded from your score.</p>
          </div>
        </div>
      </Card>
    );
  }

  const b = BAND[data.band];
  const { activeBreaches, openIncidents, temperatures, cleaning, daySheet, yesterdayClosingMissing } = data.breakdown;

  const tempState: PillState = activeBreaches > 0 ? "bad" : temperatures >= 100 ? "ok" : "warn";
  const cleanState: PillState = cleaning >= 100 ? "ok" : cleaning >= 50 ? "warn" : "warn";
  const dsState: PillState = daySheet >= 100 ? "ok" : yesterdayClosingMissing > 0 || daySheet < 50 ? "warn" : "warn";
  const incState: PillState = openIncidents === 0 ? "ok" : openIncidents > 1 ? "bad" : "warn";

  return (
    <Card className={`p-3 md:p-4 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/80 ring-1 ${b.ring}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <span aria-hidden className="text-lg">{b.emoji}</span>
          <span className={`text-2xl md:text-3xl font-heading font-bold tabular-nums ${b.text}`}>{data.score}%</span>
          <span className="text-sm font-semibold text-foreground truncate">{b.label}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <strong className="text-foreground tabular-nums">{completedToday}</strong> done
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Pill to="/temperatures" icon={Thermometer} label="Temps" state={tempState} />
        <Pill to="/cleaning" icon={SprayCan} label="Cleaning" state={cleanState} />
        <Pill to="/day-sheet" icon={ClipboardCheck} label="Day Sheet" state={dsState} />
        <Pill to="/incidents" icon={AlertTriangle} label="Incidents" state={incState} />
      </div>
    </Card>
  );
}
