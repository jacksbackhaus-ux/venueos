/**
 * Lot lookup — read-only traceability view inside Batch Tracking.
 * "Which batches used lot X?" plus the reverse list shown on a batch.
 * Reads delivery_items and batch_ingredient_lots only; never edits links.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, PackageSearch, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";

interface LotRow {
  id: string;
  item_name: string;
  lot_code: string | null;
  use_by_date: string | null;
  created_at: string;
  delivery_logs: { logged_at: string; suppliers: { name: string } | null } | null;
}
interface LinkRow {
  id: string;
  batch_id: string;
  delivery_item_id: string | null;
  lot_code: string | null;
  batches: { batch_code: string; product_name: string; date_produced: string | null; status: string } | null;
}

const db = supabase.from as any;

export function LotLookupTab() {
  const { currentSite } = useSite();
  const { staffSession } = useAuth();
  const siteId = currentSite?.id || staffSession?.site_id;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LotRow | null>(null);

  const lotsQ = useQuery<LotRow[]>({
    queryKey: ["delivery-items", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await db("delivery_items")
        .select("id, item_name, lot_code, use_by_date, created_at, delivery_logs(logged_at, suppliers(name))")
        .eq("site_id", siteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const usedQ = useQuery<LinkRow[]>({
    queryKey: ["lot-batches", siteId, selected?.id],
    enabled: !!siteId && !!selected,
    queryFn: async () => {
      let q = db("batch_ingredient_lots")
        .select("id, batch_id, delivery_item_id, lot_code, batches(batch_code, product_name, date_produced, status)")
        .eq("site_id", siteId)
        .is("deleted_at", null);
      // Match by the delivered item, or by the same lot code typed without a delivery link.
      q = selected!.lot_code
        ? q.or(`delivery_item_id.eq.${selected!.id},lot_code.eq.${JSON.stringify(selected!.lot_code)}`)
        : q.eq("delivery_item_id", selected!.id);
      const { data, error } = await q;
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).filter((r: LinkRow) => !seen.has(r.batch_id) && seen.add(r.batch_id));
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const all = lotsQ.data ?? [];
    if (!s) return all.slice(0, 50);
    return all.filter((l) =>
      l.item_name.toLowerCase().includes(s) ||
      (l.lot_code ?? "").toLowerCase().includes(s) ||
      (l.delivery_logs?.suppliers?.name ?? "").toLowerCase().includes(s),
    );
  }, [lotsQ.data, search]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Search a delivered item or lot code to see which batches used it. Lots are added when logging a delivery in Suppliers.
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Item, lot code or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {lotsQ.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (lotsQ.data ?? []).length === 0 ? (
        <EmptyState icon={PackageSearch} title="No lot details yet" description="When logging a delivery, use “Add lot details” to record lot codes. They'll show here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">No matching lots.</p>}
            {filtered.map((l) => (
              <button key={l.id} onClick={() => setSelected(l)} className="w-full text-left">
                <Card className={selected?.id === l.id ? "border-primary" : ""}>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm">{l.item_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.lot_code ? `Lot ${l.lot_code}` : "No lot code"}
                      {l.use_by_date ? ` · use by ${l.use_by_date}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.delivery_logs?.suppliers?.name ?? "Unknown supplier"} · delivered {new Date(l.delivery_logs?.logged_at ?? l.created_at).toLocaleDateString("en-GB")}
                    </p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
          <div>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Pick a lot to see the batches that used it.</p>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-heading font-semibold text-sm">Batches using {selected.item_name}{selected.lot_code ? ` (lot ${selected.lot_code})` : ""}</h3>
                  {usedQ.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (usedQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No batches are linked to this lot.</p>
                  ) : (
                    <ul className="space-y-2">
                      {usedQ.data!.map((r) => (
                        <li key={r.id} className="flex items-center justify-between text-sm">
                          <span>
                            <span className="font-mono">{r.batches?.batch_code ?? "—"}</span> · {r.batches?.product_name}
                            {r.batches?.date_produced ? <span className="text-muted-foreground"> · {r.batches.date_produced}</span> : null}
                          </span>
                          {r.batches?.status && <Badge variant="outline" className="text-[10px]">{r.batches.status.replace("_", " ")}</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Reverse view on a batch: which delivered lots went into it. */
export function BatchLotsUsed({ batchId }: { batchId: string }) {
  const q = useQuery<any[]>({
    queryKey: ["batch-lots", batchId],
    queryFn: async () => {
      const { data, error } = await db("batch_ingredient_lots")
        .select("id, lot_code, quantity_used, unit, delivery_items(item_name, lot_code, use_by_date, delivery_logs(logged_at, suppliers(name))), ingredients(name)")
        .eq("batch_id", batchId)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!q.data || q.data.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ingredient lots used</h4>
      <ul className="space-y-1">
        {q.data.map((r) => {
          const di = r.delivery_items;
          const name = di?.item_name ?? r.ingredients?.name ?? "Ingredient";
          const lot = di?.lot_code ?? r.lot_code;
          return (
            <li key={r.id} className="text-sm">
              {name}{lot ? <span className="font-mono"> · lot {lot}</span> : null}
              <span className="text-muted-foreground">
                {di?.use_by_date ? ` · use by ${di.use_by_date}` : ""}
                {di?.delivery_logs?.suppliers?.name ? ` · ${di.delivery_logs.suppliers.name}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
