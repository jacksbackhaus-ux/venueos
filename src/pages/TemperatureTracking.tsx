import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Thermometer, Plus, CheckCircle2, XCircle, Clock,
  AlertTriangle, ChevronRight, RotateCcw, Sun, Moon, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateNavigator } from "@/components/DateNavigator";

type TempUnit = {
  id: string; name: string; type: string;
  min_temp: number; max_temp: number;
};

type TempLog = {
  id: string; unit_id: string | null; food_item: string | null;
  value: number; pass: boolean; log_type: string;
  corrective_action: string | null; logged_by_name: string; logged_at: string;
};

const PROCESS_CHECK_TYPES = ["Delivery", "Cooking", "Cooling", "Reheating", "Hot Holding"];
const isProcessCheck = (t: string) => PROCESS_CHECK_TYPES.includes(t);

const PROCESS_RANGES: Record<string, { min: number; max: number; label: string }> = {
  Cooking:       { min: 75,  max: 200, label: "≥ 75°C core" },
  Reheating:     { min: 75,  max: 200, label: "≥ 75°C core" },
  "Hot Holding": { min: 63,  max: 200, label: "≥ 63°C" },
  Cooling:       { min: -5,  max: 8,   label: "≤ 8°C within 90 min" },
  Delivery:      { min: -25, max: 8,   label: "≤ 8°C chilled / frozen ≤ -15°C" },
};

const typeColors: Record<string, string> = {
  fridge:  "bg-primary/10 text-primary",
  freezer: "bg-blue-100 text-blue-700",
  display: "bg-success/10 text-success",
  ambient: "bg-warning/10 text-warning",
};

// ─── Smart check type helper ──────────────────────────────────────────────────
// Given today's logs for a unit, return the best default check type
function smartCheckType(unitId: string, logs: TempLog[]): string {
  const unitLogs = logs.filter((l) => l.unit_id === unitId);
  const hasAM = unitLogs.some((l) => l.log_type === "AM Check");
  const hasPM = unitLogs.some((l) => l.log_type === "PM Check");
  if (!hasAM) return "AM Check";
  if (!hasPM) return "PM Check";
  return "Spot Check";
}

// ─── Unit status for card display ─────────────────────────────────────────────
function unitCheckStatus(unitId: string, logs: TempLog[]) {
  const unitLogs = logs.filter((l) => l.unit_id === unitId);
  const amLog = unitLogs.find((l) => l.log_type === "AM Check");
  const pmLog = unitLogs.find((l) => l.log_type === "PM Check");
  return { amLog, pmLog };
}

