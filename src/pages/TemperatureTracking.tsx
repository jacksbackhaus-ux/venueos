import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Thermometer,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Camera,
  ChevronRight,
  X,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TempUnit = {
  id: string;
  name: string;
  type: "fridge" | "freezer" | "display" | "ambient";
  minTemp: number;
  maxTemp: number;
  lastReading?: { value: number; time: string; pass: boolean };
};

type TempLog = {
  id: string;
  unitId: string;
  unitName: string;
  value: number;
  pass: boolean;
  time: string;
  loggedBy: string;
  correctiveAction?: string;
  type: string;
};

const units: TempUnit[] = [
  { id: "f1", name: "Fridge 1", type: "fridge", minTemp: 0, maxTemp: 5, lastReading: { value: 3.2, time: "08:45", pass: true } },
  { id: "f2", name: "Fridge 2", type: "fridge", minTemp: 0, maxTemp: 5, lastReading: { value: 9.2, time: "08:45", pass: false } },
  { id: "fz1", name: "Freezer 1", type: "freezer", minTemp: -25, maxTemp: -18 },
  { id: "dc1", name: "Display Chiller", type: "display", minTemp: 0, maxTemp: 8, lastReading: { value: 5.1, time: "08:30", pass: true } },
  { id: "amb", name: "Ambient (Bakery)", type: "ambient", minTemp: 10, maxTemp: 25, lastReading: { value: 21.0, time: "08:30", pass: true } },
];

const initialLogs: TempLog[] = [
  { id: "1", unitId: "f1", unitName: "Fridge 1", value: 3.2, pass: true, time: "08:45", loggedBy: "Sarah M.", type: "AM Check" },
  { id: "2", unitId: "f2", unitName: "Fridge 2", value: 9.2, pass: false, time: "08:45", loggedBy: "Sarah M.", type: "AM Check", correctiveAction: "Moved perishables to Fridge 1. Called engineer. Recheck scheduled 10:00." },
  { id: "3", unitId: "dc1", unitName: "Display Chiller", value: 5.1, pass: true, time: "08:30", loggedBy: "Tom B.", type: "AM Check" },
  { id: "4", unitId: "amb", unitName: "Ambient (Bakery)", value: 21.0, pass: true, time: "08:30", loggedBy: "Tom B.", type: "AM Check" },
];

const typeColors: Record<string, string> = {
  fridge: "bg-primary/10 text-primary",
  freezer: "bg-blue-100 text-blue-700",
  display: "bg-success/10 text-success",
  ambient: "bg-warning/10 text-warning",
};

