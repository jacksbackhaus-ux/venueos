import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, MapPin, CheckCircle2, AlertTriangle, ExternalLink, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";

interface SiteOverview {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  open_batches: number;
  quarantined_batches: number;
}

export default function HQDashboard() {
  const { orgRole, appUser } = useAuth();
  const { setCurrentSiteId } = useSite();
  const navigate = useNavigate();
  const [sites, setSites] = useState<SiteOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    const load = async () => {
      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, name, address, active')
        .order('name');

      const siteOverviews: SiteOverview[] = [];
      for (const site of sitesData || []) {
        const { count: openBatches } = await supabase
          .from('batches')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', site.id)
          .eq('status', 'in_progress');

        const { count: quarantinedBatches } = await supabase
          .from('batches')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', site.id)
          .eq('status', 'quarantined');

        siteOverviews.push({
          ...site,
          open_batches: openBatches || 0,
          quarantined_batches: quarantinedBatches || 0,
        });
      }
      setSites(siteOverviews);
      setLoading(false);
    };
    load();
  }, [appUser]);

  const switchToSite = (siteId: string) => {
    setCurrentSiteId(siteId);
    navigate('/');
  };

  const viewSiteReports = (siteId: string) => {
    setCurrentSiteId(siteId);
    navigate('/reports');
  };

  if (!orgRole || !['org_owner', 'hq_admin', 'hq_auditor'].includes(orgRole.org_role)) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="font-heading font-bold text-lg">Access Denied</h2>
        <p className="text-sm text-muted-foreground">You need HQ-level permissions to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">HQ Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Organisation overview • {orgRole.org_role === 'hq_auditor' ? 'Read-only access' : 'Full access'}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-heading font-bold">{sites.filter(s => s.active).length}</p>
            <p className="text-xs text-muted-foreground">Active Sites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-heading font-bold text-warning">
              {sites.reduce((s, site) => s + site.open_batches, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Open Batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-heading font-bold text-breach">
              {sites.reduce((s, site) => s + site.quarantined_batches, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Quarantined</p>
          </CardContent>
        </Card>
      </div>

      {/* Sites list */}
      <div className="space-y-3">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground">All Sites</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading sites…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sites found.</p>
        ) : (
          sites.map((site, idx) => (
            <motion.div key={site.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-semibold text-sm">{site.name}</h3>
                        <Badge variant={site.active ? "default" : "secondary"} className="text-[10px]">
                          {site.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {site.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {site.address}
                        </p>
                      )}
                      <div className="flex gap-3 mt-2">
                        {site.open_batches > 0 && (
                          <span className="text-xs text-warning flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {site.open_batches} open batches
                          </span>
                        )}
                        {site.quarantined_batches > 0 && (
                          <span className="text-xs text-breach flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {site.quarantined_batches} quarantined
                          </span>
                        )}
                        {site.open_batches === 0 && site.quarantined_batches === 0 && (
                          <span className="text-xs text-success flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> All clear
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => viewSiteReports(site.id)}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Reports
                      </Button>
                      <Button size="sm" onClick={() => switchToSite(site.id)}>
                        Open Site
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
