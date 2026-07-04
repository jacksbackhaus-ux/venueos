import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Package, Thermometer, Truck, Trash2, ClipboardList } from "lucide-react";
import { isModuleVisibleInLaunch } from "@/lib/launchFlags";
import type { ModuleName } from "@/lib/plans";

type Action = { label: string; icon: React.ElementType; href: string; mod?: ModuleName };

const ACTIONS: Action[] = [
  { label: "New batch", icon: Package, href: "/batches", mod: "batch_tracking" },
  { label: "Log temp", icon: Thermometer, href: "/temperatures", mod: "temperatures" },
  { label: "Day sheet", icon: ClipboardList, href: "/day-sheet", mod: "day_sheet" },
  { label: "Record delivery", icon: Truck, href: "/suppliers", mod: "suppliers" },
  { label: "Add waste", icon: Trash2, href: "/waste-log", mod: "waste_log" },
];

export function QuickActions() {
  const actions = ACTIONS.filter((a) => !a.mod || isModuleVisibleInLaunch(a.mod));
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {actions.map((a) => (
        <Link key={a.label} to={a.href}>
          <Card className="p-3 flex items-center gap-2.5 hover:border-primary/40 hover:bg-muted/30 transition-colors">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <a.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold">{a.label}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
