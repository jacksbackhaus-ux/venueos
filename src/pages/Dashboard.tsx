import { motion } from "framer-motion";
import {
  Thermometer,
  Truck,
  SprayCan,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35 },
  }),
};

// Mock data
const complianceScore = 78;
const todayStats = {
  completed: 14,
  total: 18,
  overdue: 2,
  breaches: 1,
};

const quickActions = [
  { label: "Log Temp", icon: Thermometer, href: "/temperatures", color: "bg-primary" },
  { label: "Log Delivery", icon: Truck, href: "/suppliers", color: "bg-success" },
  { label: "Cleaning Task", icon: SprayCan, href: "/cleaning", color: "bg-warning" },
  { label: "Report Issue", icon: AlertTriangle, href: "/incidents", color: "bg-breach" },
];

const myTasks = [
  { id: 1, title: "Fridge 1 AM temp", due: "09:00", status: "done", module: "Temps" },
  { id: 2, title: "Fridge 2 AM temp", due: "09:00", status: "done", module: "Temps" },
  { id: 3, title: "Freezer 1 AM temp", due: "09:00", status: "overdue", module: "Temps" },
  { id: 4, title: "Opening checks", due: "07:30", status: "done", module: "Day Sheet" },
  { id: 5, title: "Prep area wipe-down", due: "10:00", status: "pending", module: "Cleaning" },
  { id: 6, title: "Delivery: Flour supplier", due: "11:00", status: "pending", module: "Delivery" },
  { id: 7, title: "Display chiller PM temp", due: "14:00", status: "pending", module: "Temps" },
  { id: 8, title: "Closing checks", due: "17:00", status: "pending", module: "Day Sheet" },
];

const alerts = [
  { type: "breach", message: "Fridge 2 at 9.2°C — action required", time: "08:45" },
  { type: "overdue", message: "Freezer 1 AM temp overdue", time: "09:15" },
];

const pillars = [
  { name: "Hygienic Handling", score: 85, icon: ClipboardCheck },
  { name: "Premises & Cleanliness", score: 72, icon: SprayCan },
  { name: "Management Confidence", score: 90, icon: ShieldCheck },
];

const statusIcon = (status: string) => {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "overdue":
      return <XCircle className="h-4 w-4 text-breach animate-pulse-breach" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const Dashboard = () => {
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{greeting} 👋</h1>
            <p className="text-sm text-muted-foreground">{dateStr}</p>
          </div>
          <Badge
            variant="outline"
            className={`text-xs self-start sm:self-auto ${
              complianceScore >= 80
                ? "border-success text-success"
                : complianceScore >= 60
                ? "border-warning text-warning"
                : "border-breach text-breach"
            }`}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            {complianceScore}% compliant today
          </Badge>
        </div>
      </motion.div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  alert.type === "breach"
                    ? "bg-breach/10 text-breach"
                    : "bg-warning/10 text-warning"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{alert.message}</span>
                <span className="text-xs opacity-70">{alert.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.href}>
              <Button
                variant="outline"
                className="w-full h-auto flex-col gap-2 py-4 border-2 hover:border-primary/30 transition-all"
              >
                <div className={`h-10 w-10 rounded-xl ${action.color} flex items-center justify-center`}>
                  <action.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Completed", value: todayStats.completed, total: todayStats.total, color: "text-success" },
            { label: "Remaining", value: todayStats.total - todayStats.completed - todayStats.overdue, color: "text-muted-foreground" },
            { label: "Overdue", value: todayStats.overdue, color: "text-warning" },
            { label: "Breaches", value: todayStats.breaches, color: "text-breach" },
          ].map((stat) => (
            <Card key={stat.label} className="border">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-heading font-bold ${stat.color}`}>
                  {stat.value}
                  {"total" in stat && (
                    <span className="text-sm font-normal text-muted-foreground">/{stat.total}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Two-column layout on desktop */}
      <div className="grid md:grid-cols-5 gap-5">
        {/* My Tasks */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeUp}
          className="md:col-span-3"
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading">My Tasks Today</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {myTasks.filter((t) => t.status === "done").length}/{myTasks.length}
                </Badge>
              </div>
              <Progress
                value={(myTasks.filter((t) => t.status === "done").length / myTasks.length) * 100}
                className="h-1.5"
              />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y">
                {myTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 py-2.5 ${
                      task.status === "done" ? "opacity-60" : ""
                    }`}
                  >
                    {statusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.status === "done" ? "line-through" : ""
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">Due {task.due}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0"
                    >
                      {task.module}
                    </Badge>
                    {task.status === "pending" && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Inspection Readiness */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeUp}
          className="md:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Inspection Readiness</CardTitle>
              <p className="text-xs text-muted-foreground">3 pillars of food hygiene rating</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {pillars.map((pillar) => (
                <div key={pillar.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <pillar.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{pillar.name}</span>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        pillar.score >= 80
                          ? "text-success"
                          : pillar.score >= 60
                          ? "text-warning"
                          : "text-breach"
                      }`}
                    >
                      {pillar.score}%
                    </span>
                  </div>
                  <Progress value={pillar.score} className="h-1.5" />
                </div>
              ))}

              <div className="pt-2 border-t">
                <Link to="/reports">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <FileTextIcon className="h-3.5 w-3.5 mr-1.5" />
                    Generate Inspection Pack
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

// Small helper so we don't import FileText twice
function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
  );
}

export default Dashboard;
