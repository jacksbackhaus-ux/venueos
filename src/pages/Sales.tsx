// Sales Hub — Business + Intelligence tiers, manager/org_owner only.
// Lets managers import POS exports, reconcile unmatched products to recipes,
// and (Intelligence only) generate AI sales insights.

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Upload, Lock, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { ImportWizard } from "@/components/sales/ImportWizard";
import { UnmatchedItems } from "@/components/sales/UnmatchedItems";
import { SalesInsightsCard } from "@/components/sales/SalesInsightsCard";
import { format } from "date-fns";

export default function Sales() {
  const { appUser, orgRole } = useAuth();
  const { currentSite } = useSite();
  const { tier } = useOrgAccess();
  const { isActive } = useModuleAccess();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const orgId = appUser?.organisation_id || null;
  const siteId = currentSite?.id || null;
  const isManager = orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";
  const tierOk = tier === "business_tier" || tier === "intelligence";
  const intelligence = tier === "intelligence" && isActive("ai_insights");

  const imports = useQuery({
    queryKey: ["sales-imports", siteId],
    enabled: !!siteId && isManager && tierOk,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_imports")
        .select("id, source_system, file_name, status, uploaded_at, imported_at, row_count, error")
        .eq("site_id", siteId!)
        .order("uploaded_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  if (!isManager) return <Navigate to="/" replace />;

  if (!tierOk) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Sales Hub is on Business</h2>
            <p className="text-sm text-muted-foreground">
              Upgrade to Business or Intelligence to import POS data and unlock weighted profit analytics.
            </p>
            <Button asChild><a href="/pricing">View plans</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Sales Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import POS exports, reconcile to recipes, and unlock weighted profit analytics.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Upload className="h-4 w-4 mr-1" /> Import Sales
        </Button>
      </div>

      {intelligence && siteId && <SalesInsightsCard siteId={siteId} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent imports</CardTitle>
          <CardDescription>Latest 10 uploads for this site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {imports.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {imports.data?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No imports yet.</p>
          )}
          {imports.data?.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{i.file_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {i.source_system} · {format(new Date(i.uploaded_at), "dd MMM HH:mm")}
                  {i.row_count ? ` · ${i.row_count} rows` : ""}
                </div>
                {i.error && <div className="text-xs text-destructive truncate">{i.error}</div>}
              </div>
              {i.status === "imported" && (
                <Badge variant="outline" className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3 text-success" />Imported</Badge>
              )}
              {i.status === "failed" && (
                <Badge variant="destructive" className="gap-1 text-xs"><AlertCircle className="h-3 w-3" />Failed</Badge>
              )}
              {(i.status === "uploaded" || i.status === "mapped") && (
                <Badge variant="secondary" className="text-xs">{i.status}</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {siteId && orgId && <UnmatchedItems siteId={siteId} orgId={orgId} />}

      {wizardOpen && siteId && orgId && (
        <ImportWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          siteId={siteId}
          orgId={orgId}
          intelligence={intelligence}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ["sales-imports", siteId] });
            qc.invalidateQueries({ queryKey: ["unmatched-sales", siteId] });
            qc.invalidateQueries({ queryKey: ["profit-dashboard", siteId] });
          }}
        />
      )}
    </div>
  );
}
