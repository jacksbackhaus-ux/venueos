import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Package, Plus, AlertTriangle, CheckCircle2,
  Clock, Ban, Loader2, Search, Check, Trash2, CalendarClock,
  ChevronLeft, PackageCheck, Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { showCommercialModules } from "@/lib/launchFlags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInCalendarDays, addDays, parseISO } from "date-fns";
import { calcBatchProductionCost, loadCostContextForOrg, type RecipeWithCost } from "@/lib/recipeCost";
import { displayBatchNumber, formatBatchNumber } from "@/lib/batchNumber";
import { EmptyState } from "@/components/shared/EmptyState";

type BatchStatus = 'in_progress' | 'complete' | 'quarantined' | 'disposed' | 'used';
type ActionType = 'used' | 'disposed' | 'extended' | 'quarantined' | 'unquarantined';

interface Batch {
  id: string;
  batch_code: string;
  product_name: string;
  recipe_ref: string | null;
  recipe_id: string | null;
  recipe_number: number | null;
  product_id: string | null;
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
  date_produced: string | null;
  use_by_date: string | null;
}

interface BatchProduct {
  id: string;
  name: string;
  default_unit: string;
  default_shelf_life_days: number | null;
  default_recipe_number: number | null;
  default_batch_size: number | null;
  last_used_at: string | null;
  active: boolean;
}

interface BatchAction {
  id: string;
  batch_id: string;
  action_type: ActionType;
  reason: string | null;
  previous_use_by: string | null;
  new_use_by: string | null;
  notes: string | null;
  performed_at: string;
  performed_by_name: string | null;
}

const statusConfig: Record<BatchStatus, { label: string; className: string; icon: React.ElementType }> = {
  in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border-primary/20', icon: Clock },
  complete: { label: 'Fresh', className: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 },
  used: { label: 'Used', className: 'bg-muted text-muted-foreground border-border', icon: PackageCheck },
  quarantined: { label: 'Quarantined', className: 'bg-breach/10 text-breach border-breach/20', icon: AlertTriangle },
  disposed: { label: 'Disposed', className: 'bg-muted text-muted-foreground border-border', icon: Ban },
};

const DISPOSAL_REASONS = ['Expired', 'Quality issue', 'Contamination', 'Damaged', 'Other'];

function unitLabel(unit: string | null | undefined, qty: number | null | undefined) {
  const u = (unit || 'units').toLowerCase();
  if (qty === 1 && u.endsWith('s')) return u.slice(0, -1);
  return u;
}

function useByState(useByDate: string | null) {
  if (!useByDate) return null;
  const days = differenceInCalendarDays(parseISO(useByDate), new Date());
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: 'breach' as const, days };
  if (days === 0) return { label: 'Expires today', tone: 'breach' as const, days };
  if (days <= 2) return { label: `${days}d left`, tone: 'warning' as const, days };
  return { label: `${days}d left`, tone: 'success' as const, days };
}

function needsAttention(b: Batch): boolean {
  if (b.status === 'used' || b.status === 'disposed') return false;
  if (!b.use_by_date) return false;
  const d = differenceInCalendarDays(parseISO(b.use_by_date), new Date());
  return d <= 2;
}

