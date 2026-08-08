/**
 * Product withdrawal & recall — a tab inside Batch Tracking (Batch &
 * Traceability). Not a new module.
 *
 * Where an ingredient is flagged, the operator multi-selects the affected
 * batches so the paper trail is complete.
 */

import { useState } from "react";
import { AlertOctagon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { useRecalls } from "@/hooks/useSfbb";
import { RECALL_REASONS, RECALL_SOURCES } from "@/lib/sfbb";

export interface RecallBatchOption { id: string; label: string }

export function RecallDialog({
  open, onOpenChange, batchOptions, prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  batchOptions: RecallBatchOption[];
  prefill?: { item_type: "batch" | "ingredient" | "product"; item_ref: string; batchId?: string };
}) {
  const { create } = useRecalls();
  const [itemType, setItemType] = useState<"batch" | "ingredient" | "product">(prefill?.item_type ?? "batch");
  const [itemRef, setItemRef] = useState(prefill?.item_ref ?? "");
  const [reason, setReason] = useState<string>(RECALL_REASONS[0]);
  const [source, setSource] = useState<string>(RECALL_SOURCES[0]);
  const [selected, setSelected] = useState<string[]>(prefill?.batchId ? [prefill.batchId] : []);
  const [action, setAction] = useState("");
  const [informed, setInformed] = useState(false);

  async function submit() {
    if (!itemRef.trim()) return;
    try {
      await create.mutateAsync({
        item_type: itemType,
        item_ref: itemRef,
        reason,
        source,
        affected_batch_ids: selected,
        action_taken: action,
        customers_informed: informed,
      });
      toast.success("Withdrawal recorded.");
      onOpenChange(false);
      setItemRef(""); setSelected([]); setAction(""); setInformed(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the record.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Flag for withdrawal or recall</DialogTitle>
          <DialogDescription>
            Record what was affected, why, and what you did. This becomes evidence in your Inspection Pack.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">What is affected?</Label>
              <Select value={itemType} onValueChange={(v) => setItemType(v as typeof itemType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch">Batch</SelectItem>
                  <SelectItem value="ingredient">Ingredient</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name or reference</Label>
              <Input value={itemRef} onChange={(e) => setItemRef(e.target.value)} placeholder="e.g. Flour lot 4471" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECALL_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Who told you?</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECALL_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {batchOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Affected batches</Label>
              <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
                {batchOptions.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selected.includes(b.id)}
                      onCheckedChange={(c) =>
                        setSelected((prev) => c ? [...prev, b.id] : prev.filter((x) => x !== b.id))
                      }
                    />
                    <span className="truncate">{b.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Action taken</Label>
            <Textarea value={action} onChange={(e) => setAction(e.target.value)} className="text-sm"
              placeholder="e.g. Stock quarantined and disposed, supplier notified" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={informed} onCheckedChange={(c) => setInformed(!!c)} />
            Customers were informed
          </label>

          <Button className="w-full" disabled={!itemRef.trim() || create.isPending} onClick={submit}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Record withdrawal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RecallsTab({
  batchOptions, readOnly,
}: { batchOptions: RecallBatchOption[]; readOnly?: boolean }) {
  const { recalls, isLoading } = useRecalls();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-primary" /> Withdrawals & recalls
            </CardTitle>
            {recalls.length > 0 && <Badge variant="outline">{recalls.length}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            If something unsafe has gone out, record it here. Inspectors look for evidence you can
            trace and withdraw product quickly.
          </p>
          {!readOnly && <Button size="sm" onClick={() => setOpen(true)}>Flag for withdrawal</Button>}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : recalls.length === 0 ? (
        <EmptyState
          icon={<AlertOctagon className="h-6 w-6" />}
          title="No withdrawals recorded"
          description="Nothing here is a good sign. Use this if a supplier alert or your own check means product must come back."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {recalls.map((r) => (
                <li key={r.id} className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">{r.item_ref}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{r.item_type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.reason}{r.source ? ` · ${r.source}` : ""} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                    {r.affected_batch_ids?.length ? ` · ${r.affected_batch_ids.length} batch(es)` : ""}
                    {r.customers_informed ? " · customers informed" : ""}
                  </p>
                  {r.action_taken && <p className="text-xs text-foreground/80">{r.action_taken}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <RecallDialog open={open} onOpenChange={setOpen} batchOptions={batchOptions} />
    </div>
  );
}
