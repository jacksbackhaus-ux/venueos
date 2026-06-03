import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Package, Plus, AlertTriangle, CheckCircle2,
  Clock, Ban, Loader2, Search
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInCalendarDays, startOfWeek, startOfMonth } from "date-fns";
import { calcBatchProductionCost, loadCostContextForOrg, type RecipeWithCost } from "@/lib/recipeCost";
import { displayBatchNumber, formatBatchNumber } from "@/lib/batchNumber";

type BatchStatus = 'in_progress' | 'complete' | 'quarantined' | 'disposed';

interface Batch {
  id: string;
  batch_code: string;
  product_name: string;
  recipe_ref: string | null;
  recipe_id: string | null;
  recipe_number: number | null;
  quantity_produced: number | null;
  quantity_unit: string | null;
  tray_count: number | null;
  unit_cost_snapshot: number | null;
  total_production_cost: number | null;
  sale_price_snapshot: number | null;
  target_gp_percent_snapshot: number | null;
  margin_pct: number | null;
  margin_below_target: boolean | null;
  status: BatchStatus;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  template_id: string | null;
  date_produced: string | null;
  use_by_date: string | null;
}

interface BatchTemplate {
  id: string;
  name: string;
  config_json: { stages: { key: string; name: string; requires_notes?: boolean; requires_temp?: boolean; }[] };
  active: boolean;
}

