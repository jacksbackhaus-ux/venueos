import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Package, Plus, Filter, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, Ban, FileText, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { calcBatchProductionCost, loadCostContextForOrg, type RecipeWithCost } from "@/lib/recipeCost";

type BatchStatus = 'in_progress' | 'complete' | 'quarantined' | 'disposed';

interface Batch {
  id: string;
  batch_code: string;
  product_name: string;
  recipe_ref: string | null;
  recipe_id: string | null;
  quantity_produced: number | null;
  unit_cost_snapshot: number | null;
  total_production_cost: number | null;
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

const statusConfig: Record<BatchStatus, { label: string; color: string; icon: React.ElementType }> = {
  in_progress: { label: 'In Progress', color: 'bg-primary/10 text-primary', icon: Clock },
  complete: { label: 'Complete', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  quarantined: { label: 'Quarantined', color: 'bg-warning/10 text-warning', icon: AlertTriangle },
  disposed: { label: 'Disposed', color: 'bg-breach/10 text-breach', icon: Ban },
};

export default function Batches() {
  const { appUser, isReadOnly, orgRole } = useAuth();
  const { currentSite, organisationId } = useSite();
  const { plan, trialActive, compedActive } = useOrgAccess();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [templates, setTemplates] = useState<BatchTemplate[]>([]);
  const [costRecipes, setCostRecipes] = useState<RecipeWithCost[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [stageEvents, setStageEvents] = useState<StageEvent[]>([]);
  const [stageLoading, setStageLoading] = useState(false);

  // Cost & Margin gating: only org_owner / hq_admin AND has Business add-on or Bundle (or trial/comp).
  const isCostManager = orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";
  const hasCostAccess =
    isCostManager && (plan.business || plan.bundle || trialActive || compedActive);

  // Create form state (recipe_id + quantity_produced are cost-only fields)
  const [newBatch, setNewBatch] = useState({
    product_name: '', recipe_ref: '', recipe_id: '', quantity_produced: '',
    template_id: '', notes: '',
    date_produced: format(new Date(), 'yyyy-MM-dd'), use_by_date: '',
  });
  const [creating, setCreating] = useState(false);

  // Stage completion state
  const [stageNotes, setStageNotes] = useState('');
  const [completingStage, setCompletingStage] = useState<string | null>(null);

  const siteId = currentSite?.id;

  const loadBatches = async () => {
    if (!siteId) return;
    setLoading(true);
    const query = supabase.from('batches').select('*').eq('site_id', siteId).order('created_at', { ascending: false });
    const { data } = await query;
    setBatches((data || []) as Batch[]);
    setLoading(false);
  };

  const loadTemplates = async () => {
    if (!siteId) return;
    const { data } = await supabase.from('batch_templates').select('*').eq('site_id', siteId).eq('active', true);
    setTemplates((data || []) as unknown as BatchTemplate[]);
  };

  // Load recipes (with cost breakdowns) only when the user can see Cost & Margin.
  const loadCostRecipes = async () => {
    if (!siteId || !organisationId || !hasCostAccess) {
      setCostRecipes([]);
      return;
    }
    try {
      const { recipes } = await loadCostContextForOrg(siteId, organisationId);
      setCostRecipes(recipes);
    } catch (e) {
      console.error("Failed to load recipe costs", e);
      setCostRecipes([]);
    }
  };

  useEffect(() => { loadBatches(); loadTemplates(); }, [siteId]);
  useEffect(() => { loadCostRecipes(); }, [siteId, organisationId, hasCostAccess]);

  const generateBatchCode = () => {
    const date = format(new Date(), 'yyyyMMdd');
    const seq = String(batches.length + 1).padStart(3, '0');
    const prefix = (currentSite?.name || 'SITE').substring(0, 4).toUpperCase().replace(/\s/g, '');
    return `${prefix}-${date}-${seq}`;
  };

  const handleCreate = async () => {
    if (!siteId || !organisationId || !appUser) return;
    setCreating(true);
    const batchCode = generateBatchCode();

    // If a recipe is selected and we can compute cost, snapshot it now.
    let unitCost: number | null = null;
    let totalCost: number | null = null;
    const qty = newBatch.quantity_produced ? Number(newBatch.quantity_produced) : null;
    if (hasCostAccess && newBatch.recipe_id && qty && qty > 0) {
      const calc = await calcBatchProductionCost(
        newBatch.recipe_id, qty, organisationId, siteId
      );
      if (calc) { unitCost = calc.unitCost; totalCost = calc.totalCost; }
    }

    const selectedRecipe = costRecipes.find(r => r.id === newBatch.recipe_id);

    const { error } = await supabase.from('batches').insert({
      site_id: siteId,
      organisation_id: organisationId,
      template_id: newBatch.template_id || null,
      batch_code: batchCode,
      product_name: newBatch.product_name || selectedRecipe?.name || 'Untitled',
      recipe_ref: newBatch.recipe_ref || selectedRecipe?.name || null,
      recipe_id: newBatch.recipe_id || null,
      quantity_produced: qty,
      unit_cost_snapshot: unitCost,
      total_production_cost: totalCost,
      notes: newBatch.notes || null,
      date_produced: newBatch.date_produced || null,
      use_by_date: newBatch.use_by_date || null,
      created_by_user_id: appUser.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Batch ${batchCode} created`);
    setShowCreate(false);
    setNewBatch({
      product_name: '', recipe_ref: '', recipe_id: '', quantity_produced: '',
      template_id: '', notes: '',
      date_produced: format(new Date(), 'yyyy-MM-dd'), use_by_date: '',
    });
    loadBatches();
  };

  const openBatchDetail = async (batch: Batch) => {
    setSelectedBatch(batch);
    setStageLoading(true);
    const { data } = await supabase
      .from('batch_stage_events')
      .select('*')
      .eq('batch_id', batch.id)
      .order('started_at');
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
    const updates: any = { status };
    if (status === 'complete') updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('batches').update(updates).eq('id', selectedBatch.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Batch marked as ${statusConfig[status].label}`);
    setSelectedBatch({ ...selectedBatch, ...updates });
    loadBatches();
  };

  const filteredBatches = filterStatus === 'all' ? batches : batches.filter(b => b.status === filterStatus);

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
            <p className="text-sm text-muted-foreground">Traceability & compliance</p>
          </div>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Batch
          </Button>
        )}
      </div>

      {/* Status filter tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
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

      {/* Batch list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No batches found. Create your first batch to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredBatches.map((batch, idx) => {
            const sc = statusConfig[batch.status];
            const Icon = sc.icon;
            return (
              <motion.div key={batch.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openBatchDetail(batch)}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-semibold text-sm">{batch.batch_code}</span>
                        <Badge className={`text-[10px] ${sc.color}`}>
                          <Icon className="h-3 w-3 mr-0.5" /> {sc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{batch.product_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(batch.created_at), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {hasCostAccess && costRecipes.length > 0 && (
              <div className="rounded-md border bg-primary/5 p-3 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Cost & Margin
                </div>
                <div>
                  <Label className="text-xs">Recipe (links cost data)</Label>
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
                <div>
                  <Label className="text-xs">Quantity produced</Label>
                  <Input type="number" step="1" min="0" placeholder="e.g. 24"
                    value={newBatch.quantity_produced}
                    onChange={e => setNewBatch({ ...newBatch, quantity_produced: e.target.value })} />
                </div>
                {(() => {
                  const r = costRecipes.find(x => x.id === newBatch.recipe_id);
                  const qty = Number(newBatch.quantity_produced) || 0;
                  if (!r || !qty) return null;
                  const total = r.breakdown.totalCostPerUnit * qty;
                  return (
                    <div className="text-xs text-muted-foreground">
                      Estimated total cost: <span className="font-semibold text-foreground tabular-nums">£{total.toFixed(2)}</span>
                      {' '}({qty} × £{r.breakdown.totalCostPerUnit.toFixed(3)})
                    </div>
                  );
                })()}
              </div>
            )}
            <div>
              <Label>Product Name *</Label>
              <Input placeholder="Sourdough Loaf" value={newBatch.product_name}
                onChange={e => setNewBatch({ ...newBatch, product_name: e.target.value })} />
            </div>
            <div>
              <Label>Recipe Reference</Label>
              <Input placeholder="R-001 (optional)" value={newBatch.recipe_ref}
                onChange={e => setNewBatch({ ...newBatch, recipe_ref: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Date Produced *</Label>
                <Input type="date" value={newBatch.date_produced}
                  onChange={e => setNewBatch({ ...newBatch, date_produced: e.target.value })} />
              </div>
              <div>
                <Label>Use By Date</Label>
                <Input type="date" value={newBatch.use_by_date}
                  onChange={e => setNewBatch({ ...newBatch, use_by_date: e.target.value })} />
              </div>
            </div>
            {templates.length > 0 && (
              <div>
                <Label>Template</Label>
                <Select value={newBatch.template_id} onValueChange={v => setNewBatch({ ...newBatch, template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a template (optional)" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes…" value={newBatch.notes}
                onChange={e => setNewBatch({ ...newBatch, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newBatch.product_name}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Detail Dialog */}
      <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
        <DialogContent className="max-w-lg">
          {selectedBatch && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> {selectedBatch.batch_code}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Product:</span> {selectedBatch.product_name}</div>
                  <div><span className="text-muted-foreground">Status:</span>{' '}
                    <Badge className={statusConfig[selectedBatch.status].color}>
                      {statusConfig[selectedBatch.status].label}
                    </Badge>
                  </div>
                  {selectedBatch.recipe_ref && (
                    <div><span className="text-muted-foreground">Recipe:</span> {selectedBatch.recipe_ref}</div>
                  )}
                  <div><span className="text-muted-foreground">Created:</span>{' '}
                    {format(new Date(selectedBatch.created_at), 'dd MMM yyyy HH:mm')}
                  </div>
                  {selectedBatch.date_produced && (
                    <div><span className="text-muted-foreground">Produced:</span>{' '}
                      {format(new Date(selectedBatch.date_produced), 'dd MMM yyyy')}
                    </div>
                  )}
                  {selectedBatch.use_by_date && (
                    <div><span className="text-muted-foreground">Use By:</span>{' '}
                      {format(new Date(selectedBatch.use_by_date), 'dd MMM yyyy')}
                    </div>
                  )}
                </div>

                {/* Cost & Margin snapshot — only for org_owner / hq_admin on Pro / Multi-site / trial */}
                {hasCostAccess && (selectedBatch.total_production_cost != null || selectedBatch.quantity_produced != null) && (
                  <div className="rounded-md border bg-primary/5 p-3 space-y-1.5 text-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                      Production Cost
                    </div>
                    {selectedBatch.quantity_produced != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantity produced</span>
                        <span className="tabular-nums">{Number(selectedBatch.quantity_produced)}</span>
                      </div>
                    )}
                    {selectedBatch.unit_cost_snapshot != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost per unit (snapshot)</span>
                        <span className="tabular-nums">£{Number(selectedBatch.unit_cost_snapshot).toFixed(3)}</span>
                      </div>
                    )}
                    {selectedBatch.total_production_cost != null && (
                      <div className="flex justify-between font-semibold border-t pt-1.5">
                        <span>Total production cost</span>
                        <span className="tabular-nums">£{Number(selectedBatch.total_production_cost).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedBatch.notes && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{selectedBatch.notes}</div>
                )}

                {/* Stage progression */}
                {selectedTemplate && (
                  <div className="space-y-2">
                    <h3 className="font-heading font-semibold text-sm">Stages</h3>
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
                                  {completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className={completed ? 'text-success' : ''}>{stage.name}</span>
                                </div>
                                {!completed && !isReadOnly && selectedBatch.status === 'in_progress' && (
                                  <Button
                                    size="sm" variant="outline"
                                    disabled={completingStage === stage.key}
                                    onClick={() => completeStage(stage.key, stage.name)}
                                  >
                                    {completingStage === stage.key ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : 'Complete'}
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

                {/* Status actions */}
                {!isReadOnly && selectedBatch.status === 'in_progress' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => updateBatchStatus('complete')}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-warning border-warning"
                      onClick={() => updateBatchStatus('quarantined')}>
                      <AlertTriangle className="h-3 w-3 mr-1" /> Quarantine
                    </Button>
                  </div>
                )}
                {!isReadOnly && selectedBatch.status === 'quarantined' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1"
                      onClick={() => updateBatchStatus('in_progress')}>
                      Return to Progress
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1"
                      onClick={() => updateBatchStatus('disposed')}>
                      <Ban className="h-3 w-3 mr-1" /> Dispose
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
