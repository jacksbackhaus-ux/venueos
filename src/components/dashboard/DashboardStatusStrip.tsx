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
  green: { text: "text-success", ring: "ring-success/30", dot: "bg-success", emoji: "🟢", label: "Safe to trade" },
  amber: { text: "text-warning", ring: "ring-warning/40", dot: "bg-warning", emoji: "🟠", label: "Trade with care" },
  red:   { text: "text-breach",  ring: "ring-breach/40",  dot: "bg-breach",  emoji: "🔴", label: "Not safe to trade" },
} as const;

function Chip({ to, icon: Icon, label, ok }: { to: string; icon: any; label: string; ok: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium bg-card hover:bg-muted/40 transition-colors ${ok ? "border-border" : "border-warning/40"}`}
    >
      <Icon className={`h-3.5 w-3.5 ${ok ? "text-success" : "text-warning"}`} />
      <span className="truncate">{label}</span>
      <span aria-hidden>{ok ? "✅" : "⚠️"}</span>
    </Link>
  );
}

export function DashboardStatusStrip({ siteId, dateISO, completedToday = 0 }: Props) {
  const { data, isLoading } = useSafeToTrade(siteId, dateISO);

  if (isLoading || !data) {
    return (
      <Card className="p-4 md:p-5 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Skeleton className="h-10 w-48 mb-3" />
        <div className="grid grid-cols-4 gap-2"><Skeleton className="h-9" /><Skeleton className="h-9" /><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
      </Card>
    );
  }

  if (data.isClosed) {
    return (
      <Card className="p-4 md:p-5 bg-muted/40">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Site closed today</p>
            <p className="text-xs text-muted-foreground">Tracking paused — excluded from your score.</p>
          </div>
        </div>
      </Card>
    );
  }

  const b = BAND[data.band];
  const { activeBreaches, openIncidents, temperatures, cleaning, daySheet } = data.breakdown;
  const issues = activeBreaches;
  const warnings = openIncidents + (temperatures < 100 ? 1 : 0) + (cleaning < 100 ? 1 : 0);

  return (
    <Card className={`p-4 md:p-5 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/80 ring-1 ${b.ring}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span aria-hidden className="text-xl">{b.emoji}</span>
          <span className={`text-3xl md:text-4xl font-heading font-bold tabular-nums ${b.text}`}>{data.score}%</span>
          <span className="text-sm font-semibold text-foreground">{b.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-breach" />Issues: <strong className="text-foreground tabular-nums">{issues}</strong></span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Warnings: <strong className="text-foreground tabular-nums">{warnings}</strong></span>
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Done: <strong className="text-foreground tabular-nums">{completedToday}</strong></span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Chip to="/temperatures" icon={Thermometer} label="Temps" ok={temperatures >= 100 && activeBreaches === 0} />
        <Chip to="/cleaning"     icon={SprayCan}    label="Cleaning" ok={cleaning >= 100} />
        <Chip to="/day-sheet"    icon={ClipboardCheck} label="Day Sheet" ok={daySheet >= 100} />
        <Chip to="/incidents"    icon={AlertTriangle} label="Incidents" ok={openIncidents === 0} />
      </div>
    </Card>
  );
}
