import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePriorityFeed, Severity } from "@/hooks/usePriorityFeed";

interface Props {
  siteId: string | undefined;
  dateISO: string;
  currentUserId: string | null;
}

const SEVERITY_STYLE: Record<Severity, { dot: string; label: string; chip: string }> = {
  critical: {
    dot: "bg-breach",
    label: "Critical",
    chip: "bg-breach/10 text-breach border-breach/30",
  },
  important: {
    dot: "bg-warning",
    label: "Important",
    chip: "bg-warning/10 text-warning border-warning/30",
  },
  operational: {
    dot: "bg-primary",
    label: "Today",
    chip: "bg-primary/10 text-primary border-primary/30",
  },
};

export function PriorityFeed({ siteId, dateISO, currentUserId }: Props) {
  const { data, isLoading } = usePriorityFeed(siteId, dateISO, currentUserId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-heading">Your next actions</CardTitle>
          {data && data.length > 0 && (
            <Badge variant="secondary" className="text-xs tabular-nums">{data.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="mx-auto h-10 w-10 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm font-semibold text-foreground">You're all caught up</p>
            <p className="text-xs text-muted-foreground">No outstanding actions right now.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((item, i) => {
              const s = SEVERITY_STYLE[item.severity];
              return (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    to={item.href}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all group"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${s.dot} shrink-0 mt-0.5`} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-semibold shrink-0 ${s.chip}`}>
                      {s.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
