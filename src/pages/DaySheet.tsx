import { useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  Lock,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Truck,
  SprayCan,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type CheckItem = {
  id: string;
  label: string;
  done: boolean;
  note?: string;
};

type Section = {
  id: string;
  title: string;
  icon: React.ElementType;
  time: string;
  items: CheckItem[];
  expanded: boolean;
};

const initialSections: Section[] = [
  {
    id: "opening",
    title: "Opening Checks",
    icon: ClipboardList,
    time: "07:00",
    expanded: true,
    items: [
      { id: "o1", label: "Premises secure and clean on arrival", done: true },
      { id: "o2", label: "Pest traps checked — no signs of activity", done: true },
      { id: "o3", label: "Hand wash stations stocked (soap, paper towels)", done: true },
      { id: "o4", label: "Food contact surfaces cleaned and sanitised", done: false },
      { id: "o5", label: "Allergen info displayed and up to date", done: false },
    ],
  },
  {
    id: "temps",
    title: "AM Temperature Checks",
    icon: Thermometer,
    time: "09:00",
    expanded: false,
    items: [
      { id: "t1", label: "Fridge 1 temperature logged", done: true },
      { id: "t2", label: "Fridge 2 temperature logged", done: true, note: "9.2°C — breach. Food moved." },
      { id: "t3", label: "Freezer 1 temperature logged", done: false },
      { id: "t4", label: "Display chiller temperature logged", done: true },
    ],
  },
  {
    id: "deliveries",
    title: "Delivery Checks",
    icon: Truck,
    time: "As received",
    expanded: false,
    items: [
      { id: "d1", label: "Flour delivery — Bakels (expected 10:00)", done: false },
      { id: "d2", label: "Dairy delivery — Meadow Foods (expected 11:00)", done: false },
    ],
  },
  {
    id: "production",
    title: "Production & Cooking Temps",
    icon: Thermometer,
    time: "During bake",
    expanded: false,
    items: [
      { id: "p1", label: "Sausage rolls — core temp ≥75°C", done: false },
      { id: "p2", label: "Quiche — core temp ≥75°C", done: false },
    ],
  },
  {
    id: "cleaning",
    title: "Cleaning Tasks",
    icon: SprayCan,
    time: "Throughout day",
    expanded: false,
    items: [
      { id: "c1", label: "Prep area wiped between products", done: false },
      { id: "c2", label: "Floor swept and mopped — bakery area", done: false },
      { id: "c3", label: "Toilet and hand wash area cleaned", done: false },
    ],
  },
  {
    id: "closing",
    title: "Closing Checks",
    icon: Lock,
    time: "17:00",
    expanded: false,
    items: [
      { id: "cl1", label: "All food covered, labelled, and dated", done: false },
      { id: "cl2", label: "PM fridge/freezer temps logged", done: false },
      { id: "cl3", label: "Bins emptied and area clean", done: false },
      { id: "cl4", label: "Equipment switched off / cleaned", done: false },
      { id: "cl5", label: "Premises secured", done: false },
    ],
  },
];

const DaySheet = () => {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [locked, setLocked] = useState(false);
  const [problemNotes, setProblemNotes] = useState("");
  const [managerNote, setManagerNote] = useState("");

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const doneItems = sections.reduce((sum, s) => sum + s.items.filter((i) => i.done).length, 0);
  const pct = Math.round((doneItems / totalItems) * 100);

  const toggleItem = (sectionId: string, itemId: string) => {
    if (locked) return;
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
          : s
      )
    );
  };

  const toggleSection = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, expanded: !s.expanded } : s))
    );
  };

  const allDone = doneItems === totalItems;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Daily Day Sheet</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        {locked && (
          <Badge className="bg-success text-success-foreground gap-1">
            <Lock className="h-3 w-3" /> Locked
          </Badge>
        )}
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {doneItems}/{totalItems} checks complete
            </span>
            <span className={`text-sm font-bold ${pct === 100 ? "text-success" : pct >= 50 ? "text-warning" : "text-breach"}`}>
              {pct}%
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </CardContent>
      </Card>

      {/* Sections */}
      {sections.map((section) => {
        const sectionDone = section.items.filter((i) => i.done).length;
        const sectionTotal = section.items.length;
        const sectionComplete = sectionDone === sectionTotal;

        return (
          <motion.div key={section.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Collapsible open={section.expanded} onOpenChange={() => toggleSection(section.id)}>
              <Card className={sectionComplete ? "border-success/30" : ""}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <section.icon className={`h-4 w-4 ${sectionComplete ? "text-success" : "text-primary"}`} />
                        <CardTitle className="text-sm font-heading">{section.title}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          {sectionDone}/{sectionTotal}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{section.time}</span>
                        {section.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(section.id, item.id)}
                          disabled={locked}
                          className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors ${
                            locked ? "cursor-default" : "hover:bg-muted/50 cursor-pointer"
                          } ${item.done ? "opacity-70" : ""}`}
                        >
                          {item.done ? (
                            <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1">
                            <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : "font-medium"}`}>
                              {item.label}
                            </span>
                            {item.note && (
                              <p className="text-xs text-breach mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> {item.note}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        );
      })}

      {/* Problems/Issues */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Any problems or changes today?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Describe any issues, near-misses, or changes made today..."
            value={problemNotes}
            onChange={(e) => setProblemNotes(e.target.value)}
            disabled={locked}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Manager Verification */}
      {!locked && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Manager Verification & Lock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Manager notes (required if breaches occurred)..."
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
              className="text-sm"
            />
            <Button
              className="w-full"
              disabled={!allDone && !managerNote}
              onClick={() => setLocked(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              {allDone ? "Lock Day Sheet" : "Lock with Exception Note"}
            </Button>
            {!allDone && !managerNote && (
              <p className="text-xs text-muted-foreground text-center">
                All tasks must be complete, or add an exception note to lock
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {locked && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-success/10 p-4 text-center">
          <Lock className="h-6 w-6 text-success mx-auto mb-2" />
          <p className="font-heading font-bold text-success">Day Sheet Locked</p>
          <p className="text-xs text-muted-foreground">
            Locked by Manager at {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Entries are now immutable.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default DaySheet;
