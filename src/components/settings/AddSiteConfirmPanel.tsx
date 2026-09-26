import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Store, Home, Truck, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PREMISES_TYPES, type PremisesType } from "@/lib/premises";

interface Preview {
  amount_due_now: number;
  currency: string;
  proration_date: number;
  current_sites: number;
  new_sites: number;
  per_site_amount: number;
  interval: string;
  period_end: number | null;
  trialing: boolean;
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("add-haccp-site", { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const b = await ctx.json();
        if (b?.error) msg = b.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg || "Something went wrong.");
  }
  return data;
}

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

/**
 * Add ONE permanent paid site to the existing subscription. Shows the exact
 * prorated amount from Stripe first; the site is created only after the
 * charge succeeds (server-side, add-haccp-site).
 */
export function AddSiteConfirmPanel({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [premisesType, setPremisesType] = useState<PremisesType>("commercial");
  const [submitting, setSubmitting] = useState(false);
  // One id per confirm attempt — stops a double click charging twice.
  const requestId = useMemo(() => crypto.randomUUID(), [preview?.proration_date]);

  const loadPreview = async () => {
    setLoadingPreview(true);
    setError(null);
    try {
      setPreview(await invoke({ action: "preview" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  };
  useEffect(() => { loadPreview(); }, []);

  const confirmAdd = async () => {
    if (!preview) return;
    if (!name.trim()) { setError("Please enter a name for the new site."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await invoke({
        action: "confirm",
        request_id: requestId,
        proration_date: preview.proration_date,
        name: name.trim(),
        address: address.trim(),
        premises_type: premisesType,
      });
      if (res?.site_created === false) {
        setError(res.message);
        setSubmitting(false);
        return;
      }
      onDone();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (msg.includes("expired")) await loadPreview();
      setSubmitting(false);
    }
  };

  const per = preview?.interval === "year" ? "year" : "month";

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="add-site-name">New site name</Label>
          <Input id="add-site-name" placeholder="e.g. Mill Lane" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-site-address">Address (optional)</Label>
          <Input id="add-site-address" placeholder="Street, city, postcode" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>What kind of place is it?</Label>
          <div className="grid grid-cols-2 gap-2">
            {PREMISES_TYPES.map((p) => {
              const Icon = p.icon === "Home" ? Home : p.icon === "Truck" ? Truck : p.icon === "Factory" ? Factory : Store;
              const active = premisesType === p.type;
              return (
                <button key={p.type} type="button" onClick={() => setPremisesType(p.type)}
                  className={`rounded-lg border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <Icon className={`h-4 w-4 mb-1.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-xs font-semibold leading-tight">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{p.examples}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
        {loadingPreview ? (
          <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working out the price…</p>
        ) : preview ? (
          <>
            <p>
              <span className="font-semibold">{money(preview.amount_due_now, preview.currency)}</span> will be charged now to the card on file
              {preview.period_end ? ` (covers the rest of this billing period, to ${format(new Date(preview.period_end * 1000), "d MMM yyyy")})` : ""}.
            </p>
            <p className="text-muted-foreground">
              After that you'll pay for {preview.new_sites} sites at {money(preview.per_site_amount, preview.currency)}/{per} each (was {preview.current_sites}).
              {preview.trialing && " You're on your free trial, so nothing is charged until it ends."}
            </p>
            <p className="text-xs text-muted-foreground">If the payment doesn't go through, no site is added and you aren't charged.</p>
          </>
        ) : null}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={confirmAdd} disabled={!preview || submitting || loadingPreview}>
          {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {preview ? `Confirm — pay ${money(preview.amount_due_now, preview.currency)} and add site` : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
