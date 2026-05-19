import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ShieldCheck, ChevronRight, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSafeToTrade } from "@/hooks/useSafeToTrade";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  siteId: string | undefined;
  dateISO: string;
  greeting?: string;
  displayName?: string;
}

const BAND_STYLES = {
  green: {
    bg: "from-success/15 via-card to-card",
    ring: "ring-success/30",
    text: "text-success",
    dot: "bg-success",
    emoji: "🟢",
    label: "Safe to trade",
  },
  amber: {
    bg: "from-warning/15 via-card to-card",
    ring: "ring-warning/40",
    text: "text-warning",
    dot: "bg-warning",
    emoji: "🟠",
    label: "Trading with risks",
  },
  red: {
    bg: "from-breach/15 via-card to-card",
    ring: "ring-breach/40",
    text: "text-breach",
    dot: "bg-breach",
    emoji: "🔴",
    label: "Not safe to trade",
  },
};

export function SafeToTradeHero({ siteId, dateISO, greeting, displayName }: Props) {
  const { data, isLoading } = useSafeToTrade(siteId, dateISO);

  if (isLoading || !data) {
    return (
      <Card className="p-5 md:p-6">
        <Skeleton className="h-6 w-32 mb-3" />
        <Skeleton className="h-12 w-40 mb-4" />
        <Skeleton className="h-4 w-full" />
      </Card>
    );
  }

  if (data.isClosed) {
    return (
      <Card className="p-5 md:p-6 bg-muted/30">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">Site closed today</p>
            <p className="text-xs text-muted-foreground">Tracking paused — this day is excluded from your score.</p>
          </div>
        </div>
      </Card>
    );
  }

  const style = BAND_STYLES[data.band];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${style.bg} ring-1 ${style.ring} p-5 md:p-6`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {greeting && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {greeting}{displayName ? `, ${displayName.split(" ")[0]}` : ""}
            </p>
          )}
          <div className="flex items-baseline gap-3 mt-1">
            <span className={`text-5xl md:text-6xl font-heading font-bold tabular-nums ${style.text}`}>
              {data.score}%
            </span>
            <span className="text-2xl">{style.emoji}</span>
          </div>
          <p className="text-base md:text-lg font-semibold text-foreground mt-1">{style.label}</p>
        </div>
        <div className="hidden sm:flex h-14 w-14 rounded-full bg-card/80 backdrop-blur items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck className={`h-7 w-7 ${style.text}`} />
        </div>
      </div>

      {data.reasons.length > 0 ? (
        <div className="mt-5 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            What's affecting your score
          </p>
          <ul className="space-y-1.5">
            {data.reasons.map((r) => (
              <li key={r.label}>
                <Link
                  to={r.href}
                  className="flex items-center gap-2 rounded-lg px-2 -mx-2 py-1.5 text-sm font-medium text-foreground hover:bg-card/70 transition-colors group"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot} shrink-0`} />
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">−{r.impact}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Everything checks out — no outstanding risks for today.
        </p>
      )}
    </motion.section>
  );
}