export default function Batches() {
  const { appUser, isReadOnly } = useAuth();
  const { currentSite, organisationId } = useSite();
  const { plan, trialActive, compedActive } = useOrgAccess();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<BatchProduct[]>([]);
  const [costRecipes, setCostRecipes] = useState<RecipeWithCost[]>([]);
  const [filter, setFilter] = useState<'all' | 'attention' | 'active' | 'used' | 'disposed'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Create flow
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<'pick' | 'new-product' | 'confirm'>('pick');
  const [pickedProduct, setPickedProduct] = useState<BatchProduct | null>(null);

  // Detail
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [actions, setActions] = useState<BatchAction[]>([]);

  // Action sheets
  const [disposeTarget, setDisposeTarget] = useState<Batch | null>(null);
  const [extendTarget, setExtendTarget] = useState<Batch | null>(null);

  const isCostManager = false; // gate below anyway
  const hasCostAccess = showCommercialModules && (plan.business || plan.bundle || trialActive || compedActive);

  const siteId = currentSite?.id;
  const userName = appUser?.display_name ?? null;

  const loadAll = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const [b, p] = await Promise.all([
      supabase.from('batches').select('*').eq('site_id', siteId).order('created_at', { ascending: false }),
      (supabase.from as any)('batch_products').select('*').eq('site_id', siteId).eq('active', true).order('last_used_at', { ascending: false, nullsFirst: false }),
    ]);
    setBatches((b.data || []) as Batch[]);
    setProducts((p.data || []) as BatchProduct[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!siteId || !organisationId || !hasCostAccess) { setCostRecipes([]); return; }
    loadCostContextForOrg(siteId, organisationId).then(({ recipes }) => setCostRecipes(recipes)).catch(() => setCostRecipes([]));
  }, [siteId, organisationId, hasCostAccess]);

  const totalBatches = batches.length;

  // ── Filtering / grouping ────────────────────────────────────────────
  const attentionBatches = useMemo(() => {
    return batches
      .filter(needsAttention)
      .sort((a, b) => (a.use_by_date || '').localeCompare(b.use_by_date || ''));
  }, [batches]);

  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return batches.filter(b => {
      if (filter === 'attention' && !needsAttention(b)) return false;
      if (filter === 'active' && !(b.status === 'in_progress' || b.status === 'complete' || b.status === 'quarantined')) return false;
      if (filter === 'used' && b.status !== 'used') return false;
      if (filter === 'disposed' && b.status !== 'disposed') return false;
      if (q) {
        const hay = `${b.product_name || ''} ${displayBatchNumber(b.product_name, b.recipe_number, b.batch_code)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [batches, filter, searchQuery]);

  // Recent batches (excluding items already shown in Needs Attention when on "all")
  const attentionIds = useMemo(() => new Set(attentionBatches.map(b => b.id)), [attentionBatches]);
  const recentBatches = useMemo(() => {
    if (filter !== 'all') return filteredBatches;
    return filteredBatches.filter(b => !attentionIds.has(b.id));
  }, [filter, filteredBatches, attentionIds]);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const producedToday = batches.filter(b => (b.date_produced || format(new Date(b.created_at), 'yyyy-MM-dd')) === todayISO);
  const unitsToday = producedToday.reduce((s, b) => s + (Number(b.quantity_produced) || 0), 0);

  // ── Detail loader ───────────────────────────────────────────────────
  const openBatchDetail = async (batch: Batch) => {
    setSelectedBatch(batch);
    const { data } = await (supabase.from as any)('batch_actions').select('*').eq('batch_id', batch.id).order('performed_at', { ascending: false });
    setActions((data || []) as BatchAction[]);
  };

  // ── Actions ─────────────────────────────────────────────────────────
  const logAction = async (batch: Batch, payload: {
    action_type: ActionType;
    reason?: string | null;
    previous_use_by?: string | null;
    new_use_by?: string | null;
    notes?: string | null;
  }) => {
    if (!organisationId) return { error: new Error('No organisation') };
    return (supabase.from as any)('batch_actions').insert({
      batch_id: batch.id,
      site_id: batch.id ? batch['site_id' as keyof Batch] as any : null,
      organisation_id: organisationId,
      performed_by_user_id: appUser?.id ?? null,
      performed_by_name: userName,
      ...payload,
    });
  };

  const markUsed = async (batch: Batch) => {
    const { error: e1 } = await supabase.from('batches').update({ status: 'used' as any, completed_at: new Date().toISOString() }).eq('id', batch.id);
    if (e1) { toast.error(e1.message); return; }
    await (supabase.from as any)('batch_actions').insert({
      batch_id: batch.id,
      site_id: currentSite!.id,
      organisation_id: organisationId,
      action_type: 'used',
      performed_by_user_id: appUser?.id ?? null,
      performed_by_name: userName,
    });
    toast.success(`Marked "${batch.product_name}" as used`);
    setSelectedBatch(sb => sb && sb.id === batch.id ? { ...sb, status: 'used' } : sb);
    loadAll();
  };

  const submitDispose = async (batch: Batch, reason: string, notes: string) => {
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    const { error } = await supabase.from('batches').update({ status: 'disposed' as any, completed_at: new Date().toISOString() }).eq('id', batch.id);
    if (error) { toast.error(error.message); return; }
    await (supabase.from as any)('batch_actions').insert({
      batch_id: batch.id, site_id: currentSite!.id, organisation_id: organisationId,
      action_type: 'disposed', reason, notes: notes || null,
      performed_by_user_id: appUser?.id ?? null, performed_by_name: userName,
    });
    toast.success('Batch disposed and logged for HACCP');
    setDisposeTarget(null);
    setSelectedBatch(sb => sb && sb.id === batch.id ? { ...sb, status: 'disposed' } : sb);
    loadAll();
  };

  const submitExtend = async (batch: Batch, newUseBy: string, reason: string, notes: string) => {
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    if (!newUseBy) { toast.error('New use-by is required'); return; }
    if (batch.use_by_date && newUseBy <= batch.use_by_date) {
      toast.error('New use-by must be after current use-by'); return;
    }
    const { error } = await supabase.from('batches').update({ use_by_date: newUseBy }).eq('id', batch.id);
    if (error) { toast.error(error.message); return; }
    await (supabase.from as any)('batch_actions').insert({
      batch_id: batch.id, site_id: currentSite!.id, organisation_id: organisationId,
      action_type: 'extended', reason, notes: notes || null,
      previous_use_by: batch.use_by_date, new_use_by: newUseBy,
      performed_by_user_id: appUser?.id ?? null, performed_by_name: userName,
    });
    toast.success('Use-by extended and logged for HACCP');
    setExtendTarget(null);
    setSelectedBatch(sb => sb && sb.id === batch.id ? { ...sb, use_by_date: newUseBy } : sb);
    loadAll();
  };

  const toggleQuarantine = async (batch: Batch) => {
    const next: BatchStatus = batch.status === 'quarantined' ? 'complete' : 'quarantined';
    const { error } = await supabase.from('batches').update({ status: next as any }).eq('id', batch.id);
    if (error) { toast.error(error.message); return; }
    await (supabase.from as any)('batch_actions').insert({
      batch_id: batch.id, site_id: currentSite!.id, organisation_id: organisationId,
      action_type: next === 'quarantined' ? 'quarantined' : 'unquarantined',
      performed_by_user_id: appUser?.id ?? null, performed_by_name: userName,
    });
    toast.success(next === 'quarantined' ? 'Batch quarantined' : 'Batch released from quarantine');
    setSelectedBatch(sb => sb && sb.id === batch.id ? { ...sb, status: next } : sb);
    loadAll();
  };

  const deleteBatch = async (batch: Batch) => {
    if (!confirm(`Delete this batch record? This cannot be undone.`)) return;
    const { error } = await supabase.from('batches').delete().eq('id', batch.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Batch deleted');
    setSelectedBatch(null);
    loadAll();
  };

  // ── UI ──────────────────────────────────────────────────────────────
  if (!siteId) {
    return (
      <div className="p-6 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Select a site to view batches.</p>
      </div>
    );
  }

  const openCreate = () => {
    setPickedProduct(null);
    setCreateStep(products.length === 0 ? 'new-product' : 'pick');
    setShowCreate(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Batch Tracking</h1>
            <p className="text-sm text-muted-foreground">What did we bake today?</p>
          </div>
        </div>
        {!isReadOnly && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Batch
          </Button>
        )}
      </div>

      {/* Today summary */}
      <Card className="bg-muted/30 border-dashed shadow-soft">
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

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : totalBatches === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No batches yet"
          description="Log your first bake to build a full traceability trail — product, quantity, use-by."
          action={!isReadOnly && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Log first batch</Button>}
        />
      ) : (
        <>
          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product or batch number"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All ({batches.length})</TabsTrigger>
              <TabsTrigger value="attention">
                Needs attention ({attentionBatches.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({batches.filter(b => b.status === 'in_progress' || b.status === 'complete' || b.status === 'quarantined').length})
              </TabsTrigger>
              <TabsTrigger value="used">Used ({batches.filter(b => b.status === 'used').length})</TabsTrigger>
              <TabsTrigger value="disposed">Disposed ({batches.filter(b => b.status === 'disposed').length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Needs Attention (only on "all" filter) */}
          {filter === 'all' && attentionBatches.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-warning flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Needs Attention
              </h2>
              <div className="space-y-2">
                {attentionBatches.map(b => (
                  <BatchCard
                    key={b.id}
                    batch={b}
                    onOpen={() => openBatchDetail(b)}
                    onUsed={!isReadOnly ? () => markUsed(b) : undefined}
                    onDispose={!isReadOnly ? () => setDisposeTarget(b) : undefined}
                    prominent
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent / filtered results */}
          <section className="space-y-2">
            {filter === 'all' && attentionBatches.length > 0 && (
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Batches
              </h2>
            )}
            {filteredBatches.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No batches match this filter"
                description="Try clearing your filter or search to see all batches."
                action={
                  <Button variant="outline" onClick={() => { setFilter('all'); setSearchQuery(''); }}>
                    Clear filter
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {(filter === 'all' ? recentBatches : filteredBatches).map((batch, idx) => (
                  <motion.div key={batch.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 8) * 0.02 }}>
                    <BatchCard batch={batch} onOpen={() => openBatchDetail(batch)} />
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* CREATE FLOW */}
      <CreateBatchDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        step={createStep}
        setStep={setCreateStep}
        pickedProduct={pickedProduct}
        setPickedProduct={setPickedProduct}
        products={products}
        siteId={siteId}
        organisationId={organisationId!}
        appUserId={appUser?.id ?? null}
        currentSiteName={currentSite?.name || 'SITE'}
        batchesLen={batches.length}
        batches={batches}
        hasCostAccess={hasCostAccess}
        costRecipes={costRecipes}
        onLogged={loadAll}
      />

      {/* DISPOSE SHEET */}
      <DisposeDialog target={disposeTarget} onClose={() => setDisposeTarget(null)} onSubmit={submitDispose} />

      {/* EXTEND SHEET */}
      <ExtendDialog target={extendTarget} onClose={() => setExtendTarget(null)} onSubmit={submitExtend} />

      {/* DETAIL DIALOG */}
      <Dialog open={!!selectedBatch} onOpenChange={(o) => { if (!o) setSelectedBatch(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedBatch && (
            <BatchDetail
              batch={selectedBatch}
              actions={actions}
              isReadOnly={!!isReadOnly}
              onMarkUsed={() => markUsed(selectedBatch)}
              onDispose={() => setDisposeTarget(selectedBatch)}
              onExtend={() => setExtendTarget(selectedBatch)}
              onQuarantineToggle={() => toggleQuarantine(selectedBatch)}
              onDelete={() => deleteBatch(selectedBatch)}
              hasCostAccess={hasCostAccess}
              costRecipes={costRecipes}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function BatchCard({
  batch, onOpen, onUsed, onDispose, prominent,
}: {
  batch: Batch;
  onOpen: () => void;
  onUsed?: () => void;
  onDispose?: () => void;
  prominent?: boolean;
}) {
  const sc = statusConfig[batch.status];
  const Icon = sc.icon;
  const ub = useByState(batch.use_by_date);
  const qty = batch.quantity_produced != null ? Number(batch.quantity_produced) : null;

  const border =
    ub?.tone === 'breach' ? 'border-breach/40'
    : ub?.tone === 'warning' ? 'border-warning/40'
    : '';

  return (
    <Card className={`hover:border-primary/40 hover:shadow-sm transition-all ${border}`}>
      <CardContent className={prominent ? 'p-3 space-y-2' : 'p-3 space-y-1.5'}>
        <div onClick={onOpen} className="cursor-pointer space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-semibold text-base leading-tight text-foreground truncate">
                {batch.product_name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {qty != null && (
                  <>
                    {qty.toLocaleString()} {unitLabel(batch.quantity_unit, qty)}
                    {batch.date_produced && <> · Made {format(parseISO(batch.date_produced), 'd MMM')}</>}
                  </>
                )}
              </p>
            </div>
            <Badge className={`shrink-0 ${sc.className}`} variant="outline">
              <Icon className="h-3 w-3 mr-1" /> {sc.label}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {displayBatchNumber(batch.product_name, batch.recipe_number, batch.batch_code)}
            </span>
            {ub?.label && (
              <Badge variant="outline" className={
                ub.tone === 'breach' ? 'bg-breach/10 text-breach border-breach/30 text-[10px] py-0 px-1.5'
                : ub.tone === 'warning' ? 'bg-warning/10 text-warning border-warning/30 text-[10px] py-0 px-1.5'
                : 'bg-success/10 text-success border-success/30 text-[10px] py-0 px-1.5'
              }>
                {ub.label}
              </Badge>
            )}
          </div>
        </div>

        {(onUsed || onDispose) && (
          <div className="flex gap-2 pt-1">
            {onUsed && (
              <Button size="sm" variant="outline" className="flex-1 h-8 text-success border-success/30 hover:bg-success/10"
                onClick={(e) => { e.stopPropagation(); onUsed(); }}>
                <Check className="h-3.5 w-3.5 mr-1" /> Mark used
              </Button>
            )}
            {onDispose && (
              <Button size="sm" variant="outline" className="flex-1 h-8 text-breach border-breach/30 hover:bg-breach/10"
                onClick={(e) => { e.stopPropagation(); onDispose(); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Dispose
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── CREATE DIALOG ──────────────────────────────────────────────────

function CreateBatchDialog({
  open, onOpenChange, step, setStep, pickedProduct, setPickedProduct,
  products, siteId, organisationId, appUserId, currentSiteName, batchesLen, batches,
  hasCostAccess, costRecipes, onLogged,
}: any) {
  // new product fields
  const [np, setNp] = useState({ name: '', default_unit: 'units', default_shelf_life_days: '', default_recipe_number: '', default_batch_size: '' });
  // confirm fields
  const [qty, setQty] = useState('');
  const [dateProduced, setDateProduced] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useBy, setUseBy] = useState('');
  const [recipeNumber, setRecipeNumber] = useState('');
  const [trayCount, setTrayCount] = useState('');
  const [notes, setNotes] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNp({ name: '', default_unit: 'units', default_shelf_life_days: '', default_recipe_number: '', default_batch_size: '' });
    setQty(''); setDateProduced(format(new Date(), 'yyyy-MM-dd')); setUseBy('');
    setRecipeNumber(''); setTrayCount(''); setNotes(''); setMoreOpen(false);
  }, [open]);

  const advanceToConfirm = (product: BatchProduct) => {
    setPickedProduct(product);
    setQty(product.default_batch_size != null ? String(product.default_batch_size) : '');
    const days = product.default_shelf_life_days;
    if (days != null && days > 0) {
      setUseBy(format(addDays(parseISO(dateProduced), days), 'yyyy-MM-dd'));
    } else {
      setUseBy('');
    }
    // Auto-suggest next recipe number for this product
    const matching = (batches as Batch[]).filter(b =>
      (b.product_id === product.id) ||
      ((b.product_name || '').trim().toLowerCase() === product.name.trim().toLowerCase())
    );
    const maxNum = matching.reduce((m, b) => Math.max(m, Number(b.recipe_number) || 0),
      product.default_recipe_number ? product.default_recipe_number - 1 : 0);
    setRecipeNumber(String(maxNum + 1));
    setStep('confirm');
  };

  // Recompute use-by when produced date changes
  useEffect(() => {
    if (!pickedProduct?.default_shelf_life_days || !dateProduced) return;
    setUseBy(format(addDays(parseISO(dateProduced), pickedProduct.default_shelf_life_days), 'yyyy-MM-dd'));
  }, [dateProduced, pickedProduct]);

  const createNewProduct = async () => {
    if (!np.name.trim()) { toast.error('Product name is required'); return; }
    setSaving(true);
    const { data, error } = await (supabase.from as any)('batch_products').insert({
      site_id: siteId, organisation_id: organisationId,
      name: np.name.trim(),
      default_unit: np.default_unit || 'units',
      default_shelf_life_days: np.default_shelf_life_days ? Number(np.default_shelf_life_days) : null,
      default_recipe_number: np.default_recipe_number ? Number(np.default_recipe_number) : null,
      default_batch_size: np.default_batch_size ? Number(np.default_batch_size) : null,
      created_by_user_id: appUserId,
    }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added "${data.name}" to your product library`);
    onLogged(); // reload products
    advanceToConfirm(data as BatchProduct);
  };

  const logBatch = async (andAnother: boolean) => {
    const qtyNum = qty ? Number(qty) : null;
    if (qtyNum == null || isNaN(qtyNum) || qtyNum < 0) {
      toast.error('Quantity is required'); return;
    }
    if (!pickedProduct) return;
    setSaving(true);
    const date = format(new Date(), 'yyyyMMdd');
    const seq = String(batchesLen + 1).padStart(3, '0');
    const prefix = currentSiteName.substring(0, 4).toUpperCase().replace(/\s/g, '');
    const batchCode = `${prefix}-${date}-${seq}`;

    const recipeNumberVal = recipeNumber ? Math.max(0, Math.floor(Number(recipeNumber))) : null;
    const { error } = await supabase.from('batches').insert({
      site_id: siteId,
      organisation_id: organisationId,
      batch_code: batchCode,
      product_name: pickedProduct.name,
      product_id: pickedProduct.id,
      recipe_ref: pickedProduct.name,
      recipe_number: recipeNumberVal,
      quantity_produced: qtyNum,
      quantity_unit: pickedProduct.default_unit,
      tray_count: trayCount ? Number(trayCount) : null,
      notes: notes || null,
      date_produced: dateProduced || null,
      use_by_date: useBy || null,
      created_by_user_id: appUserId,
    } as any);
    if (!error) {
      // Bump last_used_at
      await (supabase.from as any)('batch_products').update({ last_used_at: new Date().toISOString() }).eq('id', pickedProduct.id);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Logged ${qtyNum} ${unitLabel(pickedProduct.default_unit, qtyNum)}`);
    onLogged();
    if (andAnother) {
      setStep('pick');
      setPickedProduct(null);
      setQty(''); setNotes(''); setTrayCount(''); setRecipeNumber('');
    } else {
      onOpenChange(false);
    }
  };

  // Sort recent products
  const sortedProducts = useMemo(() => {
    const arr = [...(products as BatchProduct[])];
    return arr.sort((a, b) => {
      const at = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      const bt = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name);
    });
  }, [products]);
  const recent = sortedProducts.slice(0, 8);
  const rest = sortedProducts.slice(8);

  const previewBatchNo = pickedProduct
    ? formatBatchNumber(pickedProduct.name, recipeNumber ? Number(recipeNumber) : null)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'confirm' && (
              <button onClick={() => setStep(products.length ? 'pick' : 'new-product')} className="p-1 -ml-1 rounded hover:bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {step === 'pick' && 'Pick a product'}
            {step === 'new-product' && 'Add new product'}
            {step === 'confirm' && 'Confirm batch details'}
          </DialogTitle>
          {step === 'pick' && (
            <DialogDescription>Tap a product to log a fresh batch. New product? Add it once and reuse.</DialogDescription>
          )}
        </DialogHeader>

        {/* STEP 1 — PICK */}
        {step === 'pick' && (
          <div className="space-y-4">
            <Button onClick={() => setStep('new-product')} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add new product
            </Button>

            {recent.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
                <div className="grid grid-cols-2 gap-2">
                  {recent.map(p => (
                    <button key={p.id}
                      onClick={() => advanceToConfirm(p)}
                      className="text-left p-3 rounded-lg border bg-card hover:border-primary/40 hover:bg-muted/30 transition-colors">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.default_unit}
                        {p.default_batch_size != null && <> · {p.default_batch_size} per bake</>}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rest.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All products</p>
                <div className="space-y-1">
                  {rest.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                    <button key={p.id}
                      onClick={() => advanceToConfirm(p)}
                      className="w-full text-left p-2.5 rounded border bg-card hover:border-primary/40 hover:bg-muted/30 transition-colors flex items-center justify-between">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground">{p.default_unit}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — NEW PRODUCT */}
        {step === 'new-product' && (
          <div className="space-y-3">
            <div>
              <Label>Product name *</Label>
              <Input placeholder="e.g. Double Chocolate" value={np.name}
                onChange={e => setNp({ ...np, name: e.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Default unit</Label>
                <Select value={np.default_unit} onValueChange={v => setNp({ ...np, default_unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['units','cookies','portions','loaves','cakes','pieces','trays','kg','litres','bottles'].map(u =>
                      <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Shelf life (days)</Label>
                <Input type="number" step="1" min="0" placeholder="e.g. 3"
                  value={np.default_shelf_life_days}
                  onChange={e => setNp({ ...np, default_shelf_life_days: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Default batch size</Label>
                <Input type="number" step="1" min="0" placeholder="e.g. 120"
                  value={np.default_batch_size}
                  onChange={e => setNp({ ...np, default_batch_size: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Start recipe # at</Label>
                <Input type="number" step="1" min="1" placeholder="e.g. 1"
                  value={np.default_recipe_number}
                  onChange={e => setNp({ ...np, default_recipe_number: e.target.value })} />
              </div>
            </div>
            <DialogFooter className="pt-2">
              {products.length > 0 && (
                <Button variant="ghost" onClick={() => setStep('pick')}>Back</Button>
              )}
              <Button onClick={createNewProduct} disabled={saving || !np.name.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save & continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3 — CONFIRM */}
        {step === 'confirm' && pickedProduct && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Product</p>
                  <p className="font-semibold">{pickedProduct.name}</p>
                </div>
                <button onClick={() => setStep('pick')} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Change
                </button>
              </div>
            </div>

            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3 space-y-2">
              <Label className="text-sm font-semibold">Quantity produced *</Label>
              <div className="flex items-end gap-2">
                <Input type="number" step="1" min="0" placeholder="e.g. 120"
                  className="text-2xl font-semibold h-12"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  autoFocus />
                <span className="pb-3 text-sm text-muted-foreground">{pickedProduct.default_unit}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date produced *</Label>
                <Input type="date" value={dateProduced}
                  onChange={e => setDateProduced(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Use by</Label>
                <Input type="date" value={useBy}
                  onChange={e => setUseBy(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/30 border border-dashed px-3 py-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Batch number</span>
              <span className="text-sm font-mono font-semibold">
                {previewBatchNo ?? '—'}
              </span>
            </div>

            <button onClick={() => setMoreOpen(v => !v)} className="text-xs text-primary hover:underline">
              {moreOpen ? '− Fewer options' : '+ More (tray count, notes, recipe #)'}
            </button>

            {moreOpen && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Recipe # (override)</Label>
                    <Input type="number" step="1" min="0" value={recipeNumber}
                      onChange={e => setRecipeNumber(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Tray count</Label>
                    <Input type="number" step="1" min="0" value={trayCount}
                      onChange={e => setTrayCount(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea placeholder="Optional notes…" value={notes}
                    onChange={e => setNotes(e.target.value)} rows={2} />
                </div>
              </div>
            )}

            <DialogFooter className="pt-1 gap-2 flex-col sm:flex-row">
              <Button variant="outline" onClick={() => logBatch(true)}
                disabled={saving || !qty}
                className="w-full sm:w-auto">
                Log &amp; add another
              </Button>
              <Button onClick={() => logBatch(false)} disabled={saving || !qty}
                className="w-full sm:w-auto">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Log batch
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── DISPOSE DIALOG ──────────────────────────────────────────────────
function DisposeDialog({
  target, onClose, onSubmit,
}: { target: Batch | null; onClose: () => void; onSubmit: (b: Batch, reason: string, notes: string) => Promise<void>; }) {
  const [reason, setReason] = useState('Expired');
  const [otherReason, setOtherReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) { setReason('Expired'); setOtherReason(''); setNotes(''); }
  }, [target]);

  const submit = async () => {
    if (!target) return;
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!finalReason) { toast.error('Reason is required'); return; }
    setSaving(true);
    await onSubmit(target, finalReason, notes);
    setSaving(false);
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dispose batch</DialogTitle>
          <DialogDescription>
            {target?.product_name} — recorded for HACCP traceability.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISPOSAL_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {reason === 'Other' && (
            <div>
              <Label>Please describe *</Label>
              <Input value={otherReason} onChange={e => setOtherReason(e.target.value)} placeholder="Why is this being disposed?" />
            </div>
          )}
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-breach hover:bg-breach/90 text-breach-foreground">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirm disposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── EXTEND DIALOG ──────────────────────────────────────────────────
function ExtendDialog({
  target, onClose, onSubmit,
}: { target: Batch | null; onClose: () => void; onSubmit: (b: Batch, newUseBy: string, reason: string, notes: string) => Promise<void>; }) {
  const [newUseBy, setNewUseBy] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      const base = target.use_by_date ? parseISO(target.use_by_date) : new Date();
      setNewUseBy(format(addDays(base, 1), 'yyyy-MM-dd'));
      setReason(''); setNotes('');
    }
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    await onSubmit(target, newUseBy, reason.trim(), notes);
    setSaving(false);
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Extend use-by</DialogTitle>
          <DialogDescription>
            Requires a reason for HACCP audit. Current use-by:{' '}
            {target?.use_by_date ? format(parseISO(target.use_by_date), 'd MMM yyyy') : '—'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>New use-by *</Label>
            <Input type="date" value={newUseBy} onChange={e => setNewUseBy(e.target.value)}
              min={target?.use_by_date || undefined} />
          </div>
          <div>
            <Label>Reason *</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Held under refrigeration, recipe adjustment" />
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !reason.trim() || !newUseBy}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Extend & log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── DETAIL VIEW ────────────────────────────────────────────────────
function BatchDetail({
  batch, actions, isReadOnly, onMarkUsed, onDispose, onExtend, onQuarantineToggle, onDelete,
  hasCostAccess, costRecipes,
}: {
  batch: Batch;
  actions: BatchAction[];
  isReadOnly: boolean;
  onMarkUsed: () => void;
  onDispose: () => void;
  onExtend: () => void;
  onQuarantineToggle: () => void;
  onDelete: () => void;
  hasCostAccess: boolean;
  costRecipes: RecipeWithCost[];
}) {
  const sc = statusConfig[batch.status];
  const Icon = sc.icon;
  const ub = useByState(batch.use_by_date);
  const qty = batch.quantity_produced != null ? Number(batch.quantity_produced) : null;

  const terminal = batch.status === 'used' || batch.status === 'disposed';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">{batch.product_name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {/* Header block */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={sc.className} variant="outline">
              <Icon className="h-3 w-3 mr-1" /> {sc.label}
            </Badge>
            <span className="text-[11px] font-mono text-muted-foreground">
              {displayBatchNumber(batch.product_name, batch.recipe_number, batch.batch_code)}
            </span>
          </div>

          {qty != null && (
            <p className="text-3xl font-bold tabular-nums leading-none">
              {qty.toLocaleString()}
              <span className="text-lg font-normal text-muted-foreground ml-2">
                {unitLabel(batch.quantity_unit, qty)}
              </span>
            </p>
          )}

          {/* Urgency panel */}
          {ub && (
            <div className={`rounded-lg p-3 ${
              ub.tone === 'breach' ? 'bg-breach/10 border border-breach/30'
              : ub.tone === 'warning' ? 'bg-warning/10 border border-warning/30'
              : 'bg-success/10 border border-success/30'
            }`}>
              <p className={`text-sm font-semibold ${
                ub.tone === 'breach' ? 'text-breach'
                : ub.tone === 'warning' ? 'text-warning'
                : 'text-success'
              }`}>
                {ub.label}
              </p>
              {batch.use_by_date && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use by {format(parseISO(batch.use_by_date), 'd MMM yyyy')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isReadOnly && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              {!terminal && (
                <>
                  <Button size="sm" onClick={onMarkUsed} className="justify-start">
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Mark used
                  </Button>
                  <Button size="sm" variant="outline" className="text-breach border-breach/30 justify-start"
                    onClick={onDispose}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Dispose
                  </Button>
                  <Button size="sm" variant="outline" className="justify-start" onClick={onExtend}>
                    <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Extend use-by
                  </Button>
                  <Button size="sm" variant="outline" className="text-warning border-warning/30 justify-start"
                    onClick={onQuarantineToggle}>
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                    {batch.status === 'quarantined' ? 'Release from quarantine' : 'Quarantine'}
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="text-muted-foreground justify-start col-span-2"
                onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete batch record
              </Button>
            </div>
          </div>
        )}

        {/* Traceability */}
        <div className="space-y-1.5 pt-3 border-t">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Traceability</h4>
          <div className="text-sm space-y-1">
            {batch.date_produced && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produced</span>
                <span>{format(parseISO(batch.date_produced), 'd MMM yyyy')}</span>
              </div>
            )}
            {batch.use_by_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Use by</span>
                <span>{format(parseISO(batch.use_by_date), 'd MMM yyyy')}</span>
              </div>
            )}
            {batch.recipe_ref && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipe</span>
                <span>{batch.recipe_ref}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Internal ID</span>
              <span className="font-mono text-[11px] text-muted-foreground">{batch.batch_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Logged</span>
              <span>{format(new Date(batch.created_at), 'd MMM yyyy HH:mm')}</span>
            </div>
          </div>
        </div>

        {/* Action timeline */}
        {actions.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h4>
            <div className="space-y-1.5">
              {actions.map(a => (
                <div key={a.id} className="text-xs flex items-start gap-2 p-2 rounded bg-muted/30">
                  <span className="font-semibold capitalize shrink-0">{a.action_type}</span>
                  <div className="min-w-0 flex-1">
                    {a.reason && <p className="text-foreground">{a.reason}</p>}
                    {a.action_type === 'extended' && a.previous_use_by && a.new_use_by && (
                      <p className="text-muted-foreground">
                        {format(parseISO(a.previous_use_by), 'd MMM')} → {format(parseISO(a.new_use_by), 'd MMM')}
                      </p>
                    )}
                    {a.notes && <p className="text-muted-foreground italic">{a.notes}</p>}
                    <p className="text-muted-foreground/70 mt-0.5">
                      {format(new Date(a.performed_at), 'd MMM HH:mm')}
                      {a.performed_by_name && ` · ${a.performed_by_name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {batch.notes && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded whitespace-pre-wrap">{batch.notes}</div>
        )}

        {/* Batch Economics (commercial only) */}
        {hasCostAccess && batch.unit_cost_snapshot != null && (
          <div className="rounded-md border bg-primary/5 p-3 space-y-1.5 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Batch Economics</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost per unit</span>
              <span className="tabular-nums">£{Number(batch.unit_cost_snapshot).toFixed(3)}</span>
            </div>
            {batch.total_production_cost != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total batch cost</span>
                <span className="tabular-nums font-semibold">£{Number(batch.total_production_cost).toFixed(2)}</span>
              </div>
            )}
            {batch.margin_pct != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margin</span>
                <span className={`tabular-nums ${batch.margin_below_target ? 'text-breach' : 'text-success'}`}>
                  {Number(batch.margin_pct).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