const TemperatureTracking = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;

  const [showLog, setShowLog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<TempUnit | null>(null);
  const [foodItem, setFoodItem] = useState("");
  const [tempInput, setTempInput] = useState("");
  const [logType, setLogType] = useState("AM Check");
  const [step, setStep] = useState<"select" | "keypad" | "corrective" | "done">("select");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const processMode = isProcessCheck(logType);
  const processRange = PROCESS_RANGES[logType];

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["temp_units", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("temp_units").select("*")
        .eq("site_id", siteId).eq("active", true).order("sort_order");
      if (error) throw error;
      return data as TempUnit[];
    },
    enabled: !!siteId,
  });

  const dayStart = new Date(`${selectedDate}T00:00:00`);
  const dayEnd = new Date(`${selectedDate}T00:00:00`);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["temp_logs", siteId, selectedDate],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("temp_logs").select("*")
        .eq("site_id", siteId)
        .gte("logged_at", dayStart.toISOString())
        .lt("logged_at", dayEnd.toISOString())
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data as TempLog[];
    },
    enabled: !!siteId,
  });

  const insertLog = useMutation({
    mutationFn: async (log: {
      unit_id: string | null; food_item: string | null;
      value: number; pass: boolean; log_type: string; corrective_action?: string;
    }) => {
      const { error } = await supabase.from("temp_logs").insert({
        site_id: siteId!, organisation_id: organisationId!,
        unit_id: log.unit_id, food_item: log.food_item,
        value: log.value, pass: log.pass, log_type: log.log_type,
        corrective_action: log.corrective_action || null,
        logged_by_user_id: appUser?.id || null, logged_by_name: userName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["temp_logs", siteId] });
    },
    onError: (err: any) => toast.error("Failed to save: " + err.message),
  });

  const currentTemp = parseFloat(tempInput);
  const isOutOfSpec = (() => {
    if (isNaN(currentTemp)) return false;
    if (processMode && processRange) return currentTemp < processRange.min || currentTemp > processRange.max;
    if (selectedUnit) return currentTemp < selectedUnit.min_temp || currentTemp > selectedUnit.max_temp;
    return false;
  })();

  const handleKeypad = (key: string) => {
    if (key === "backspace") setTempInput((p) => p.slice(0, -1));
    else if (key === "-") setTempInput((p) => p.startsWith("-") ? p.slice(1) : "-" + p);
    else if (key === "." && !tempInput.includes(".")) setTempInput((p) => p + ".");
    else if (key !== "." && key !== "-" && key !== "backspace") setTempInput((p) => p + key);
  };

  // Check type change — show warning if duplicate AM/PM
  const handleLogTypeChange = (newType: string) => {
    setLogType(newType);
    setDuplicateWarning(null);
    if (!selectedUnit) return;
    if (newType === "AM Check" || newType === "PM Check") {
      const unitLogs = logs.filter((l) => l.unit_id === selectedUnit.id);
      const alreadyLogged = unitLogs.some((l) => l.log_type === newType);
      if (alreadyLogged) {
        setDuplicateWarning(`${newType} has already been logged for ${selectedUnit.name} today. Are you sure you want to log another?`);
      }
    }
  };

  const handleSubmitTemp = () => {
    if (isOutOfSpec) { setStep("corrective"); return; }
    saveLog();
  };

  const saveLog = () => {
    if (processMode) {
      if (!foodItem.trim()) return;
      insertLog.mutate({ unit_id: null, food_item: foodItem.trim(), value: currentTemp, pass: !isOutOfSpec, log_type: logType, corrective_action: correctiveAction || undefined });
    } else {
      if (!selectedUnit) return;
      insertLog.mutate({ unit_id: selectedUnit.id, food_item: null, value: currentTemp, pass: !isOutOfSpec, log_type: logType, corrective_action: correctiveAction || undefined });
    }
    setStep("done");
  };

  const resetDialog = () => {
    setShowLog(false); setSelectedUnit(null); setFoodItem("");
    setTempInput(""); setStep("select"); setCorrectiveAction("");
    setLogType("AM Check"); setDuplicateWarning(null);
  };

  // Open dialog for a specific unit with smart check type pre-selected
  const openForUnit = (unit: TempUnit) => {
    if (!isToday) return;
    const smart = smartCheckType(unit.id, logs);
    setSelectedUnit(unit);
    setLogType(smart);
    setDuplicateWarning(null);

    // If smart type is AM or PM and already logged, show warning
    if (smart === "AM Check" || smart === "PM Check") {
      const unitLogs = logs.filter((l) => l.unit_id === unit.id);
      if (unitLogs.some((l) => l.log_type === smart)) {
        setDuplicateWarning(`${smart} has already been logged for ${unit.name} today.`);
      }
    }
    setShowLog(true);
    setStep("keypad");
  };

  const getUnitName = (unitId: string | null) => unitId ? (units.find((u) => u.id === unitId)?.name || "Unknown") : "—";
  const getUnitLastReading = (unitId: string) => logs.find((l) => l.unit_id === unitId);
  const breaches = logs.filter((l) => !l.pass);

  if (!siteId) return (
    <div className="p-6 text-center text-muted-foreground">No site selected.</div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Thermometer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">Temperature Tracking</h1>
              <p className="text-sm text-muted-foreground">
                {breaches.length > 0
                  ? `${breaches.length} breach${breaches.length > 1 ? "es" : ""} ${isToday ? "today" : "this day"}`
                  : isToday ? "All units within spec" : "Historical readings"}
              </p>
            </div>
          </div>
          {isToday ? (
            <Button onClick={() => { setSelectedUnit(null); setLogType("AM Check"); setStep("select"); setShowLog(true); }} size="lg" className="gap-2">
              <Plus className="h-4 w-4" /> Log Temp
            </Button>
          ) : (
            <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
              <Clock className="h-3 w-3" /> Read-only
            </Badge>
          )}
        </div>
        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} minDate={currentSite?.created_at?.slice(0, 10)} />
      </div>

      {(unitsLoading || logsLoading) && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!unitsLoading && units.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Thermometer className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No temperature units configured</p>
            <p className="text-sm mt-1">Add fridges, freezers, and display units in Settings.</p>
          </CardContent>
        </Card>
      )}

      {/* Unit cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {units.map((unit) => {
          const lastReading = getUnitLastReading(unit.id);
          const isBreaching = lastReading && !lastReading.pass;
          const { amLog, pmLog } = unitCheckStatus(unit.id, logs);
          const nextCheck = smartCheckType(unit.id, logs);

          return (
            <motion.div key={unit.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card
                className={`transition-shadow ${isToday ? "cursor-pointer hover:shadow-md" : "cursor-default"} ${isBreaching ? "border-destructive/50 bg-destructive/5" : ""}`}
                onClick={() => openForUnit(unit)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs ${typeColors[unit.type] || ""}`}>{unit.type}</Badge>
                      <span className="font-heading font-semibold text-sm">{unit.name}</span>
                    </div>
                    {isToday && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {nextCheck === "Spot Check" ? "✓ All done" : `Next: ${nextCheck}`}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-end justify-between">
                    {lastReading ? (
                      <>
                        <div>
                          <span className={`text-3xl font-heading font-bold ${lastReading.pass ? "text-foreground" : "text-destructive"}`}>
                            {Number(lastReading.value)}°C
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            at {new Date(lastReading.logged_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {lastReading.pass ? (
                          <CheckCircle2 className="h-6 w-6 text-success" />
                        ) : (
                          <XCircle className="h-6 w-6 text-destructive animate-pulse" />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{isToday ? "No reading today" : "No reading"}</span>
                      </div>
                    )}
                  </div>

                  {/* AM/PM status indicators */}
                  {isToday && (
                    <div className="flex gap-2 mt-3 pt-2 border-t">
                      <div className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${amLog ? (amLog.pass ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive") : "bg-muted text-muted-foreground"}`}>
                        <Sun className="h-3 w-3" />
                        {amLog ? `AM ${amLog.pass ? "✓" : "✗"}` : "AM —"}
                      </div>
                      <div className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${pmLog ? (pmLog.pass ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive") : "bg-muted text-muted-foreground"}`}>
                        <Moon className="h-3 w-3" />
                        {pmLog ? `PM ${pmLog.pass ? "✓" : "✗"}` : "PM —"}
                      </div>
                      <div className="text-[10px] text-muted-foreground ml-auto self-center">
                        {Number(unit.min_temp)}–{Number(unit.max_temp)}°C
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Readings list */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">{isToday ? "Today's Readings" : "Readings for this day"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-3">
                  {log.pass ? (
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.food_item || getUnitName(log.unit_id)}</span>
                      <Badge variant="outline" className="text-[10px]">{log.log_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Number(log.value)}°C · {new Date(log.logged_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {log.logged_by_name}
                    </p>
                    {log.corrective_action && (
                      <p className="text-xs text-destructive mt-1 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        {log.corrective_action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log dialog */}
      <Dialog open={showLog} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {step === "select" && (processMode ? "Log Food Temperature" : "Log Temperature")}
              {step === "keypad" && `Log Temp — ${processMode ? (foodItem || logType) : selectedUnit?.name}`}
              {step === "corrective" && "⚠️ Out of Spec — Action Required"}
              {step === "done" && "✅ Logged Successfully"}
            </DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {step === "select" && (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Check type</Label>
                  <Select value={logType} onValueChange={(v) => { setLogType(v); setSelectedUnit(null); setFoodItem(""); setDuplicateWarning(null); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM Check">AM Check (fridge/freezer)</SelectItem>
                      <SelectItem value="PM Check">PM Check (fridge/freezer)</SelectItem>
                      <SelectItem value="Spot Check">Spot Check (fridge/freezer)</SelectItem>
                      <SelectItem value="Delivery">Delivery Temp (food)</SelectItem>
                      <SelectItem value="Cooking">Cooking Temp (food)</SelectItem>
                      <SelectItem value="Cooling">Cooling Temp (food)</SelectItem>
                      <SelectItem value="Reheating">Reheating Temp (food)</SelectItem>
                      <SelectItem value="Hot Holding">Hot Holding (food)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {processMode ? (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="food-item" className="text-xs text-muted-foreground">Food item</Label>
                    <Input
                      id="food-item"
                      placeholder='e.g. "Chicken curry", "Tomato soup"'
                      value={foodItem}
                      onChange={(e) => setFoodItem(e.target.value)}
                      autoFocus
                    />
                    {processRange && <p className="text-xs text-muted-foreground">Target: {processRange.label}</p>}
                    <Button className="w-full mt-2" disabled={!foodItem.trim()} onClick={() => setStep("keypad")}>
                      Continue to temperature
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs text-muted-foreground">Select unit</Label>
                    {units.map((unit) => {
                      const unitLogs = logs.filter((l) => l.unit_id === unit.id);
                      const alreadyLogged = unitLogs.some((l) => l.log_type === logType);
                      return (
                        <Button
                          key={unit.id}
                          variant="outline"
                          className={`w-full justify-start gap-3 h-14 text-left ${alreadyLogged ? "border-warning/50 bg-warning/5" : ""}`}
                          onClick={() => {
                            setSelectedUnit(unit);
                            if (alreadyLogged && (logType === "AM Check" || logType === "PM Check")) {
                              setDuplicateWarning(`${logType} has already been logged for ${unit.name} today. Tap Save to log anyway.`);
                            } else {
                              setDuplicateWarning(null);
                            }
                            setStep("keypad");
                          }}
                        >
                          <Thermometer className="h-4 w-4 text-primary" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{unit.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({Number(unit.min_temp)}–{Number(unit.max_temp)}°C)</span>
                          </div>
                          {alreadyLogged && (
                            <Badge className="text-[10px] bg-warning/10 text-warning border-0 shrink-0">Already logged</Badge>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {step === "keypad" && (
              <motion.div key="keypad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Duplicate warning */}
                {duplicateWarning && (
                  <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">{duplicateWarning}</p>
                  </div>
                )}

                {/* Check type selector — allow changing on keypad screen */}
                {!processMode && selectedUnit && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Check type</Label>
                    <Select value={logType} onValueChange={handleLogTypeChange}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM Check">AM Check</SelectItem>
                        <SelectItem value="PM Check">PM Check</SelectItem>
                        <SelectItem value="Spot Check">Spot Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="text-center">
                  <div className={`text-5xl font-heading font-bold py-4 rounded-lg border-2 ${
                    tempInput === "" ? "border-border text-muted-foreground"
                      : isOutOfSpec ? "border-destructive bg-destructive/5 text-destructive"
                      : "border-success bg-success/5 text-success"
                  }`}>
                    {tempInput || "—"}<span className="text-2xl">°C</span>
                  </div>
                  {processMode && processRange ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {foodItem ? <><span className="font-medium text-foreground">{foodItem}</span> · </> : null}
                      Target: {processRange.label}
                    </p>
                  ) : selectedUnit ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Acceptable: {Number(selectedUnit.min_temp)}°C to {Number(selectedUnit.max_temp)}°C
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {["1","2","3","4","5","6","7","8","9","-","0","."].map((key) => (
                    <Button key={key} variant="outline" className="h-14 text-xl font-bold" onClick={() => handleKeypad(key)}>{key}</Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleKeypad("backspace")}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button className="flex-1" disabled={tempInput === "" || isNaN(currentTemp)} onClick={handleSubmitTemp}>
                    {isOutOfSpec ? (<><AlertTriangle className="h-4 w-4 mr-1" /> Out of Spec</>) : (<><CheckCircle2 className="h-4 w-4 mr-1" /> Save</>)}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "corrective" && (
              <motion.div key="corrective" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="rounded-lg bg-destructive/10 p-4 text-center">
                  <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-2xl font-heading font-bold text-destructive">{currentTemp}°C</p>
                  <p className="text-sm text-destructive/80">
                    {processMode
                      ? <><span className="font-medium">{foodItem || "Food item"}</span> is outside the safe range for {logType} ({processRange?.label})</>
                      : <>{selectedUnit?.name} is out of range ({Number(selectedUnit?.min_temp)}–{Number(selectedUnit?.max_temp)}°C)</>}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">What corrective action did you take?</p>
                  <div className="space-y-2">
                    {["Moved food to another unit", "Called engineer / maintenance", "Adjusted thermostat and will recheck in 30 mins", "Disposed of affected stock"].map((action) => (
                      <Button key={action} variant={correctiveAction === action ? "default" : "outline"} size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => setCorrectiveAction(action)}>{action}</Button>
                    ))}
                  </div>
                </div>
                <Textarea placeholder="Additional details (optional)..." onChange={(e) => { if (e.target.value) setCorrectiveAction(e.target.value); }} className="text-sm" />
                <Button className="w-full" disabled={!correctiveAction} onClick={saveLog}>Save with Corrective Action</Button>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
                <div>
                  <p className="font-heading font-bold text-lg">Temperature Logged</p>
                  <p className="text-sm text-muted-foreground">
                    {(processMode ? foodItem : selectedUnit?.name) || "—"} · {currentTemp}°C · {logType}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={resetDialog}>Done</Button>
                  <Button className="flex-1" onClick={() => {
                    setSelectedUnit(null); setFoodItem(""); setTempInput("");
                    setStep("select"); setCorrectiveAction(""); setDuplicateWarning(null);
                  }}>Log Another</Button>
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
