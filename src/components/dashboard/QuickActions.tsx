import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Package, Thermometer, Truck, Trash2 } from "lucide-react";

const ACTIONS = [
  { label: "New batch", icon: Package, href: "/batches" },
  { label: "Log temp", icon: Thermometer, href: "/temperatures" },
  { label: "Record delivery", icon: Truck, href: "/suppliers" },
  { label: "Add waste", icon: Trash2, href: "/waste-log" },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {ACTIONS.map((a) => (
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
