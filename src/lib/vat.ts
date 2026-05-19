// VAT helpers — GBP only, overlay on top of True Margin Engine.
// All functions are pure and safe when VAT is disabled or fields are missing.

import { supabase } from "@/integrations/supabase/client";

export interface TaxSettings {
  vat_enabled: boolean;
  vat_registered: boolean;
  default_vat_rate: number;
  sales_values_include_vat: boolean;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  vat_enabled: false,
  vat_registered: false,
  default_vat_rate: 20,
  sales_values_include_vat: true,
};

export async function loadSiteTaxSettings(siteId: string | null): Promise<TaxSettings> {
  if (!siteId) return DEFAULT_TAX_SETTINGS;
  const { data } = await supabase
    .from("site_tax_settings")
    .select("vat_enabled, vat_registered, default_vat_rate, sales_values_include_vat")
    .eq("site_id", siteId)
    .maybeSingle();
  if (!data) return DEFAULT_TAX_SETTINGS;
  return {
    vat_enabled: !!data.vat_enabled,
    vat_registered: !!data.vat_registered,
    default_vat_rate: Number(data.default_vat_rate) || 20,
    sales_values_include_vat: data.sales_values_include_vat !== false,
  };
}

/** Split a gross amount into { net, vat } at the given rate. */
export function splitGross(gross: number, ratePct: number): { net: number; vat: number } {
  const g = Number(gross) || 0;
  const r = Math.max(Number(ratePct) || 0, 0);
  if (r === 0) return { net: g, vat: 0 };
  const net = g / (1 + r / 100);
  return { net, vat: g - net };
}

/** Add VAT to a net amount. */
export function addVat(net: number, ratePct: number): { gross: number; vat: number } {
  const n = Number(net) || 0;
  const r = Math.max(Number(ratePct) || 0, 0);
  const vat = n * (r / 100);
  return { gross: n + vat, vat };
}

export interface VatPrice {
  gross: number;
  net: number;
  vat: number;
  ratePct: number;
}

/**
 * Resolve gross/net/vat for a stored price.
 * UK default: catalog prices stored as GROSS. If VAT is off or business is not
 * registered, gross == net and vat = 0.
 */
export function resolvePrice(opts: {
  storedPrice: number;
  storedAsGross?: boolean;
  ratePct: number;
  vatActive: boolean;
}): VatPrice {
  const stored = Number(opts.storedPrice) || 0;
  if (!opts.vatActive || opts.ratePct <= 0) {
    return { gross: stored, net: stored, vat: 0, ratePct: opts.ratePct || 0 };
  }
  if (opts.storedAsGross !== false) {
    const { net, vat } = splitGross(stored, opts.ratePct);
    return { gross: stored, net, vat, ratePct: opts.ratePct };
  }
  const { gross, vat } = addVat(stored, opts.ratePct);
  return { gross, net: stored, vat, ratePct: opts.ratePct };
}

/** VAT overlay is only meaningful when both enabled AND registered. */
export function vatActive(s: TaxSettings | null | undefined): boolean {
  return !!(s?.vat_enabled && s?.vat_registered);
}
