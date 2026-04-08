import { useState } from "react";
import { motion } from "framer-motion";
import {
  SprayCan,
  CheckCircle2,
  Circle,
  Clock,
  Camera,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CleaningTask = {
  id: string;
  area: string;
  task: string;
  frequency: "daily" | "weekly" | "monthly";
  dueTime?: string;
  assignedTo?: string;
  done: boolean;
  note?: string;
  completedAt?: string;
};

const initialTasks: CleaningTask[] = [
  { id: "1", area: "Bakery Floor", task: "Sweep and mop all floor areas", frequency: "daily", dueTime: "12:00", assignedTo: "Sarah M.", done: true, completedAt: "11:45" },
  { id: "2", area: "Prep Area", task: "Clean and sanitise all prep surfaces", frequency: "daily", dueTime: "10:00", assignedTo: "Tom B.", done: true, completedAt: "09:55" },
  { id: "3", area: "Prep Area", task: "Wipe down between different products/allergens", frequency: "daily", dueTime: "Ongoing", assignedTo: "All staff", done: false },
  { id: "4", area: "Display", task: "Clean display counter glass and shelving", frequency: "daily", dueTime: "07:00", assignedTo: "Tom B.", done: true, completedAt: "07:15" },
  { id: "5", area: "Toilets", task: "Clean toilet and restock supplies", frequency: "daily", dueTime: "14:00", assignedTo: "Sarah M.", done: false },
  { id: "6", area: "Equipment", task: "Deep clean mixer and attachments", frequency: "weekly", dueTime: "Monday", assignedTo: "Tom B.", done: false },
  { id: "7", area: "Equipment", task: "Clean and descale oven", frequency: "weekly", dueTime: "Wednesday", assignedTo: "Sarah M.", done: false },
  { id: "8", area: "Storage", task: "Clean and organise dry store shelves", frequency: "weekly", dueTime: "Friday", assignedTo: "Tom B.", done: false },
  { id: "9", area: "Kitchen", task: "Deep clean extraction hood and filters", frequency: "monthly", dueTime: "1st of month", assignedTo: "External contractor", done: false },
  { id: "10", area: "Walls/Ceiling", task: "Wash walls and ceiling in bakery area", frequency: "monthly", dueTime: "15th of month", done: false },
];

const Cleaning = () => {
  const [tasks, setTasks] = useState<CleaningTask[]>(initialTasks);
  const [activeTab, setActiveTab] = useState("daily");

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              done: !t.done,
              completedAt: !t.done
                ? new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                : undefined,
            }
          : t
      )
    );
  };

  const filtered = tasks.filter((t) => t.frequency === activeTab);
  const doneCount = filtered.filter((t) => t.done).length;
  const totalCount = filtered.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const areas = [...new Set(filtered.map((t) => t.area))];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <SprayCan className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Cleaning & Sanitation</h1>
          <p className="text-sm text-muted-foreground">Track cleaning completion by area and frequency</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="daily" className="flex-1">
            Daily
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {tasks.filter((t) => t.frequency === "daily" && t.done).length}/{tasks.filter((t) => t.frequency === "daily").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">
            Weekly
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {tasks.filter((t) => t.frequency === "weekly" && t.done).length}/{tasks.filter((t) => t.frequency === "weekly").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1">
            Monthly
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {tasks.filter((t) => t.frequency === "monthly" && t.done).length}/{tasks.filter((t) => t.frequency === "monthly").length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {/* Progress */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {doneCount}/{totalCount} tasks complete
                </span>
                <span className={`text-sm font-bold ${pct === 100 ? "text-success" : "text-muted-foreground"}`}>
                  {pct}%
                </span>
              </div>
              <Progress value={pct} className="h-2" />
            </CardContent>
          </Card>

          {/* Tasks by area */}
          {areas.map((area) => (
            <motion.div key={area} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading">{area}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {filtered
                      .filter((t) => t.area === area)
                      .map((task) => (
                        <button
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors hover:bg-muted/50 ${
                            task.done ? "opacity-60" : ""
                          }`}
                        >
                          {task.done ? (
                            <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${task.done ? "line-through text-muted-foreground" : "font-medium"}`}>
                              {task.task}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {task.dueTime && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {task.dueTime}
                                </span>
                              )}
                              {task.assignedTo && (
                                <span className="text-xs text-muted-foreground">· {task.assignedTo}</span>
                              )}
                              {task.completedAt && (
                                <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                  Done {task.completedAt}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Camera className="h-4 w-4 text-muted-foreground/30 mt-1 shrink-0" />
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Cleaning;
