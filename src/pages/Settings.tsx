import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Thermometer,
  SprayCan,
  ClipboardList,
  Users,
  Shield,
  Bell,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Lock,
  Mail,
  Key,
  LogOut,
  User,
  ChevronRight,
  QrCode,
  Wheat,
  Calendar,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserX, UserCheck, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

// ─── Temperature Units ───
type TempUnit = {
  id: string;
  name: string;
  type: "fridge" | "freezer" | "display" | "ambient" | "probe";
  minTemp: number;
  maxTemp: number;
  active: boolean;
};

const defaultUnits: TempUnit[] = [];

// ─── Cleaning Templates ───
type CleaningTemplate = {
  id: string;
  area: string;
  task: string;
  frequency: "daily" | "weekly" | "monthly";
  dueTime: string;
  active: boolean;
};

const defaultCleaningTemplates: CleaningTemplate[] = [];

// ─── Day Sheet Checks ───
type DaySheetCheck = {
  id: string;
  section: string;
  label: string;
  active: boolean;
};

const defaultDaySheetChecks: DaySheetCheck[] = [];

// ─── Staff ───
type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "supervisor" | "staff" | "readonly";
  active: boolean;
  pin?: string;
};

const defaultStaff: StaffMember[] = [];

// ─── Operating days ───
const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const unitTypeLabel: Record<string, string> = {
  fridge: "Fridge",
  freezer: "Freezer",
  display: "Display Chiller",
  ambient: "Ambient",
  probe: "Probe",
};

const roleLabel: Record<string, string> = {
  owner: "Owner / Manager",
  manager: "Manager",
  supervisor: "Supervisor",
  staff: "Staff",
  readonly: "Read-only (EHO)",
};

const roleBadgeColor: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  manager: "bg-primary/10 text-primary",
  supervisor: "bg-warning/10 text-warning",
  staff: "bg-success/10 text-success",
  readonly: "bg-muted text-muted-foreground",
};

