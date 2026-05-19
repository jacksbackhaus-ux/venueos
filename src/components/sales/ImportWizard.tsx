// Multi-step import wizard: choose source → upload → mapping → preview → import.
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, FileSpreadsheet, Upload, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseSalesFile, applyMapping, MAPPING_FIELDS, type SalesMapping } from "@/lib/salesParse";
import { loadSiteTaxSettings } from "@/lib/vat";

type SourceSystem = "shopify" | "square" | "sumup" | "csv";
type Step = 1 | 2 | 3 | 4 | 5;

interface Props {
  open: boolean;
  onClose: () => void;
  siteId: string;
  orgId: string;
  intelligence: boolean;
  onImported: () => void;
}

const DEFAULT_MAPPING: SalesMapping = {
  sale_date: null, sale_timestamp: null, product_name: "", sku: null,
  quantity: "", gross_sales: null, discounts: null, net_sales: "", channel: null,
};

export function ImportWizard({ open, onClose, siteId, orgId, intelligence, onImported }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<SourceSystem>("csv");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, any>[] } | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<SalesMapping>(DEFAULT_MAPPING);
  const [busy, setBusy] = useState(false);
  const [valuesIncludeVat, setValuesIncludeVat] = useState<boolean>(true);
  const [vatActive, setVatActive] = useState(false);

  // Load site VAT default to pre-fill the toggle.
  useEffect(() => {
    if (!open || !siteId) return;
    loadSiteTaxSettings(siteId).then((s) => {
      setVatActive(s.vat_enabled);
      setValuesIncludeVat(s.sales_values_include_vat);
    });
  }, [open, siteId]);

  const reset = () => {
    setStep(1); setSource("csv"); setFile(null); setParsed(null);
    setImportId(null); setMapping(DEFAULT_MAPPING); setBusy(false);
  };

  const close = () => { reset(); onClose(); };

  // STEP 2 → upload + parse + load existing mapping if present
  const onFileChosen = async (f: File) => {
    setFile(f); setBusy(true);
    try {
      const p = await parseSalesFile(f);
      if (!p.rows.length) { toast.error("Empty file"); return; }
      setParsed(p);

      // Upload to storage
      const ts = Date.now();
      const path = `${orgId}/${siteId}/${ts}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("sales-imports").upload(path, f);
      if (upErr) throw upErr;

      const { data: imp, error: impErr } = await supabase
        .from("sales_imports")
        .insert({
          organisation_id: orgId, site_id: siteId, source_system: source,
          file_name: f.name, storage_path: path, status: "uploaded",
        })
        .select("id").single();
      if (impErr) throw impErr;
      setImportId(imp.id);

      // Pre-fill mapping from saved template
      const { data: tpl } = await supabase
        .from("sales_mappings")
        .select("mapping_json")
        .eq("organisation_id", orgId)
        .eq("source_system", source)
        .maybeSingle();
      if (tpl?.mapping_json) setMapping({ ...DEFAULT_MAPPING, ...(tpl.mapping_json as any) });

      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setBusy(false); }
  };

  const runAiMapping = async () => {
    if (!parsed || !importId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-sales-mapping", {
        body: { import_id: importId, headers: parsed.headers, sample_rows: parsed.rows.slice(0, 20) },
      });
      if (error) throw error;
      if (data?.mapping) {
        setMapping({ ...DEFAULT_MAPPING, ...data.mapping });
        toast.success("AI mapping suggested — review and confirm");
      }
    } catch (e: any) {
      toast.error(e.message || "AI mapping failed");
    } finally { setBusy(false); }
  };

  const setField = (k: keyof SalesMapping, v: string) =>
    setMapping((m) => ({ ...m, [k]: v === "__none__" ? null : v }));

  const mappingValid = mapping.product_name && mapping.quantity && mapping.net_sales;

  // STEP 5 — import
  const doImport = async () => {
    if (!parsed || !importId) return;
    setBusy(true);
    try {
      // Save mapping template
      await supabase.from("sales_mappings").upsert([{
        organisation_id: orgId, source_system: source, mapping_json: mapping as any,
      }], { onConflict: "organisation_id,source_system" });

      const transformed = applyMapping(parsed.rows, mapping);

      // Pull existing matches so newly-imported rows auto-link
      const names = [...new Set(transformed.map((r) => r.product_name_raw))];
      const { data: existing } = await supabase
        .from("sales_line_items")
        .select("product_name_raw, linked_product_id")
        .eq("site_id", siteId)
        .not("linked_product_id", "is", null)
        .in("product_name_raw", names);
      const matchMap = new Map<string, string>();
      (existing || []).forEach((r: any) => {
        if (r.linked_product_id) matchMap.set(r.product_name_raw, r.linked_product_id);
      });

      const payload = transformed.map((r) => ({
        ...r, organisation_id: orgId, site_id: siteId,
        import_id: importId, source_system: source,
        linked_product_id: matchMap.get(r.product_name_raw) || null,
      }));

      // Insert in chunks of 500
      for (let i = 0; i < payload.length; i += 500) {
        const slice = payload.slice(i, i + 500);
        const { error } = await supabase.from("sales_line_items").insert(slice);
        if (error) throw error;
      }

      await supabase.from("sales_imports").update({
        status: "imported", imported_at: new Date().toISOString(),
        row_count: payload.length,
      }).eq("id", importId);

      toast.success(`Imported ${payload.length} rows`);
      onImported(); close();
    } catch (e: any) {
      await supabase.from("sales_imports").update({ status: "failed", error: e.message }).eq("id", importId);
      toast.error(e.message || "Import failed");
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Import sales</SheetTitle>
          <SheetDescription>Step {step} of 5</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <Label>Source system</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["shopify", "square", "sumup", "csv"] as SourceSystem[]).map((s) => (
                  <button key={s} onClick={() => setSource(s)}
                    className={`rounded-md border p-3 text-left text-sm ${source === s ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="font-medium capitalize">{s === "csv" ? "Generic CSV" : s}</div>
                    <div className="text-[11px] text-muted-foreground">.csv or .xlsx</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label>Upload file</Label>
              <Input type="file" accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && onFileChosen(e.target.files[0])} />
              {busy && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Parsing…</p>}
            </div>
          )}

          {step === 3 && parsed && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{parsed.rows.length} rows · {parsed.headers.length} columns</p>
                {intelligence && (
                  <Button size="sm" variant="outline" onClick={runAiMapping} disabled={busy}>
                    <Sparkles className="h-4 w-4 mr-1" />{busy ? "Thinking…" : "AI auto-map"}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {MAPPING_FIELDS.map((f) => (
                  <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                    <Label className="text-sm">
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                    </Label>
                    <Select value={mapping[f.key] || "__none__"} onValueChange={(v) => setField(f.key, v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— none —</SelectItem>
                        {parsed.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button disabled={!mappingValid} onClick={() => setStep(4)}>Preview <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 4 && parsed && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">First 10 mapped rows</p>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Date</th>
                      <th className="px-2 py-1 text-left">Product</th>
                      <th className="px-2 py-1 text-right">Qty</th>
                      <th className="px-2 py-1 text-right">Net £</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applyMapping(parsed.rows.slice(0, 10), mapping).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.sale_date}</td>
                        <td className="px-2 py-1 truncate max-w-[180px]">{r.product_name_raw}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.quantity}</td>
                        <td className="px-2 py-1 text-right tabular-nums">£{r.net_sales.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                <Button onClick={() => setStep(5)}>Looks good <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 text-center py-6">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
              <p className="text-sm">Ready to import <Badge variant="secondary">{parsed?.rows.length || 0} rows</Badge></p>
              <Button onClick={doImport} disabled={busy} size="lg">
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</> : <><Check className="h-4 w-4 mr-2" />Import now</>}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
