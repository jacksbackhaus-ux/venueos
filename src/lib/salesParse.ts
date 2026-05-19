// Client-side CSV/XLSX parser for sales import wizard.
import * as XLSX from "xlsx";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, any>[];
}

export async function parseSalesFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false }) as Record<string, any>[];
  if (!json.length) return { headers: [], rows: [] };
  const headers = Object.keys(json[0]);
  return { headers, rows: json };
}

export interface SalesMapping {
  sale_date: string | null;
  sale_timestamp: string | null;
  product_name: string;
  sku: string | null;
  quantity: string;
  gross_sales: string | null;
  discounts: string | null;
  net_sales: string;
  channel: string | null;
}

export const MAPPING_FIELDS: { key: keyof SalesMapping; label: string; required: boolean }[] = [
  { key: "sale_date", label: "Sale date", required: false },
  { key: "sale_timestamp", label: "Sale timestamp", required: false },
  { key: "product_name", label: "Product name", required: true },
  { key: "sku", label: "SKU", required: false },
  { key: "quantity", label: "Quantity", required: true },
  { key: "gross_sales", label: "Gross sales", required: false },
  { key: "discounts", label: "Discounts", required: false },
  { key: "net_sales", label: "Net sales", required: true },
  { key: "channel", label: "Channel", required: false },
];

function toNum(v: any): number {
  if (v == null) return 0;
  const s = String(v).replace(/[£$€,\s]/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function toDate(v: any): string | null {
  if (!v) return null;
  // Try ISO / parseable
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // Try DD/MM/YYYY
  const m = String(v).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function applyMapping(rows: Record<string, any>[], mapping: SalesMapping) {
  return rows.map((r) => {
    const gross = mapping.gross_sales ? toNum(r[mapping.gross_sales]) : 0;
    const disc = mapping.discounts ? toNum(r[mapping.discounts]) : 0;
    let net = mapping.net_sales ? toNum(r[mapping.net_sales]) : 0;
    if (!net && gross) net = gross - disc;
    const ts = mapping.sale_timestamp ? r[mapping.sale_timestamp] : null;
    const date = toDate(mapping.sale_date ? r[mapping.sale_date] : ts) || new Date().toISOString().slice(0, 10);
    const tsIso = ts ? (new Date(ts).toString() !== "Invalid Date" ? new Date(ts).toISOString() : null) : null;
    return {
      sale_date: date,
      sale_timestamp: tsIso,
      product_name_raw: String(r[mapping.product_name] ?? "").trim() || "(unknown)",
      sku: mapping.sku ? (r[mapping.sku] ? String(r[mapping.sku]).trim() : null) : null,
      quantity: mapping.quantity ? toNum(r[mapping.quantity]) || 1 : 1,
      gross_sales: gross,
      discounts: disc,
      net_sales: net,
      channel: mapping.channel ? (r[mapping.channel] ? String(r[mapping.channel]) : null) : null,
    };
  });
}