const Settings = () => {
  const { currentSite, currentMembership, organisationId } = useSite();
  const { appUser, staffSession, orgRole, signOut, setStaffSession } = useAuth();
  const canManageStaff =
    orgRole?.org_role === 'org_owner' ||
    currentMembership?.site_role === 'owner' ||
    currentMembership?.site_role === 'supervisor' ||
    staffSession?.site_role === 'owner' ||
    staffSession?.site_role === 'supervisor';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("temperature");
  const [loading, setLoading] = useState(true);

  // Temperature state
  const [tempUnits, setTempUnits] = useState<TempUnit[]>(defaultUnits);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [editUnit, setEditUnit] = useState<TempUnit | null>(null);
  const [unitForm, setUnitForm] = useState({ name: "", type: "fridge" as TempUnit["type"], minTemp: "0", maxTemp: "5" });

  // Cleaning state
  const [cleaningTemplates, setCleaningTemplates] = useState<CleaningTemplate[]>(defaultCleaningTemplates);
  const [showAddCleaning, setShowAddCleaning] = useState(false);
  const [cleaningForm, setCleaningForm] = useState({ area: "", task: "", frequency: "daily" as CleaningTemplate["frequency"], dueTime: "" });

  // Day Sheet state
  const [daySheetChecks, setDaySheetChecks] = useState<DaySheetCheck[]>(defaultDaySheetChecks);
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [checkForm, setCheckForm] = useState({ section: "Opening", label: "" });

  // Staff state
  const [staff, setStaff] = useState<StaffMember[]>(defaultStaff);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", role: "staff" as StaffMember["role"], pin: "", staffId: "" });
  const [staffView, setStaffView] = useState<"active" | "deactivated">("active");
  const [confirmDeactivate, setConfirmDeactivate] = useState<StaffMember | null>(null);

  // Site/business state — populated from currentSite once loaded
  const [bakeryName, setBakeryName] = useState("");
  const [bakeryAddress, setBakeryAddress] = useState("");
  const [siteIdCopied, setSiteIdCopied] = useState(false);
  const [operatingDays, setOperatingDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  const [kioskMode, setKioskMode] = useState(true);
  const [magicLinkAuth, setMagicLinkAuth] = useState(true);
  const [autoLockTime, setAutoLockTime] = useState("22:00");

  // Load real data from the database for the current site
  const loadAll = useCallback(async () => {
    if (!currentSite) { setLoading(false); return; }
    setLoading(true);
    setBakeryName(currentSite.name || "");
    setBakeryAddress(currentSite.address || "");

    const [unitsRes, cleaningRes, sectionsRes, usersRes] = await Promise.all([
      supabase.from('temp_units').select('*').eq('site_id', currentSite.id).order('sort_order'),
      supabase.from('cleaning_tasks').select('*').eq('site_id', currentSite.id).order('sort_order'),
      supabase.from('day_sheet_sections').select('id, title, day_sheet_items(id, label, active, sort_order)').eq('site_id', currentSite.id).order('sort_order'),
      supabase.from('users').select('id, display_name, email, status, auth_type, staff_code').eq('organisation_id', currentSite.organisation_id),
    ]);

    if (unitsRes.data) {
      setTempUnits(unitsRes.data.map((u: any) => ({
        id: u.id, name: u.name, type: u.type, minTemp: Number(u.min_temp), maxTemp: Number(u.max_temp), active: u.active,
      })));
    }
    if (cleaningRes.data) {
      setCleaningTemplates(cleaningRes.data.map((c: any) => ({
        id: c.id, area: c.area, task: c.task, frequency: c.frequency, dueTime: c.due_time || '', active: c.active,
      })));
    }
    if (sectionsRes.data) {
      const checks: DaySheetCheck[] = [];
      for (const s of sectionsRes.data as any[]) {
        for (const item of (s.day_sheet_items || [])) {
          checks.push({ id: item.id, section: s.title, label: item.label, active: item.active });
        }
      }
      setDaySheetChecks(checks);
    }
    if (usersRes.data) {
      setStaff(usersRes.data.map((u: any) => ({
        id: u.id,
        name: u.display_name,
        email: u.email || '',
        role: u.id === appUser?.id ? 'owner' : (u.auth_type === 'staff_code' ? 'staff' : 'staff'),
        active: u.status === 'active',
        pin: u.staff_code || undefined,
      })));
    }
    setLoading(false);
  }, [currentSite, appUser?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);


  // Allergen config
  const [requireApproval, setRequireApproval] = useState(true);
  const [showAllergenOnLabels, setShowAllergenOnLabels] = useState(true);

  // Notification settings
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [notifyBreach, setNotifyBreach] = useState(true);
  const [notifyCleaningMissed, setNotifyCleaningMissed] = useState(true);

  // ─── Temperature unit handlers (DB-backed) ───
  const saveUnit = async () => {
    if (!currentSite || !organisationId) {
      toast.error("No site selected. Please refresh the page or contact support.");
      console.error("saveUnit blocked: currentSite or organisationId missing", { currentSite, organisationId });
      return;
    }
    const minT = parseFloat(unitForm.minTemp);
    const maxT = parseFloat(unitForm.maxTemp);
    if (isNaN(minT) || isNaN(maxT)) {
      toast.error("Please enter valid min and max temperatures.");
      return;
    }
    const payload = {
      name: unitForm.name.trim(),
      type: unitForm.type,
      min_temp: minT,
      max_temp: maxT,
    };
    const { error } = editUnit
      ? await supabase.from('temp_units').update(payload).eq('id', editUnit.id)
      : await supabase.from('temp_units').insert({
          ...payload,
          site_id: currentSite.id,
          organisation_id: organisationId,
          sort_order: tempUnits.length + 1,
        });
    if (error) { toast.error(error.message); console.error("temp_units insert error", error); return; }
    toast.success(editUnit ? "Unit updated" : "Unit added");
    setShowAddUnit(false);
    setEditUnit(null);
    setUnitForm({ name: "", type: "fridge", minTemp: "0", maxTemp: "5" });
    loadAll();
  };

  const toggleUnitActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('temp_units').update({ active }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setTempUnits((prev) => prev.map((u) => u.id === id ? { ...u, active } : u));
  };

  const deactivateUnit = async (id: string) => {
    if (!confirm("Permanently delete this unit? This cannot be undone. Logged history for this unit will also be removed.")) return;
    // Delete logs first (no cascade)
    await supabase.from('temp_logs').delete().eq('unit_id', id);
    const { error } = await supabase.from('temp_units').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success("Unit deleted");
    setTempUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const openEditUnit = (unit: TempUnit) => {
    setEditUnit(unit);
    setUnitForm({ name: unit.name, type: unit.type, minTemp: unit.minTemp.toString(), maxTemp: unit.maxTemp.toString() });
    setShowAddUnit(true);
  };

  // ─── Cleaning task handlers (DB-backed) ───
  const saveCleaning = async () => {
    if (!currentSite || !organisationId) return;
    const { error } = await supabase.from('cleaning_tasks').insert({
      site_id: currentSite.id,
      organisation_id: organisationId,
      area: cleaningForm.area,
      task: cleaningForm.task,
      frequency: cleaningForm.frequency,
      due_time: cleaningForm.dueTime || null,
      sort_order: cleaningTemplates.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cleaning task added");
    setShowAddCleaning(false);
    setCleaningForm({ area: "", task: "", frequency: "daily", dueTime: "" });
    loadAll();
  };

  const toggleCleaningActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('cleaning_tasks').update({ active }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setCleaningTemplates((prev) => prev.map((t) => t.id === id ? { ...t, active } : t));
  };

  const deactivateCleaning = async (id: string) => {
    if (!confirm("Permanently delete this cleaning task? This cannot be undone. Logged history will also be removed.")) return;
    await supabase.from('cleaning_logs').delete().eq('task_id', id);
    const { error } = await supabase.from('cleaning_tasks').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
    setCleaningTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // ─── Day sheet check handlers (DB-backed) ───
  const saveDayCheck = async () => {
    if (!currentSite || !organisationId) return;
    // Find or create the section row for the chosen title
    const { data: existing } = await supabase.from('day_sheet_sections')
      .select('id').eq('site_id', currentSite.id).eq('title', checkForm.section).maybeSingle();

    let sectionId = existing?.id;
    if (!sectionId) {
      const { data: created, error: secErr } = await supabase.from('day_sheet_sections').insert({
        site_id: currentSite.id,
        organisation_id: organisationId,
        title: checkForm.section,
        default_time: checkForm.section === 'Opening' ? '07:00' : '18:00',
        icon: checkForm.section === 'Opening' ? 'Sunrise' : 'Moon',
        sort_order: checkForm.section === 'Opening' ? 1 : 2,
      }).select('id').single();
      if (secErr) { toast.error(secErr.message); return; }
      sectionId = created!.id;
    }

    const existingInSection = daySheetChecks.filter((c) => c.section === checkForm.section).length;
    const { error } = await supabase.from('day_sheet_items').insert({
      section_id: sectionId,
      label: checkForm.label,
      sort_order: existingInSection + 1,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Check added");
    setShowAddCheck(false);
    setCheckForm({ section: "Opening", label: "" });
    loadAll();
  };

  const toggleCheckActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('day_sheet_items').update({ active }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setDaySheetChecks((prev) => prev.map((c) => c.id === id ? { ...c, active } : c));
  };

  const deactivateCheck = async (id: string) => {
    if (!confirm("Permanently delete this check? This cannot be undone. Logged entries will also be removed.")) return;
    await supabase.from('day_sheet_entries').delete().eq('item_id', id);
    const { error } = await supabase.from('day_sheet_items').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success("Check deleted");
    setDaySheetChecks((prev) => prev.filter((c) => c.id !== id));
  };

  // ─── Staff handlers (DB-backed; staff_code rows for kiosk PIN users) ───
  const saveStaff = async () => {
    if (!organisationId) return;
    if (staffForm.email && !staffForm.pin) {
      toast.error("Email-only invites coming soon. Add a PIN to create a kiosk staff account, or invite from your email provider.");
      return;
    }

    // Resolve Staff ID: custom (uppercased, trimmed, alphanumeric) or auto-generated
    let staffId = staffForm.staffId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!staffId) {
      const { data: gen, error: genErr } = await supabase.rpc('generate_staff_code', { _org_id: organisationId });
      if (genErr || !gen) { toast.error("Could not generate Staff ID. Try again."); return; }
      staffId = gen as string;
    }

    const { error } = await supabase.from('users').insert({
      organisation_id: organisationId,
      display_name: staffForm.name,
      email: staffForm.email || null,
      auth_type: 'staff_code',
      staff_code: staffId,
      status: 'active',
    });
    if (error) {
      if (error.code === '23505') {
        toast.error(`Staff ID "${staffId}" is already in use. Choose a different one.`);
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(`Staff member added — Staff ID: ${staffId}`);
    setShowAddStaff(false);
    setStaffForm({ name: "", email: "", role: "staff", pin: "", staffId: "" });
    loadAll();
  };

  const toggleStaffActive = async (id: string, active: boolean) => {
    if (!canManageStaff) {
      toast.error("Only Owners and Supervisors can change staff status.");
      return;
    }
    if (!active && id === appUser?.id) {
      toast.error("You can't deactivate your own account.");
      return;
    }
    const { error } = await supabase.from('users').update({ status: active ? 'active' : 'suspended' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setStaff((prev) => prev.map((s) => s.id === id ? { ...s, active } : s));
    toast.success(active ? "Staff member reactivated — PIN login restored" : "Staff member deactivated — PIN login revoked. Their historical records are preserved.");
  };

  // ─── Site info save ───
  const saveSiteInfo = async () => {
    if (!currentSite) return;
    const { error } = await supabase.from('sites').update({
      name: bakeryName,
      address: bakeryAddress,
    }).eq('id', currentSite.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Site updated");
  };

  const tempLimitDefaults: Record<string, { min: string; max: string }> = {
    fridge: { min: "0", max: "5" },
    freezer: { min: "-25", max: "-18" },
    display: { min: "0", max: "8" },
    ambient: { min: "10", max: "25" },
    probe: { min: "75", max: "100" },
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure modules, users, and site settings</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="temperature" className="text-xs gap-1"><Thermometer className="h-3 w-3" /> Temps</TabsTrigger>
          <TabsTrigger value="cleaning" className="text-xs gap-1"><SprayCan className="h-3 w-3" /> Cleaning</TabsTrigger>
          <TabsTrigger value="daysheet" className="text-xs gap-1"><ClipboardList className="h-3 w-3" /> Day Sheet</TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1"><Users className="h-3 w-3" /> Users</TabsTrigger>
          <TabsTrigger value="site" className="text-xs gap-1"><Building2 className="h-3 w-3" /> Site</TabsTrigger>
          <TabsTrigger value="account" className="text-xs gap-1"><Shield className="h-3 w-3" /> Account</TabsTrigger>
        </TabsList>

        {/* ════════ TEMPERATURE UNITS ════════ */}
        <TabsContent value="temperature" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold text-sm">Temperature-Controlled Units</h2>
              <p className="text-xs text-muted-foreground">Add, edit, or deactivate fridges, freezers, and probes</p>
            </div>
            <Button size="sm" className="gap-1" onClick={() => { setEditUnit(null); setUnitForm({ name: "", type: "fridge", minTemp: "0", maxTemp: "5" }); setShowAddUnit(true); }}>
              <Plus className="h-3 w-3" /> Add Unit
            </Button>
          </div>

          <div className="space-y-2">
            {tempUnits.map((unit) => (
              <Card key={unit.id} className={!unit.active ? "opacity-50" : ""}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Thermometer className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{unit.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {unitTypeLabel[unit.type]} · {unit.minTemp}°C to {unit.maxTemp}°C
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={unit.active}
                      onCheckedChange={(checked) => toggleUnitActive(unit.id, checked)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => openEditUnit(unit)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-breach hover:text-breach"
                      onClick={() => deactivateUnit(unit.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          <div>
            <h3 className="font-heading font-semibold text-sm mb-3">Default Temperature Limits by Type</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(tempLimitDefaults).map(([type, limits]) => (
                <Card key={type}>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium mb-2">{unitTypeLabel[type]}</p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-[10px]">Min °C</Label>
                        <Input type="number" defaultValue={limits.min} className="h-8 text-sm" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-[10px]">Max °C</Label>
                        <Input type="number" defaultValue={limits.max} className="h-8 text-sm" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Temperature Logging Options</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Require AM & PM checks</p>
                  <p className="text-xs text-muted-foreground">Staff must log temperatures twice daily</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-create recheck on breach</p>
                  <p className="text-xs text-muted-foreground">15-minute recheck task after out-of-spec reading</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">QR code scanning</p>
                  <p className="text-xs text-muted-foreground">Allow QR stickers on units for quick selection</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ════════ CLEANING ════════ */}
        <TabsContent value="cleaning" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold text-sm">Cleaning Task Templates</h2>
              <p className="text-xs text-muted-foreground">Define recurring cleaning tasks and schedules</p>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setShowAddCleaning(true)}>
              <Plus className="h-3 w-3" /> Add Task
            </Button>
          </div>

          {["daily", "weekly", "monthly"].map((freq) => {
            const tasks = cleaningTemplates.filter((t) => t.frequency === freq);
            if (tasks.length === 0) return null;
            return (
              <div key={freq}>
                <h3 className="font-heading font-semibold text-xs uppercase text-muted-foreground mb-2">{freq}</h3>
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <Card key={t.id} className={!t.active ? "opacity-50" : ""}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{t.task}</p>
                          <p className="text-xs text-muted-foreground">{t.area} · Due: {t.dueTime}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={t.active}
                            onCheckedChange={(checked) => toggleCleaningActive(t.id, checked)}
                          />
                          <Button variant="ghost" size="sm" className="text-breach hover:text-breach" onClick={() => deactivateCleaning(t.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ════════ DAY SHEET ════════ */}
        <TabsContent value="daysheet" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold text-sm">Day Sheet Checks</h2>
              <p className="text-xs text-muted-foreground">Configure opening, closing, and custom checks</p>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setShowAddCheck(true)}>
              <Plus className="h-3 w-3" /> Add Check
            </Button>
          </div>

          {["Opening", "Closing"].map((section) => {
            const checks = daySheetChecks.filter((c) => c.section === section);
            return (
              <div key={section}>
                <h3 className="font-heading font-semibold text-xs uppercase text-muted-foreground mb-2">{section} Checks</h3>
                <div className="space-y-2">
                  {checks.map((c) => (
                    <Card key={c.id} className={!c.active ? "opacity-50" : ""}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <p className="text-sm">{c.label}</p>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={c.active}
                            onCheckedChange={(checked) => toggleCheckActive(c.id, checked)}
                          />
                          <Button variant="ghost" size="sm" className="text-breach hover:text-breach" onClick={() => deactivateCheck(c.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Day Sheet Rules</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-lock time</p>
                <p className="text-xs text-muted-foreground">Day sheet auto-locks if not manually locked by this time</p>
              </div>
              <Input type="time" value={autoLockTime} onChange={(e) => setAutoLockTime(e.target.value)} className="w-28 h-8 text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require manager note on breach</p>
                <p className="text-xs text-muted-foreground">Manager must add verification note if any critical breach occurred</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </TabsContent>

        {/* ════════ USERS & ROLES ════════ */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold text-sm">Staff & Roles</h2>
              <p className="text-xs text-muted-foreground">Manage who can access what</p>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setShowAddStaff(true)}>
              <Plus className="h-3 w-3" /> Add Staff
            </Button>
          </div>

          <div className="space-y-2">
            {staff.map((s) => (
              <Card key={s.id} className={!s.active ? "opacity-50" : ""}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.email || "No email"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] border-0 ${roleBadgeColor[s.role]}`}>{roleLabel[s.role]}</Badge>
                    {s.pin && (
                      <Badge variant="outline" className="text-[10px]">
                        <Key className="h-3 w-3 mr-1" /> PIN
                      </Badge>
                    )}
                    <Switch
                      checked={s.active}
                      onCheckedChange={(checked) => toggleStaffActive(s.id, checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Authentication Settings</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Magic link login (email)</p>
                <p className="text-xs text-muted-foreground">Staff receive a login link via email — no password needed</p>
              </div>
              <Switch checked={magicLinkAuth} onCheckedChange={setMagicLinkAuth} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">PIN-based kiosk mode</p>
                <p className="text-xs text-muted-foreground">Staff enter a 4-digit PIN on shared tablet for quick access</p>
              </div>
              <Switch checked={kioskMode} onCheckedChange={setKioskMode} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Role Permissions</h3>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-semibold">Permission</th>
                        <th className="p-2 text-center font-semibold">Owner</th>
                        <th className="p-2 text-center font-semibold">Supervisor</th>
                        <th className="p-2 text-center font-semibold">Staff</th>
                        <th className="p-2 text-center font-semibold">Read-only</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { perm: "Complete assigned checks", owner: true, super: true, staff: true, ro: false },
                        { perm: "Report incidents", owner: true, super: true, staff: true, ro: false },
                        { perm: "Verify & lock day sheets", owner: true, super: true, staff: false, ro: false },
                        { perm: "Create templates & schedules", owner: true, super: false, staff: false, ro: false },
                        { perm: "Manage users & roles", owner: true, super: false, staff: false, ro: false },
                        { perm: "Export inspection packs", owner: true, super: true, staff: false, ro: true },
                        { perm: "Delete records", owner: false, super: false, staff: false, ro: false },
                        { perm: "View all records", owner: true, super: true, staff: false, ro: true },
                      ].map((r) => (
                        <tr key={r.perm} className="border-b">
                          <td className="p-2">{r.perm}</td>
                          <td className="p-2 text-center">{r.owner ? "✓" : "–"}</td>
                          <td className="p-2 text-center">{r.super ? "✓" : "–"}</td>
                          <td className="p-2 text-center">{r.staff ? "✓" : "–"}</td>
                          <td className="p-2 text-center">{r.ro ? "✓" : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════ SITE / BUSINESS ════════ */}
        <TabsContent value="site" className="mt-4 space-y-4">
          {currentSite && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">
                    Site ID — required for Staff PIN login
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Staff enter this short code on the kiosk login screen along with their Staff ID.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 px-3 py-4 rounded-md bg-background border border-border font-mono text-3xl sm:text-4xl font-bold tracking-[0.25em] text-center select-all">
                    {currentSite.site_code}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 shrink-0"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(currentSite.site_code);
                        setSiteIdCopied(true);
                        toast.success("Site ID copied");
                        setTimeout(() => setSiteIdCopied(false), 2000);
                      } catch {
                        toast.error("Could not copy. Select the ID manually.");
                      }
                    }}
                    aria-label="Copy Site ID"
                  >
                    {siteIdCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <h2 className="font-heading font-semibold text-sm">Site Information</h2>

          <div className="space-y-3">
            <div>
              <Label className="text-sm">Bakery name</Label>
              <Input value={bakeryName} onChange={(e) => setBakeryName(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Address</Label>
              <Input value={bakeryAddress} onChange={(e) => setBakeryAddress(e.target.value)} />
            </div>
            <Button size="sm" onClick={saveSiteInfo} className="gap-1">
              <Save className="h-3 w-3" /> Save site info
            </Button>
          </div>

          <Separator />

          <div>
            <h3 className="font-heading font-semibold text-sm mb-3">Operating Days</h3>
            <p className="text-xs text-muted-foreground mb-2">Required daily tasks will only be generated on operating days</p>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => (
                <Button
                  key={day}
                  variant={operatingDays.includes(day) ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    setOperatingDays((prev) =>
                      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                    )
                  }
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Notifications</h3>
            <div className="flex items-center justify-between">
              <p className="text-sm">Overdue task alerts</p>
              <Switch checked={notifyOverdue} onCheckedChange={setNotifyOverdue} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm">Temperature breach alerts</p>
              <Switch checked={notifyBreach} onCheckedChange={setNotifyBreach} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm">Cleaning missed alerts</p>
              <Switch checked={notifyCleaningMissed} onCheckedChange={setNotifyCleaningMissed} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Allergen & Label Settings</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Require manager approval for recipe changes</p>
                <p className="text-xs text-muted-foreground">New or edited recipes must be approved before use</p>
              </div>
              <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Show allergen warnings on labels</p>
                <p className="text-xs text-muted-foreground">Automatically include allergen info in generated labels</p>
              </div>
              <Switch checked={showAllergenOnLabels} onCheckedChange={setShowAllergenOnLabels} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Export Branding</h3>
            <div>
              <Label className="text-sm">Report header name</Label>
              <Input defaultValue="My Venue" />
            </div>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="h-3 w-3" /> Upload Logo for Reports
            </Button>
          </div>
        </TabsContent>

        {/* ════════ ACCOUNT ════════ */}
        <TabsContent value="account" className="mt-4 space-y-4">
          <h2 className="font-heading font-semibold text-sm">Your Account</h2>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {(appUser?.display_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-heading font-semibold">{appUser?.display_name || "—"}</p>
                  <p className="text-sm text-muted-foreground">{appUser?.email || "—"}</p>
                  <Badge className="bg-primary/10 text-primary border-0 text-[10px] mt-1">Owner / Manager</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-3 h-12">
              <User className="h-4 w-4" /> Edit Profile
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-12">
              <Mail className="h-4 w-4" /> Change Email
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-12">
              <Lock className="h-4 w-4" /> Change Password
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-12">
              <Key className="h-4 w-4" /> Set Kiosk PIN
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Security</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Require re-authentication for admin actions</p>
                <p className="text-xs text-muted-foreground">Confirm identity before deleting data or changing roles</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Session timeout</p>
                <p className="text-xs text-muted-foreground">Auto-logout after inactivity</p>
              </div>
              <Select defaultValue="60">
                <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm">Data & Privacy (GDPR)</h3>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2">
              <Download className="h-3 w-3" /> Export My Personal Data
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-breach hover:text-breach">
              <Trash2 className="h-3 w-3" /> Delete / Anonymise Account
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Deleting your account anonymises your identity but preserves audit trail records for compliance.
            </p>
          </div>

          <Separator />

          <Button
            variant="outline"
            className="w-full gap-2 text-breach hover:text-breach border-breach/30"
            onClick={async () => {
              try {
                if (staffSession) {
                  setStaffSession(null);
                } else {
                  await signOut();
                }
                localStorage.removeItem("current_site_id");
                toast.success("Logged out");
                navigate("/auth", { replace: true });
              } catch (e: any) {
                toast.error(e?.message || "Could not log out");
              }
            }}
          >
            <LogOut className="h-4 w-4" /> Log Out
          </Button>
        </TabsContent>
      </Tabs>

      {/* ─── Add/Edit Unit Dialog ─── */}
      <Dialog open={showAddUnit} onOpenChange={(open) => { if (!open) { setShowAddUnit(false); setEditUnit(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editUnit ? "Edit Unit" : "Add Temperature Unit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Unit name</Label>
              <Input placeholder="e.g. Fridge 3, Walk-in Freezer..." value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Type</Label>
              <Select
                value={unitForm.type}
                onValueChange={(v: TempUnit["type"]) => {
                  const defaults = tempLimitDefaults[v] || { min: "0", max: "5" };
                  setUnitForm((f) => ({ ...f, type: v, minTemp: defaults.min, maxTemp: defaults.max }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                  <SelectItem value="display">Display Chiller</SelectItem>
                  <SelectItem value="ambient">Ambient Room</SelectItem>
                  <SelectItem value="probe">Probe (cooking/hot holding)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Min temp (°C)</Label>
                <Input type="number" value={unitForm.minTemp} onChange={(e) => setUnitForm((f) => ({ ...f, minTemp: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm">Max temp (°C)</Label>
                <Input type="number" value={unitForm.maxTemp} onChange={(e) => setUnitForm((f) => ({ ...f, maxTemp: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddUnit(false); setEditUnit(null); }}>Cancel</Button>
            <Button disabled={!unitForm.name} onClick={saveUnit}>
              <Save className="h-3 w-3 mr-1" /> {editUnit ? "Update" : "Add Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Cleaning Dialog ─── */}
      <Dialog open={showAddCleaning} onOpenChange={setShowAddCleaning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Cleaning Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Area</Label>
              <Input placeholder="e.g. Bakery Floor, Prep Area..." value={cleaningForm.area} onChange={(e) => setCleaningForm((f) => ({ ...f, area: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Task description</Label>
              <Input placeholder="e.g. Sweep and mop all floor areas" value={cleaningForm.task} onChange={(e) => setCleaningForm((f) => ({ ...f, task: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Frequency</Label>
              <Select value={cleaningForm.frequency} onValueChange={(v: CleaningTemplate["frequency"]) => setCleaningForm((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Due time / day</Label>
              <Input placeholder="e.g. 12:00, Monday, 1st of month..." value={cleaningForm.dueTime} onChange={(e) => setCleaningForm((f) => ({ ...f, dueTime: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCleaning(false)}>Cancel</Button>
            <Button disabled={!cleaningForm.area || !cleaningForm.task} onClick={saveCleaning}>
              <Save className="h-3 w-3 mr-1" /> Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Day Sheet Check Dialog ─── */}
      <Dialog open={showAddCheck} onOpenChange={setShowAddCheck}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Day Sheet Check</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Section</Label>
              <Select value={checkForm.section} onValueChange={(v) => setCheckForm((f) => ({ ...f, section: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Opening">Opening</SelectItem>
                  <SelectItem value="Closing">Closing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Check description</Label>
              <Input placeholder="e.g. Check gas shut-off valves..." value={checkForm.label} onChange={(e) => setCheckForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCheck(false)}>Cancel</Button>
            <Button disabled={!checkForm.label} onClick={saveDayCheck}>
              <Save className="h-3 w-3 mr-1" /> Add Check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Staff Dialog ─── */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Full name</Label>
              <Input placeholder="e.g. Jane Smith" value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input type="email" placeholder="jane@venue.co.uk" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Role</Label>
              <Select value={staffForm.role} onValueChange={(v: StaffMember["role"]) => setStaffForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner / Manager</SelectItem>
                  <SelectItem value="readonly">Read-only (EHO)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Staff ID (kiosk login)</Label>
              <Input
                type="text"
                maxLength={12}
                placeholder="e.g. J01 — leave blank to auto-generate"
                value={staffForm.staffId}
                onChange={(e) => setStaffForm((f) => ({ ...f, staffId: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Letters, numbers and dashes. Must be unique within your organisation.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStaff(false)}>Cancel</Button>
            <Button disabled={!staffForm.name} onClick={saveStaff}>
              <Save className="h-3 w-3 mr-1" /> Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Need the Download icon for GDPR section
function Download(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default Settings;
