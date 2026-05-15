import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Thermometer, CheckCircle2, XCircle, Clock,
  AlertTriangle, RotateCcw, Sun, Moon, Utensils,
  Flame, Snowflake, Truck, Wind, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateNavigator } from "@/components/DateNavigator";
import { EquipmentHealthAlert } from "@/components/temperature/EquipmentHealthAlert";
import { RetrospectiveBanner } from "@/components/RetrospectiveBanner";
import { useRetrospective } from "@/hooks/useRetrospective";
import { cn } from "@/lib/utils";

type TempUnit = {
  id: string; name: string; type: string;
  min_temp: number; max_temp: number;
};

type TempLog = {
  id: string; unit_id: string | null; food_item: string | null;
  value: number; pass: boolean; log_type: string;
  corrective_action: string | null; logged_by_name: string; logged_at: string;
  is_retrospective?: boolean; retrospective_note?: string | null;
};

type ProcessType = "Cooking" | "Reheating" | "Hot Holding" | "Cooling" | "Delivery";

const PROCESS_CHECKS: {
  type: ProcessType; label: string; icon: React.ElementType;
  color: string; min: number; max: number; target: string;
}[] = [
  { type: "Cooking",     label: "Cooking",     icon: Flame,      color: "bg-orange-100 text-orange-700 border-orange-200",  min: 75,  max: 200, target: "≥ 75°C core temp" },
  { type: "Reheating",   label: "Reheating",   icon: Flame,      color: "bg-red-100 text-red-700 border-red-200",           min: 75,  max: 200, target: "≥ 75°C core temp" },
  { type: "Hot Holding", label: "Hot Holding", icon: Wind,       color: "bg-amber-100 text-amber-700 border-amber-200",     min: 63,  max: 200, target: "≥ 63°C" },
  { type: "Cooling",     label: "Cooling",     icon: Snowflake,  color: "bg-blue-100 text-blue-700 border-blue-200",        min: -5,  max: 8,   target: "≤ 8°C within 90 min" },
  { type: "Delivery",    label: "Delivery",    icon: Truck,      color: "bg-primary/10 text-primary border-primary/20",     min: -25, max: 8,   target: "≤ 8°C chilled" },
];

const typeColors: Record<string, string> = {
  fridge:  "bg-primary/10 text-primary",
  freezer: "bg-blue-100 text-blue-700",
  display: "bg-success/10 text-success",
  ambient: "bg-warning/10 text-warning",
};

function smartCheckType(unitId: string, logs: TempLog[]): "AM Check" | "PM Check" | "Spot Check" {
  const ul = logs.filter((l) => l.unit_id === unitId);
  if (!ul.some((l) => l.log_type === "AM Check")) return "AM Check";
  if (!ul.some((l) => l.log_type === "PM Check")) return "PM Check";
  return "Spot Check";
}