const TemperatureTracking = () => {
  const [logs, setLogs] = useState<TempLog[]>(initialLogs);
  const [showLog, setShowLog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<TempUnit | null>(null);
  const [tempInput, setTempInput] = useState("");
  const [logType, setLogType] = useState("AM Check");
  const [step, setStep] = useState<"select" | "keypad" | "corrective" | "done">("select");
  const [correctiveAction, setCorrectiveAction] = useState("");

  const currentTemp = parseFloat(tempInput);
  const isOutOfSpec = selectedUnit
    ? !isNaN(currentTemp) && (currentTemp < selectedUnit.minTemp || currentTemp > selectedUnit.maxTemp)
    : false;

  const handleKeypad = (key: string) => {
    if (key === "backspace") {
      setTempInput((prev) => prev.slice(0, -1));
    } else if (key === "-") {
      setTempInput((prev) => (prev.startsWith("-") ? prev.slice(1) : "-" + prev));
    } else if (key === "." && !tempInput.includes(".")) {
      setTempInput((prev) => prev + ".");
    } else if (key !== "." && key !== "-" && key !== "backspace") {
      setTempInput((prev) => prev + key);
    }
  };

  const handleSubmitTemp = () => {
    if (isOutOfSpec) {
      setStep("corrective");
      return;
    }
    saveLog();
  };

  const saveLog = () => {
    if (!selectedUnit) return;
    const newLog: TempLog = {
      id: Date.now().toString(),
      unitId: selectedUnit.id,
      unitName: selectedUnit.name,
      value: currentTemp,
      pass: !isOutOfSpec,
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      loggedBy: "You",
      type: logType,
      correctiveAction: correctiveAction || undefined,
    };
    setLogs((prev) => [newLog, ...prev]);
    setStep("done");
  };

  const resetDialog = () => {
    setShowLog(false);
    setSelectedUnit(null);
    setTempInput("");
    setStep("select");
    setCorrectiveAction("");
    setLogType("AM Check");
  };

  const breaches = logs.filter((l) => !l.pass);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Thermometer className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Temperature Tracking</h1>
            <p className="text-sm text-muted-foreground">
              {breaches.length > 0 ? `${breaches.length} breach${breaches.length > 1 ? "es" : ""} today` : "All units within spec"}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowLog(true)} size="lg" className="gap-2">
          <Plus className="h-4 w-4" /> Quick Temp Log
        </Button>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {units.map((unit) => (
          <motion.div key={unit.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                unit.lastReading && !unit.lastReading.pass ? "border-breach/50 bg-breach/5" : ""
              }`}
              onClick={() => {
                setSelectedUnit(unit);
                setShowLog(true);
                setStep("keypad");
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${typeColors[unit.type]}`}>
                      {unit.type}
                    </Badge>
                    <span className="font-heading font-semibold text-sm">{unit.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-end justify-between">
                  {unit.lastReading ? (
                    <>
                      <div>
                        <span className={`text-3xl font-heading font-bold ${unit.lastReading.pass ? "text-foreground" : "text-breach"}`}>
                          {unit.lastReading.value}°C
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">at {unit.lastReading.time}</p>
                      </div>
                      {unit.lastReading.pass ? (
                        <CheckCircle2 className="h-6 w-6 text-success" />
                      ) : (
                        <XCircle className="h-6 w-6 text-breach animate-pulse-breach" />
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">No reading today</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  Limits: {unit.minTemp}°C to {unit.maxTemp}°C
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Today's Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Today's Readings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-3">
                {log.pass ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-breach shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{log.unitName}</span>
                    <Badge variant="outline" className="text-[10px]">{log.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {log.value}°C · {log.time} · {log.loggedBy}
                  </p>
                  {log.correctiveAction && (
                    <p className="text-xs text-breach mt-1 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {log.correctiveAction}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Log Dialog */}
      <Dialog open={showLog} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {step === "select" && "Select Unit"}
              {step === "keypad" && `Log Temp — ${selectedUnit?.name}`}
              {step === "corrective" && "⚠️ Out of Spec — Action Required"}
              {step === "done" && "✅ Logged Successfully"}
            </DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {/* Step 1: Select Unit */}
            {step === "select" && (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                <Select value={logType} onValueChange={setLogType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM Check">AM Check</SelectItem>
                    <SelectItem value="PM Check">PM Check</SelectItem>
                    <SelectItem value="Delivery">Delivery Temp</SelectItem>
                    <SelectItem value="Cooking">Cooking Temp</SelectItem>
                    <SelectItem value="Cooling">Cooling Temp</SelectItem>
                    <SelectItem value="Hot Holding">Hot Holding</SelectItem>
                  </SelectContent>
                </Select>
                {units.map((unit) => (
                  <Button
                    key={unit.id}
                    variant="outline"
                    className="w-full justify-start gap-3 h-14 text-left"
                    onClick={() => {
                      setSelectedUnit(unit);
                      setStep("keypad");
                    }}
                  >
                    <Thermometer className="h-4 w-4 text-primary" />
                    <div>
                      <span className="font-medium">{unit.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({unit.minTemp}–{unit.maxTemp}°C)</span>
                    </div>
                  </Button>
                ))}
              </motion.div>
            )}

            {/* Step 2: Keypad */}
            {step === "keypad" && (
              <motion.div key="keypad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="text-center">
                  <div
                    className={`text-5xl font-heading font-bold py-4 rounded-lg border-2 ${
                      tempInput === ""
                        ? "border-border text-muted-foreground"
                        : isOutOfSpec
                        ? "border-breach bg-breach/5 text-breach"
                        : "border-success bg-success/5 text-success"
                    }`}
                  >
                    {tempInput || "—"}
                    <span className="text-2xl">°C</span>
                  </div>
                  {selectedUnit && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Acceptable: {selectedUnit.minTemp}°C to {selectedUnit.maxTemp}°C
                    </p>
                  )}
                </div>

                {/* Number pad */}
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "0", "."].map((key) => (
                    <Button
                      key={key}
                      variant="outline"
                      className="h-14 text-xl font-bold"
                      onClick={() => handleKeypad(key)}
                    >
                      {key}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleKeypad("backspace")}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={tempInput === "" || isNaN(currentTemp)}
                    onClick={handleSubmitTemp}
                  >
                    {isOutOfSpec ? (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-1" /> Out of Spec
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Save
                      </>
                    )}
                  </Button>
                </div>

                <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                  <Camera className="h-4 w-4" /> Add Photo Evidence
                </Button>
              </motion.div>
            )}

            {/* Step 3: Corrective Action */}
            {step === "corrective" && (
              <motion.div key="corrective" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="rounded-lg bg-breach/10 p-4 text-center">
                  <XCircle className="h-8 w-8 text-breach mx-auto mb-2" />
                  <p className="text-2xl font-heading font-bold text-breach">{currentTemp}°C</p>
                  <p className="text-sm text-breach/80">
                    {selectedUnit?.name} is out of acceptable range ({selectedUnit?.minTemp}–{selectedUnit?.maxTemp}°C)
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">What corrective action did you take?</p>
                  <div className="space-y-2">
                    {[
                      "Moved food to another unit",
                      "Called engineer / maintenance",
                      "Adjusted thermostat and will recheck",
                      "Disposed of affected stock",
                    ].map((action) => (
                      <Button
                        key={action}
                        variant={correctiveAction === action ? "default" : "outline"}
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => setCorrectiveAction(action)}
                      >
                        {action}
                      </Button>
                    ))}
                  </div>
                </div>

                <Textarea
                  placeholder="Additional details (optional)..."
                  value={correctiveAction.includes("Moved") || correctiveAction.includes("Called") || correctiveAction.includes("Adjusted") || correctiveAction.includes("Disposed") ? "" : correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value || correctiveAction)}
                  className="text-sm"
                />

                <Button className="w-full" disabled={!correctiveAction} onClick={saveLog}>
                  Save with Corrective Action
                </Button>
              </motion.div>
            )}

            {/* Step 4: Done */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
                <div>
                  <p className="font-heading font-bold text-lg">Temperature Logged</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedUnit?.name} · {currentTemp}°C · {logType}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={resetDialog}>
                    Done
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setSelectedUnit(null);
                      setTempInput("");
                      setStep("select");
                      setCorrectiveAction("");
                    }}
                  >
                    Log Another
                  </Button>
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
