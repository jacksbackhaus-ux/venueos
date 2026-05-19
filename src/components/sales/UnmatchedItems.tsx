// Groups unmatched sales rows by product_name_raw and lets manager link them to a recipe,
// create a new recipe, or ignore them. Linking updates ALL matching rows for the site.

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Plus, EyeOff, Search } from "lucide-react";
import { toast } from "sonner";

interface Props { siteId: string; orgId: string }

interface Grouped {
  product_name_raw: string;
  units: number;
  net: number;
}

export function UnmatchedItems({ siteId, orgId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Grouped | null>(null);

  const q = useQuery({
    queryKey: ["unmatched-sales", siteId],
    queryFn: async (): Promise<Grouped[]> => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("sales_line_items")
        .select("product_name_raw, quantity, net_sales")
        .eq("site_id", siteId)
        .is("linked_product_id", null)
        .eq("ignored", false)
        .gte("sale_date", since)
        .limit(2000);
      if (error) throw error;
      const m = new Map<string, Grouped>();
      for (const r of (data || []) as any[]) {
        const k = r.product_name_raw;
        const g = m.get(k) || { product_name_raw: k, units: 0, net: 0 };
        g.units += Number(r.quantity) || 0;
        g.net += Number(r.net_sales) || 0;
        m.set(k, g);
      }
      return [...m.values()].sort((a, b) => b.net - a.net);
    },
  });

  const visible = useMemo(() => {
    const items = q.data || [];
    if (!search.trim()) return items.slice(0, 50);
    const s = search.toLowerCase();
    return items.filter((i) => i.product_name_raw.toLowerCase().includes(s)).slice(0, 50);
  }, [q.data, search]);

  if (q.isLoading) return null;
  if (!q.data?.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Unmatched items</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground text-center py-6">
          Nothing to reconcile. 🎉
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Unmatched items</span>
            <span className="text-xs text-muted-foreground font-normal">{q.data.length} total</span>
          </CardTitle>
          <CardDescription>Link these to recipes to unlock weighted margin analytics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
          {visible.map((g) => (
            <div key={g.product_name_raw} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{g.product_name_raw}</div>
                <div className="text-[11px] text-muted-foreground">{g.units.toFixed(0)} units · £{g.net.toFixed(2)} (90d)</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActive(g)}>
                <Link2 className="h-3 w-3 mr-1" />Reconcile
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {active && (
        <ReconcileDrawer
          item={active}
          siteId={siteId}
          orgId={orgId}
          onClose={() => setActive(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["unmatched-sales", siteId] });
            qc.invalidateQueries({ queryKey: ["profit-dashboard", siteId] });
            setActive(null);
          }}
        />
      )}
    </>
  );
}

function ReconcileDrawer({ item, siteId, orgId, onClose, onDone }: {
  item: Grouped; siteId: string; orgId: string; onClose: () => void; onDone: () => void;
}) {
  const [recipeId, setRecipeId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [busy, setBusy] = useState(false);

  const recipes = useQuery({
    queryKey: ["recipes-for-reconcile", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, name, recipe_type, sale_price")
        .eq("site_id", siteId)
        .eq("active", true)
        .neq("recipe_type", "prep_batch")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const link = async (rid: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("sales_line_items")
        .update({ linked_product_id: rid })
        .eq("site_id", siteId)
        .eq("product_name_raw", item.product_name_raw)
        .is("linked_product_id", null);
      if (error) throw error;
      toast.success("Linked");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const matchExisting = async () => {
    if (!recipeId) return;
    await link(recipeId);
  };

  const createAndLink = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("recipes").insert({
        site_id: siteId, organisation_id: orgId,
        name: newName.trim(), recipe_type: "menu_item", portions: 1,
        sale_price: newPrice ? Number(newPrice) : null,
        sale_price_vat_rate_percent: 20, target_gp_percent: 60,
      }).select("id").single();
      if (error) throw error;
      await link(data.id);
    } catch (e: any) { toast.error(e.message); setBusy(false); }
  };

  const ignore = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("sales_line_items")
        .update({ ignored: true })
        .eq("site_id", siteId)
        .eq("product_name_raw", item.product_name_raw);
      if (error) throw error;
      toast.success("Ignored");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{item.product_name_raw}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            {item.units.toFixed(0)} units · £{item.net.toFixed(2)} over last 90d
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
              Match existing
            </Button>
            <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
              Create new
            </Button>
          </div>

          {mode === "existing" && (
            <div className="space-y-2">
              <Select value={recipeId} onValueChange={setRecipeId}>
                <SelectTrigger><SelectValue placeholder="Pick a menu item" /></SelectTrigger>
                <SelectContent>
                  {recipes.data?.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}{r.sale_price ? ` — £${Number(r.sale_price).toFixed(2)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={matchExisting} disabled={!recipeId || busy} className="w-full">
                <Link2 className="h-4 w-4 mr-1" />Match & link all rows
              </Button>
            </div>
          )}

          {mode === "new" && (
            <div className="space-y-2">
              <Input placeholder="New menu item name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Sale price (optional)" type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
              <Button onClick={createAndLink} disabled={!newName.trim() || busy} className="w-full">
                <Plus className="h-4 w-4 mr-1" />Create & link
              </Button>
            </div>
          )}

          <div className="pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={ignore} disabled={busy} className="text-muted-foreground w-full">
              <EyeOff className="h-3 w-3 mr-1" />Ignore this product
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