interface StageEvent {
  id: string;
  stage_key: string;
  stage_name_snapshot: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

const statusConfig: Record<BatchStatus, { label: string; className: string; icon: React.ElementType }> = {
  in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border-primary/20', icon: Clock },
  complete: { label: 'Complete', className: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 },
  quarantined: { label: 'Quarantined', className: 'bg-breach/10 text-breach border-breach/20', icon: AlertTriangle },
  disposed: { label: 'Disposed', className: 'bg-muted text-muted-foreground border-border', icon: Ban },
};

function unitLabel(unit: string | null | undefined, qty: number | null | undefined) {
  const u = (unit || 'cookies').toLowerCase();
  if (qty === 1) {
    // crude singular
    if (u.endsWith('s')) return u.slice(0, -1);
  }
  return u;
}

function useByState(useByDate: string | null) {
  if (!useByDate) return null;
  const days = differenceInCalendarDays(new Date(useByDate), new Date());
  if (days < 0) return { label: 'Expired', tone: 'breach' as const, days };
  if (days <= 2) return { label: 'Use soon', tone: 'warning' as const, days };
  return { label: null, tone: 'neutral' as const, days };
}

export default function Batches() {
  const { appUser, isReadOnly, orgRole } = useAuth();
  const { currentSite, organisationId } = useSite();
  const { plan, trialActive, compedActive } = useOrgAccess();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [templates, setTemplates] = useState<BatchTemplate[]>([]);
  const [costRecipes, setCostRecipes] = useState<RecipeWithCost[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("week");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [stageEvents, setStageEvents] = useState<StageEvent[]>([]);
  const [stageLoading, setStageLoading] = useState(false);

  const isCostManager = orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";
  const hasCostAccess =
    isCostManager && (plan.business || plan.bundle || trialActive || compedActive);

  const [newBatch, setNewBatch] = useState({
    product_name: '', recipe_ref: '', recipe_id: '', recipe_number: '',
    quantity_produced: '', quantity_unit: 'cookies', tray_count: '',
    template_id: '', notes: '',
    date_produced: format(new Date(), 'yyyy-MM-dd'), use_by_date: '',
    sale_price: '', // per-unit ex-VAT; pre-fills from recipe when one is picked
  });
  const [creating, setCreating] = useState(false);

  const previewBatchNumber = formatBatchNumber(
    newBatch.product_name,
    newBatch.recipe_number ? Number(newBatch.recipe_number) : null,
  );

  const [stageNotes, setStageNotes] = useState('');
  const [completingStage, setCompletingStage] = useState<string | null>(null);

  const siteId = currentSite?.id;

  const loadBatches = async () => {
    if (!siteId) return;
    setLoading(true);
    const { data } = await supabase.from('batches').select('*').eq('site_id', siteId).order('created_at', { ascending: false });
    setBatches((data || []) as Batch[]);
    setLoading(false);
  };

  const loadTemplates = async () => {
    if (!siteId) return;
    const { data } = await supabase.from('batch_templates').select('*').eq('site_id', siteId).eq('active', true);
    setTemplates((data || []) as unknown as BatchTemplate[]);
  };

  const loadCostRecipes = async () => {
    if (!siteId || !organisationId || !hasCostAccess) { setCostRecipes([]); return; }
    try {
      const { recipes } = await loadCostContextForOrg(siteId, organisationId);
      setCostRecipes(recipes);
    } catch (e) { console.error(e); setCostRecipes([]); }
  };

  useEffect(() => { loadBatches(); loadTemplates(); }, [siteId]);
  useEffect(() => { loadCostRecipes(); }, [siteId, organisationId, hasCostAccess]);

  // Smart unit label when recipe / product name implies cookies/portions/loaves
  const smartUnit = useMemo(() => {
    const name = (newBatch.product_name || '').toLowerCase();
    if (/cookie/.test(name)) return 'cookies';
    if (/loaf|loaves|bread/.test(name)) return 'loaves';
    if (/portion/.test(name)) return 'portions';
    if (/cake|tart|pie/.test(name)) return 'cakes';
    if (/croissant|pastr|bun|roll/.test(name)) return 'pieces';
    return newBatch.quantity_unit || 'cookies';
  }, [newBatch.product_name, newBatch.quantity_unit]);

  // Auto-suggest next recipe number for the current product (max + 1 at this site)
  useEffect(() => {
    if (!newBatch.product_name || newBatch.recipe_number) return;
    const name = newBatch.product_name.trim().toLowerCase();
    if (!name) return;
    const matching = batches.filter(
      b => (b.product_name || '').trim().toLowerCase() === name && b.recipe_number != null
    );
    const maxNum = matching.reduce((m, b) => Math.max(m, Number(b.recipe_number) || 0), 0);
    setNewBatch(nb => nb.recipe_number ? nb : { ...nb, recipe_number: String(maxNum + 1) });
  }, [newBatch.product_name, batches]);

  const generateBatchCode = () => {
    const date = format(new Date(), 'yyyyMMdd');
    const seq = String(batches.length + 1).padStart(3, '0');
    const prefix = (currentSite?.name || 'SITE').substring(0, 4).toUpperCase().replace(/\s/g, '');
    return `${prefix}-${date}-${seq}`;
  };

  const handleCreate = async () => {
    if (!siteId || !organisationId || !appUser) return;
    const qty = newBatch.quantity_produced ? Number(newBatch.quantity_produced) : null;
    if (qty === null || isNaN(qty) || qty < 0) {
      toast.error('Quantity produced is required and must be 0 or more');
      return;
    }
    setCreating(true);
    const batchCode = generateBatchCode();

    let unitCost: number | null = null;
    let totalCost: number | null = null;
    let salePriceSnap: number | null = newBatch.sale_price ? Number(newBatch.sale_price) : null;
    let targetGpSnap: number | null = null;
    let marginPct: number | null = null;
    let marginBelowTarget = false;
    if (hasCostAccess && newBatch.recipe_id && qty > 0) {
      const calc = await calcBatchProductionCost(newBatch.recipe_id, qty, organisationId, siteId);
      if (calc) {
        unitCost = calc.unitCost;
        totalCost = calc.totalCost;
        // Per-batch sale-price override wins; otherwise use the recipe snapshot.
        if (salePriceSnap == null) salePriceSnap = calc.salePriceExVat;
        targetGpSnap = calc.targetGpPercent;
        if (salePriceSnap != null && salePriceSnap > 0 && unitCost != null) {
          marginPct = ((salePriceSnap - unitCost) / salePriceSnap) * 100;
          marginBelowTarget = targetGpSnap != null && marginPct < targetGpSnap;
        }
      }
    }

    const selectedRecipe = costRecipes.find(r => r.id === newBatch.recipe_id);

    const recipeNumberValue = newBatch.recipe_number ? Math.max(0, Math.floor(Number(newBatch.recipe_number))) : null;
    const { error } = await supabase.from('batches').insert({
      site_id: siteId,
      organisation_id: organisationId,
      template_id: newBatch.template_id || null,
      batch_code: batchCode,
      product_name: newBatch.product_name || selectedRecipe?.name || 'Untitled',
      recipe_ref: newBatch.recipe_ref || selectedRecipe?.name || null,
      recipe_id: newBatch.recipe_id || null,
      recipe_number: recipeNumberValue,
      quantity_produced: qty,
      quantity_unit: smartUnit,
      tray_count: newBatch.tray_count ? Number(newBatch.tray_count) : null,
      unit_cost_snapshot: unitCost,
      total_production_cost: totalCost,
      sale_price_snapshot: salePriceSnap,
      target_gp_percent_snapshot: targetGpSnap,
      margin_pct: marginPct,
      margin_below_target: marginBelowTarget,
      notes: newBatch.notes || null,
      date_produced: newBatch.date_produced || null,
      use_by_date: newBatch.use_by_date || null,
      created_by_user_id: appUser.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Logged ${qty} ${unitLabel(smartUnit, qty)}`);
    // Margin alert pipeline — surface immediately so the operator sees the hit.
    if (marginBelowTarget && marginPct != null && targetGpSnap != null) {
      toast.warning(
        `Margin below target on this bake: ${marginPct.toFixed(0)}% (target ${targetGpSnap.toFixed(0)}%)`,
        { description: 'Review your price or production cost in Profit & Pricing.' }
      );
    }
    setShowCreate(false);
    setNewBatch({
      product_name: '', recipe_ref: '', recipe_id: '', recipe_number: '',
      quantity_produced: '', quantity_unit: 'cookies', tray_count: '',
      template_id: '', notes: '',
      date_produced: format(new Date(), 'yyyy-MM-dd'), use_by_date: '',
      sale_price: '',
    });
    loadBatches();
  };

  const openBatchDetail = async (batch: Batch) => {
    setSelectedBatch(batch);
    setStageLoading(true);
    const { data } = await supabase
      .from('batch_stage_events').select('*')
      .eq('batch_id', batch.id).order('started_at');
    setStageEvents((data || []) as StageEvent[]);
    setStageLoading(false);
  };

  const completeStage = async (stageKey: string, stageName: string) => {
    if (!selectedBatch || !appUser) return;
    setCompletingStage(stageKey);
    const { error } = await supabase.from('batch_stage_events').insert({
      batch_id: selectedBatch.id,
      stage_key: stageKey,
      stage_name_snapshot: stageName,
      performed_by_user_id: appUser.id,
      completed_at: new Date().toISOString(),
      notes: stageNotes || null,
    });
    if (error) { toast.error(error.message); setCompletingStage(null); return; }
    toast.success(`Stage "${stageName}" completed`);
    setStageNotes('');
    setCompletingStage(null);
    openBatchDetail(selectedBatch);
  };

  const updateBatchStatus = async (status: BatchStatus) => {
    if (!selectedBatch) return;
    const updates: { status: BatchStatus; completed_at?: string } = { status };
    if (status === 'complete') updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('batches').update(updates).eq('id', selectedBatch.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Batch marked as ${statusConfig[status].label}`);
    setSelectedBatch({ ...selectedBatch, ...updates });
    loadBatches();
  };

  const rangeStart = useMemo(() => {
    const now = new Date();
    if (dateRange === 'today') return format(now, 'yyyy-MM-dd');
    if (dateRange === 'week') return format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (dateRange === 'month') return format(startOfMonth(now), 'yyyy-MM-dd');
    return null;
  }, [dateRange]);

  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return batches.filter(b => {
      if (filterStatus !== 'all' && b.status !== filterStatus) return false;
      if (rangeStart) {
        const refDate = b.date_produced || format(new Date(b.created_at), 'yyyy-MM-dd');
        if (refDate < rangeStart) return false;
      }
      if (q) {
        const hay = `${b.product_name || ''} ${displayBatchNumber(b.product_name, b.recipe_number, b.batch_code)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [batches, filterStatus, rangeStart, searchQuery]);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const producedToday = batches.filter(b => (b.date_produced || format(new Date(b.created_at), 'yyyy-MM-dd')) === todayISO);
  const unitsToday = producedToday.reduce((s, b) => s + (Number(b.quantity_produced) || 0), 0);

  const selectedTemplate = selectedBatch?.template_id
    ? templates.find(t => t.id === selectedBatch.template_id)
    : null;

  if (!siteId) {
    return (
      <div className="p-6 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Select a site to view batches.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Batch Tracking</h1>
            <p className="text-sm text-muted-foreground">What did we bake today?</p>
          </div>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Batch
          </Button>
        )}
      </div>

      {/* Today summary strip */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Produced today</p>
            <p className="text-lg font-semibold tabular-nums leading-tight">
              {producedToday.length}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                batch{producedToday.length === 1 ? '' : 'es'}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Units today</p>
            <p className="text-lg font-semibold tabular-nums leading-tight">{unitsToday.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Search + date range */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product or batch number"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({batches.length})</TabsTrigger>
          <TabsTrigger value="in_progress">
            In Progress ({batches.filter(b => b.status === 'in_progress').length})
          </TabsTrigger>
          <TabsTrigger value="complete">
            Complete ({batches.filter(b => b.status === 'complete').length})
          </TabsTrigger>
          <TabsTrigger value="quarantined">
            Quarantined ({batches.filter(b => b.status === 'quarantined').length})
          </TabsTrigger>
        </TabsList>
      </Tabs>


      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No batches yet. Log your first bake to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((batch, idx) => {
            const sc = statusConfig[batch.status];
            const Icon = sc.icon;
            const ub = useByState(batch.use_by_date);
            const qty = batch.quantity_produced != null ? Number(batch.quantity_produced) : null;
            return (
              <motion.div key={batch.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                <Card
                  className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                  onClick={() => openBatchDetail(batch)}
                >
                  <CardContent className="p-4 space-y-2">
                    {/* LINE 1 — Product + Status */}
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-heading font-bold text-lg leading-tight text-foreground">
                        {batch.product_name}
                      </h3>
                      <Badge className={`shrink-0 ${sc.className}`} variant="outline">
                        <Icon className="h-3 w-3 mr-1" /> {sc.label}
                      </Badge>
                    </div>

                    {/* LINE 1b — Cost & margin snapshot */}
                    {(batch.unit_cost_snapshot != null || batch.margin_pct != null) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {batch.unit_cost_snapshot != null && (
                          <span className="text-muted-foreground tabular-nums">
                            £{Number(batch.unit_cost_snapshot).toFixed(2)}/unit
                          </span>
                        )}
                        {batch.total_production_cost != null && (
                          <span className="text-muted-foreground tabular-nums">
                            · total £{Number(batch.total_production_cost).toFixed(2)}
                          </span>
                        )}
                        {batch.margin_pct != null && (
                          <Badge
                            variant="outline"
                            className={
                              batch.margin_below_target
                                ? 'bg-breach/10 text-breach border-breach/30 text-[10px] py-0 px-1.5 tabular-nums'
                                : 'bg-success/10 text-success border-success/30 text-[10px] py-0 px-1.5 tabular-nums'
                            }
                          >
                            Margin {Number(batch.margin_pct).toFixed(0)}%
                            {batch.target_gp_percent_snapshot != null && (
                              <span className="opacity-70 ml-1">
                                / {Number(batch.target_gp_percent_snapshot).toFixed(0)}%
                              </span>
                            )}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* LINE 2 — BIG quantity */}
                    <div>
                      {qty != null ? (
                        <p className="text-2xl font-semibold text-foreground tabular-nums leading-none">
                          {qty.toLocaleString()}{' '}
                          <span className="text-base font-normal text-muted-foreground">
                            {unitLabel(batch.quantity_unit, qty)}
                          </span>
                          {batch.tray_count ? (
                            <span className="text-sm font-normal text-muted-foreground ml-2">
                              · {batch.tray_count} tray{batch.tray_count === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> No quantity recorded
                        </p>
                      )}
                    </div>

                    {/* LINE 3 — dates */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {batch.date_produced && (
                        <span>Produced {format(new Date(batch.date_produced), 'd MMM')}</span>
                      )}
                      {batch.use_by_date && (
                        <span className="flex items-center gap-1">
                          Use by {format(new Date(batch.use_by_date), 'd MMM')}
                          {ub?.label && (
                            <Badge
                              variant="outline"
                              className={
                                ub.tone === 'breach'
                                  ? 'bg-breach/10 text-breach border-breach/20 text-[10px] py-0 px-1.5'
                                  : 'bg-warning/10 text-warning border-warning/20 text-[10px] py-0 px-1.5'
                              }
                            >
                              {ub.label}
                            </Badge>
                          )}
                        </span>
                      )}
                    </div>

                    {/* LINE 4 — de-emphasised meta */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-xs font-mono font-semibold text-foreground tracking-tight">
                        {displayBatchNumber(batch.product_name, batch.recipe_number, batch.batch_code)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">
                        {format(new Date(batch.created_at), 'd MMM HH:mm')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log a new batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product *</Label>
              <Input
                placeholder="e.g. Double Chocolate Cookies"
                value={newBatch.product_name}
                onChange={e => setNewBatch({ ...newBatch, product_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
              <div>
                <Label>Recipe number *</Label>
                <Input
                  type="number" step="1" min="0" placeholder="e.g. 6"
                  value={newBatch.recipe_number}
                  onChange={e => setNewBatch({ ...newBatch, recipe_number: e.target.value })}
                />
              </div>
              <div className="text-right pb-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Batch number</p>
                <p className="text-sm font-mono font-semibold text-foreground min-h-5">
                  {previewBatchNumber ?? <span className="text-muted-foreground/60">—</span>}
                </p>
              </div>
            </div>

            {/* Quantity — hero field */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="grid grid-cols-[1fr,auto] gap-2 items-end">
                <div>
                  <Label className="text-sm font-semibold">
                    {smartUnit === 'cookies' ? 'Cookies produced *' : `${smartUnit.charAt(0).toUpperCase() + smartUnit.slice(1)} produced *`}
                  </Label>
                  <Input
                    type="number" step="1" min="0" placeholder="e.g. 120"
                    className="text-xl font-semibold h-12"
                    value={newBatch.quantity_produced}
                    onChange={e => setNewBatch({ ...newBatch, quantity_produced: e.target.value })}
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={newBatch.quantity_unit}
                    onValueChange={v => setNewBatch({ ...newBatch, quantity_unit: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cookies">cookies</SelectItem>
                      <SelectItem value="portions">portions</SelectItem>
                      <SelectItem value="loaves">loaves</SelectItem>
                      <SelectItem value="cakes">cakes</SelectItem>
                      <SelectItem value="pieces">pieces</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="units">units</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Tray count (optional)</Label>
                <Input
                  type="number" step="1" min="0" placeholder="e.g. 4"
                  value={newBatch.tray_count}
                  onChange={e => setNewBatch({ ...newBatch, tray_count: e.target.value })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Used for costing, reporting and traceability.
              </p>
            </div>

            {hasCostAccess && costRecipes.length > 0 && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Recipe (links cost data — optional)</Label>
                  <Select
                    value={newBatch.recipe_id || "__none__"}
                    onValueChange={(v) => {
                      const rid = v === "__none__" ? "" : v;
                      const r = costRecipes.find(x => x.id === rid);
                      setNewBatch({
                        ...newBatch,
                        recipe_id: rid,
                        product_name: newBatch.product_name || r?.name || '',
                        recipe_ref: newBatch.recipe_ref || r?.name || '',
                        // Pre-fill per-unit sale price from the recipe; user can override.
                        sale_price:
                          r && (r as any).sale_price != null
                            ? String((r as any).sale_price)
                            : newBatch.sale_price,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="No recipe" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No recipe</SelectItem>
                      {costRecipes.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} — £{r.breakdown.totalCostPerUnit.toFixed(3)}/unit
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newBatch.recipe_id && (
                  <div>
                    <Label className="text-xs">Sale price per unit (£, ex-VAT)</Label>
                    <Input
                      type="number" step="0.01" min="0" placeholder="e.g. 2.50"
                      value={newBatch.sale_price}
                      onChange={e => setNewBatch({ ...newBatch, sale_price: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Used to calculate this batch's margin. Pre-filled from the recipe.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date produced *</Label>
                <Input type="date" value={newBatch.date_produced}
                  onChange={e => setNewBatch({ ...newBatch, date_produced: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Use by</Label>
                <Input type="date" value={newBatch.use_by_date}
                  onChange={e => setNewBatch({ ...newBatch, use_by_date: e.target.value })} />
              </div>
            </div>

            {templates.length > 0 && (
              <div>
                <Label className="text-xs">Template (optional)</Label>
                <Select value={newBatch.template_id} onValueChange={v => setNewBatch({ ...newBatch, template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Optional notes…" value={newBatch.notes}
                onChange={e => setNewBatch({ ...newBatch, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}
              disabled={creating || !newBatch.product_name || !newBatch.quantity_produced || !newBatch.recipe_number}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Log batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Detail Dialog */}
      <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedBatch && (() => {
            const sc = statusConfig[selectedBatch.status];
            const Icon = sc.icon;
            const ub = useByState(selectedBatch.use_by_date);
            const qty = selectedBatch.quantity_produced != null ? Number(selectedBatch.quantity_produced) : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl">{selectedBatch.product_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                  {/* Section A — Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={sc.className} variant="outline">
                        <Icon className="h-3 w-3 mr-1" /> {sc.label}
                      </Badge>
                      {ub?.label && (
                        <Badge variant="outline" className={
                          ub.tone === 'breach'
                            ? 'bg-breach/10 text-breach border-breach/20'
                            : 'bg-warning/10 text-warning border-warning/20'
                        }>
                          {ub.label}
                        </Badge>
                      )}
                    </div>
                    {qty != null ? (
                      <div className="rounded-lg bg-muted/40 p-4">
                        <p className="text-4xl font-bold tabular-nums leading-none">
                          {qty.toLocaleString()}
                          <span className="text-xl font-normal text-muted-foreground ml-2">
                            {unitLabel(selectedBatch.quantity_unit, qty)}
                          </span>
                        </p>
                        {selectedBatch.tray_count != null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedBatch.tray_count} tray{selectedBatch.tray_count === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-warning flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" /> No quantity recorded for this batch
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedBatch.date_produced && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Produced</p>
                          <p>{format(new Date(selectedBatch.date_produced), 'd MMM yyyy')}</p>
                        </div>
                      )}
                      {selectedBatch.use_by_date && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Use by</p>
                          <p>{format(new Date(selectedBatch.use_by_date), 'd MMM yyyy')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section B — Traceability */}
                  <div className="space-y-2 pt-3 border-t">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Traceability</h4>
                    <div className="text-sm space-y-1">
                      {selectedBatch.recipe_ref && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recipe</span>
                          <span>{selectedBatch.recipe_ref}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Batch number</span>
                        <span className="font-mono text-xs font-semibold">
                          {displayBatchNumber(selectedBatch.product_name, selectedBatch.recipe_number, selectedBatch.batch_code)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Internal ID</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{selectedBatch.batch_code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created</span>
                        <span>{format(new Date(selectedBatch.created_at), 'd MMM yyyy HH:mm')}</span>
                      </div>
                    </div>
                  </div>

                  {selectedBatch.notes && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{selectedBatch.notes}</div>
                  )}

                  {/* Cost section */}
                  {hasCostAccess && (selectedBatch.total_production_cost != null || selectedBatch.unit_cost_snapshot != null) && (
                    <div className="rounded-md border bg-primary/5 p-3 space-y-1.5 text-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                        Cost
                      </div>
                      {selectedBatch.total_production_cost != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total batch cost</span>
                          <span className="tabular-nums font-semibold">£{Number(selectedBatch.total_production_cost).toFixed(2)}</span>
                        </div>
                      )}
                      {qty && qty > 0 && selectedBatch.total_production_cost != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Cost per {unitLabel(selectedBatch.quantity_unit, 1)}
                          </span>
                          <span className="tabular-nums">
                            £{(Number(selectedBatch.total_production_cost) / qty).toFixed(3)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stage progression */}
                  {selectedTemplate && (
                    <div className="space-y-2 pt-3 border-t">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stages</h4>
                      {stageLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="space-y-2">
                          {selectedTemplate.config_json.stages.map((stage) => {
                            const completed = stageEvents.find(e => e.stage_key === stage.key && e.completed_at);
                            return (
                              <div key={stage.key} className={`p-2 rounded border text-sm ${completed ? 'bg-success/5 border-success/20' : 'border-border'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {completed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                                    <span className={completed ? 'text-success' : ''}>{stage.name}</span>
                                  </div>
                                  {!completed && !isReadOnly && selectedBatch.status === 'in_progress' && (
                                    <Button size="sm" variant="outline"
                                      disabled={completingStage === stage.key}
                                      onClick={() => completeStage(stage.key, stage.name)}>
                                      {completingStage === stage.key ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Complete'}
                                    </Button>
                                  )}
                                </div>
                                {completed?.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 ml-6">{completed.notes}</p>
                                )}
                              </div>
                            );
                          })}
                          {!isReadOnly && selectedBatch.status === 'in_progress' && (
                            <div>
                              <Label className="text-xs">Stage notes (optional)</Label>
                              <Input placeholder="Add notes for the next stage…" value={stageNotes}
                                onChange={e => setStageNotes(e.target.value)} className="text-sm" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section C — Actions */}
                  {!isReadOnly && selectedBatch.status === 'in_progress' && (
                    <div className="flex gap-2 pt-3 border-t">
                      <Button size="sm" className="flex-1" onClick={() => updateBatchStatus('complete')}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-breach border-breach/30"
                        onClick={() => updateBatchStatus('quarantined')}>
                        <AlertTriangle className="h-3 w-3 mr-1" /> Quarantine
                      </Button>
                    </div>
                  )}
                  {!isReadOnly && selectedBatch.status === 'quarantined' && (
                    <div className="flex gap-2 pt-3 border-t">
                      <Button size="sm" variant="outline" className="flex-1"
                        onClick={() => updateBatchStatus('in_progress')}>
                        Return to progress
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1"
                        onClick={() => updateBatchStatus('disposed')}>
                        <Ban className="h-3 w-3 mr-1" /> Dispose
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