const TemperatureTracking = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const { isToday, isRetrospective, canEdit } = useRetrospective(selectedDate);

  // Unit keypad state — inline expansion
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [unitTemp, setUnitTemp] = useState("");
  const [unitStep, setUnitStep] = useState<"keypad" | "corrective" | "done">("keypad");
  const [unitCorrectiveAction, setUnitCorrectiveAction] = useState("");

  // Process check modal state
  const [processDialog, setProcessDialog] = useState<ProcessType | null>(null);
  const [foodItem, setFoodItem] = useState("");
  const [processTemp, setProcessTemp] = useState("");
  const [processStep, setProcessStep] = useState<"food" | "keypad" | "corrective" | "done">("food");
  const [processCorrectiveAction, setProcessCorrectiveAction] = useState("");

  const dayStart = new Date(`${selectedDate}T00:00:00`).toISOString();
  const dayEnd = new Date(new Date(`${selectedDate}T00:00:00`).getTime() + 86400000).toISOString();

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["temp_units", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("temp_units").select("*").eq("site_id", siteId).eq("active", true).order("sort_order");
      if (error) throw error;
      return data as TempUnit[];
    },
    enabled: !!siteId,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["temp_logs", siteId, selectedDate],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("temp_logs").select("*").eq("site_id", siteId).gte("logged_at", dayStart).lt("logged_at", dayEnd).order("logged_at", { ascending: false });
      if (error) throw error;
      return data as TempLog[];
    },
    enabled: !!siteId,
  });

  const insertLog = useMutation({
    mutationFn: async (log: { unit_id: string | null; food_item: string | null; value: number; pass: boolean; log_type: string; corrective_action?: string }) => {
      // For retrospective entries, log against noon of the selected past date so triggers tag the row.
      const loggedAt = isRetrospective
        ? new Date(`${selectedDate}T12:00:00`).toISOString()
        : new Date().toISOString();
      const { error } = await supabase.from("temp_logs").insert({
        site_id: siteId!, organisation_id: organisationId!,
        unit_id: log.unit_id, food_item: log.food_item,
        value: log.value, pass: log.pass, log_type: log.log_type,
        corrective_action: log.corrective_action || null,
        logged_by_user_id: appUser?.id || null, logged_by_name: userName,
        logged_at: loggedAt,
        is_retrospective: isRetrospective,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["temp_logs", siteId] }),
    onError: (err: any) => toast.error("Failed to save: " + err.message),
  });

  // ── Unit keypad helpers ────────────────────────────────────────────────────

  const unitTempNum = parseFloat(unitTemp);
  const activeUnit = units.find((u) => u.id === expandedUnit);
  const unitOutOfSpec = !isNaN(unitTempNum) && activeUnit
    ? unitTempNum < activeUnit.min_temp || unitTempNum > activeUnit.max_temp : false;

  const handleUnitKey = (key: string) => {
    if (key === "backspace") { setUnitTemp((p) => p.slice(0, -1)); return; }
    if (key === "-") { setUnitTemp((p) => p.startsWith("-") ? p.slice(1) : "-" + p); return; }
    if (key === "." && unitTemp.includes(".")) return;
    setUnitTemp((p) => p + key);
  };

  const submitUnitTemp = () => {
    if (unitOutOfSpec) { setUnitStep("corrective"); return; }
    saveUnitLog();
  };

  const saveUnitLog = () => {
    if (!activeUnit) return;
    const checkType = smartCheckType(activeUnit.id, logs);
    insertLog.mutate({
      unit_id: activeUnit.id, food_item: null,
      value: unitTempNum, pass: !unitOutOfSpec,
      log_type: checkType,
      corrective_action: unitCorrectiveAction || undefined,
    });
    setUnitStep("done");
  };

  const resetUnit = () => {
    setExpandedUnit(null); setUnitTemp(""); setUnitStep("keypad"); setUnitCorrectiveAction("");
  };

  // ── Process check helpers ──────────────────────────────────────────────────

  const processTempNum = parseFloat(processTemp);
  const activeProcess = PROCESS_CHECKS.find((p) => p.type === processDialog);
  const processOutOfSpec = !isNaN(processTempNum) && activeProcess
    ? processTempNum < activeProcess.min || processTempNum > activeProcess.max : false;

  const handleProcessKey = (key: string) => {
    if (key === "backspace") { setProcessTemp((p) => p.slice(0, -1)); return; }
    if (key === "-") { setProcessTemp((p) => p.startsWith("-") ? p.slice(1) : "-" + p); return; }
    if (key === "." && processTemp.includes(".")) return;
    setProcessTemp((p) => p + key);
  };

  const submitProcessTemp = () => {
    if (processOutOfSpec) { setProcessStep("corrective"); return; }
    saveProcessLog();
  };

  const saveProcessLog = () => {
    if (!activeProcess || !foodItem.trim()) return;
    insertLog.mutate({
      unit_id: null, food_item: foodItem.trim(),
      value: processTempNum, pass: !processOutOfSpec,
      log_type: activeProcess.type,
      corrective_action: processCorrectiveAction || undefined,
    });
    setProcessStep("done");
  };

  const resetProcess = () => {
    setProcessDialog(null); setFoodItem(""); setProcessTemp("");
    setProcessStep("food"); setProcessCorrectiveAction("");
  };

  const getUnitName = (unitId: string | null) => unitId ? (units.find((u) => u.id === unitId)?.name || "Unknown") : "—";
  const breaches = logs.filter((l) => !l.pass);
  const unitLogs = logs.filter((l) => l.unit_id !== null);
  const processLogs = logs.filter((l) => l.unit_id === null);

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Thermometer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold">Temperature Tracking</h1>
              <p className="text-sm text-muted-foreground">
                {breaches.length > 0
                  ? `${breaches.length} breach${breaches.length > 1 ? "es" : ""} today`
                  : isToday ? "All units within spec" : "Historical readings"}
              </p>
            </div>
          </div>
          {!isToday && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /> Read-only
            </Badge>
          )}
        </div>
        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} minDate={currentSite?.created_at?.slice(0, 10)} />
      </div>

      {isToday && <EquipmentHealthAlert />}

      {(unitsLoading || logsLoading) && (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      )}

      {/* ── SECTION 1: UNIT CHECKS ─────────────────────────────────────────── */}
      {units.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wide">
              Fridges & Freezers
            </h2>
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              {unitLogs.length} reading{unitLogs.length !== 1 ? "s" : ""} today
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {units.map((unit) => {
              const unitReadings = logs.filter((l) => l.unit_id === unit.id);
              const lastReading = unitReadings[0];
              const amLog = unitReadings.find((l) => l.log_type === "AM Check");
              const pmLog = unitReadings.find((l) => l.log_type === "PM Check");
              const isBreaching = lastReading && !lastReading.pass;
              const isExpanded = expandedUnit === unit.id;
              const nextCheck = smartCheckType(unit.id, logs);

              return (
                <motion.div key={unit.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className={cn(
                    "transition-all",
                    isBreaching && "border-destructive/50 bg-destructive/5",
                    isExpanded && "ring-2 ring-primary/30",
                  )}>
                    {/* Card header — always visible */}
                    <button
                      className="w-full text-left"
                      onClick={() => {
                        if (!isToday) return;
                        if (isExpanded) { resetUnit(); } else { setExpandedUnit(unit.id); setUnitTemp(""); setUnitStep("keypad"); setUnitCorrectiveAction(""); }
                      }}
                      disabled={!isToday}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={cn("text-xs", typeColors[unit.type])}>{unit.type}</Badge>
                            <span className="font-heading font-semibold text-sm">{unit.name}</span>
                          </div>
                          {isToday && (
                            <Badge variant="outline" className={cn("text-[10px]", nextCheck === "Spot Check" && "border-success/40 text-success")}>
                              {nextCheck === "Spot Check" ? "✓ Both done" : `Log ${nextCheck}`}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-end justify-between">
                          {lastReading ? (
                            <>
                              <div>
                                <span className={cn("text-3xl font-heading font-bold", lastReading.pass ? "text-foreground" : "text-destructive")}>
                                  {Number(lastReading.value)}°C
                                </span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  at {new Date(lastReading.logged_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              {lastReading.pass
                                ? <CheckCircle2 className="h-6 w-6 text-success" />
                                : <XCircle className="h-6 w-6 text-destructive animate-pulse" />}
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">{isToday ? "No reading yet" : "No reading"}</span>
                            </div>
                          )}
                        </div>

                        {/* AM/PM status pills */}
                        <div className="flex gap-2 mt-3 pt-2 border-t">
                          <span className={cn("flex items-center gap-1 text-xs rounded-full px-2 py-0.5",
                            amLog ? (amLog.pass ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive") : "bg-muted text-muted-foreground")}>
                            <Sun className="h-3 w-3" />
                            {amLog ? `AM ${amLog.pass ? "✓" : "✗"} ${Number(amLog.value)}°C` : "AM —"}
                          </span>
                          <span className={cn("flex items-center gap-1 text-xs rounded-full px-2 py-0.5",
                            pmLog ? (pmLog.pass ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive") : "bg-muted text-muted-foreground")}>
                            <Moon className="h-3 w-3" />
                            {pmLog ? `PM ${pmLog.pass ? "✓" : "✗"} ${Number(pmLog.value)}°C` : "PM —"}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto self-center">
                            {Number(unit.min_temp)} to {Number(unit.max_temp)}°C
                          </span>
                        </div>
                      </CardContent>
                    </button>

                    {/* Inline keypad — expands below card header */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t"
                        >
                          <div className="p-4 space-y-3">
                            {unitStep === "keypad" && (
                              <>
                                <div className={cn(
                                  "text-center text-4xl font-heading font-bold py-3 rounded-lg border-2",
                                  unitTemp === "" ? "border-border text-muted-foreground"
                                    : unitOutOfSpec ? "border-destructive bg-destructive/5 text-destructive"
                                    : "border-success bg-success/5 text-success"
                                )}>
                                  {unitTemp || "—"}<span className="text-xl">°C</span>
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                  Logging: <span className="font-medium text-foreground">{nextCheck}</span> · Acceptable: {Number(unit.min_temp)}–{Number(unit.max_temp)}°C
                                </p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {["1","2","3","4","5","6","7","8","9","-","0","."].map((k) => (
                                    <Button key={k} variant="outline" className="h-12 text-lg font-bold" onClick={() => handleUnitKey(k)}>{k}</Button>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" className="flex-1" onClick={() => handleUnitKey("backspace")}>
                                    <RotateCcw className="h-4 w-4 mr-1" /> Clear
                                  </Button>
                                  <Button variant="outline" className="px-3" onClick={resetUnit}>Cancel</Button>
                                  <Button
                                    className="flex-1"
                                    disabled={unitTemp === "" || isNaN(unitTempNum)}
                                    onClick={submitUnitTemp}
                                  >
                                    {unitOutOfSpec ? <><AlertTriangle className="h-4 w-4 mr-1" /> Out of Spec</> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Save</>}
                                  </Button>
                                </div>
                              </>
                            )}

                            {unitStep === "corrective" && (
                              <div className="space-y-3">
                                <div className="rounded-lg bg-destructive/10 p-3 text-center">
                                  <XCircle className="h-6 w-6 text-destructive mx-auto mb-1" />
                                  <p className="text-xl font-heading font-bold text-destructive">{unitTempNum}°C</p>
                                  <p className="text-xs text-destructive/80">
                                    {unit.name} outside range ({Number(unit.min_temp)}–{Number(unit.max_temp)}°C)
                                  </p>
                                </div>
                                <p className="text-sm font-semibold">Corrective action taken:</p>
                                <div className="space-y-1.5">
                                  {["Moved food to another unit", "Called engineer / maintenance", "Adjusted thermostat — rechecking in 30 mins", "Disposed of affected stock"].map((a) => (
                                    <Button key={a} variant={unitCorrectiveAction === a ? "default" : "outline"} size="sm"
                                      className="w-full justify-start text-left h-auto py-2 text-xs"
                                      onClick={() => setUnitCorrectiveAction(a)}>{a}</Button>
                                  ))}
                                </div>
                                <Button className="w-full" disabled={!unitCorrectiveAction} onClick={saveUnitLog}>
                                  Save with Action
                                </Button>
                              </div>
                            )}

                            {unitStep === "done" && (
                              <div className="text-center py-3 space-y-3">
                                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                                <p className="font-semibold text-sm">Logged — {unitTempNum}°C</p>
                                <Button className="w-full" onClick={resetUnit}>Done</Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {!unitsLoading && units.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Thermometer className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No temperature units configured</p>
          <p className="text-sm mt-1">Add fridges and freezers in Settings.</p>
        </CardContent></Card>
      )}

      {/* ── SECTION 2: FOOD & PROCESS CHECKS ──────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wide">
            Food & Process Checks
          </h2>
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">
            {processLogs.length} log{processLogs.length !== 1 ? "s" : ""} today
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {PROCESS_CHECKS.map((pc) => {
            const count = processLogs.filter((l) => l.log_type === pc.type).length;
            const Icon = pc.icon;
            return (
              <button
                key={pc.type}
                onClick={() => { if (!isToday) return; setProcessDialog(pc.type); setFoodItem(""); setProcessTemp(""); setProcessStep("food"); setProcessCorrectiveAction(""); }}
                disabled={!isToday}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border text-left transition-all",
                  isToday ? "hover:shadow-md cursor-pointer" : "cursor-default opacity-60",
                  pc.color
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-semibold text-center leading-tight">{pc.label}</span>
                {count > 0 && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-white/50">{count} logged</Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Process logs today */}
        {processLogs.length > 0 && (
          <Card>
            <CardContent className="p-0 divide-y">
              {processLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3">
                  {log.pass ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{log.food_item}</span>
                      <Badge variant="outline" className="text-[10px]">{log.log_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Number(log.value)}°C · {new Date(log.logged_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {log.logged_by_name}
                    </p>
                    {log.corrective_action && (
                      <p className="text-xs text-destructive mt-0.5 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{log.corrective_action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Unit readings log */}
      {unitLogs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wide">All Readings</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Card>
            <CardContent className="p-0 divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3">
                  {log.pass ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{log.food_item || getUnitName(log.unit_id)}</span>
                      <Badge variant="outline" className="text-[10px]">{log.log_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Number(log.value)}°C · {new Date(log.logged_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {log.logged_by_name}
                    </p>
                    {log.corrective_action && (
                      <p className="text-xs text-destructive mt-0.5 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{log.corrective_action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Process check modal ─────────────────────────────────────────────── */}
      <Dialog open={!!processDialog} onOpenChange={(open) => !open && resetProcess()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              {activeProcess && <activeProcess.icon className="h-5 w-5" />}
              {processStep === "food" && `${activeProcess?.label} — What food?`}
              {processStep === "keypad" && `${activeProcess?.label} — ${foodItem}`}
              {processStep === "corrective" && "⚠️ Out of Spec"}
              {processStep === "done" && "✅ Logged"}
            </DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {processStep === "food" && (
              <motion.div key="food" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Food item or dish name</Label>
                  <Input
                    className="mt-1"
                    placeholder='e.g. "Chicken curry", "Tomato soup"'
                    value={foodItem}
                    onChange={(e) => setFoodItem(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && foodItem.trim() && setProcessStep("keypad")}
                  />
                </div>
                {activeProcess && (
                  <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    Target: <span className="font-medium text-foreground">{activeProcess.target}</span>
                  </p>
                )}
                <Button className="w-full" disabled={!foodItem.trim()} onClick={() => setProcessStep("keypad")}>
                  Continue
                </Button>
              </motion.div>
            )}

            {processStep === "keypad" && (
              <motion.div key="keypad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className={cn(
                  "text-center text-5xl font-heading font-bold py-4 rounded-lg border-2",
                  processTemp === "" ? "border-border text-muted-foreground"
                    : processOutOfSpec ? "border-destructive bg-destructive/5 text-destructive"
                    : "border-success bg-success/5 text-success"
                )}>
                  {processTemp || "—"}<span className="text-2xl">°C</span>
                </div>
                {activeProcess && (
                  <p className="text-xs text-center text-muted-foreground">
                    <span className="font-medium text-foreground">{foodItem}</span> · Target: {activeProcess.target}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {["1","2","3","4","5","6","7","8","9","-","0","."].map((k) => (
                    <Button key={k} variant="outline" className="h-14 text-xl font-bold" onClick={() => handleProcessKey(k)}>{k}</Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleProcessKey("backspace")}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button className="flex-1" disabled={processTemp === "" || isNaN(processTempNum)} onClick={submitProcessTemp}>
                    {processOutOfSpec ? <><AlertTriangle className="h-4 w-4 mr-1" /> Out of Spec</> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Save</>}
                  </Button>
                </div>
              </motion.div>
            )}

            {processStep === "corrective" && (
              <motion.div key="corrective" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="rounded-lg bg-destructive/10 p-4 text-center">
                  <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-2xl font-heading font-bold text-destructive">{processTempNum}°C</p>
                  <p className="text-sm text-destructive/80">
                    {foodItem} — outside safe range for {activeProcess?.label} ({activeProcess?.target})
                  </p>
                </div>
                <p className="text-sm font-semibold">Corrective action taken:</p>
                <div className="space-y-2">
                  {["Continued cooking until safe temp reached", "Disposed of food — not safe to serve", "Returned to supplier", "Re-chilled and rechecked"].map((a) => (
                    <Button key={a} variant={processCorrectiveAction === a ? "default" : "outline"} size="sm"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => setProcessCorrectiveAction(a)}>{a}</Button>
                  ))}
                </div>
                <Textarea placeholder="Additional details (optional)..." onChange={(e) => { if (e.target.value) setProcessCorrectiveAction(e.target.value); }} className="text-sm" />
                <Button className="w-full" disabled={!processCorrectiveAction} onClick={saveProcessLog}>Save with Action</Button>
              </motion.div>
            )}

            {processStep === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
                <div>
                  <p className="font-heading font-bold text-lg">Logged Successfully</p>
                  <p className="text-sm text-muted-foreground">{foodItem} · {processTempNum}°C · {activeProcess?.label}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={resetProcess}>Done</Button>
                  <Button className="flex-1" onClick={() => { setFoodItem(""); setProcessTemp(""); setProcessStep("food"); setProcessCorrectiveAction(""); }}>Log Another</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemperatureTracking;
