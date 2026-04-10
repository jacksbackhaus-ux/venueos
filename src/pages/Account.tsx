import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Building2, Users, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SiteInfo { id: string; name: string; active: boolean; }
interface HQUser { id: string; display_name: string; org_role: string; }

export default function Account() {
  const { orgRole, appUser } = useAuth();
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [hqUsers, setHqUsers] = useState<HQUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    const load = async () => {
      const [sitesRes, orgUsersRes] = await Promise.all([
        supabase.from('sites').select('id, name, active'),
        supabase.from('org_users').select('id, user_id, org_role, active').eq('active', true),
      ]);

      setSites((sitesRes.data || []) as SiteInfo[]);

      // Fetch display names for HQ users (admin + auditor only)
      const hqOrgUsers = (orgUsersRes.data || []).filter(
        (ou: any) => ou.org_role === 'hq_admin' || ou.org_role === 'hq_auditor'
      );
      const hqUserDetails: HQUser[] = [];
      for (const ou of hqOrgUsers) {
        const { data: userData } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', ou.user_id)
          .maybeSingle();
        if (userData) {
          hqUserDetails.push({ id: ou.id, display_name: userData.display_name, org_role: ou.org_role });
        }
      }
      setHqUsers(hqUserDetails);
      setLoading(false);
    };
    load();
  }, [appUser]);

  if (orgRole?.org_role !== 'org_owner') {
    return (
      <div className="p-6 text-center">
        <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="font-heading font-bold text-lg">Access Denied</h2>
        <p className="text-sm text-muted-foreground">Only the organisation owner can view billing.</p>
      </div>
    );
  }

  const activeSites = sites.filter(s => s.active).length;
  const hqUserCount = hqUsers.length;
  const baseCost = 4.99;
  const additionalSitesCost = 2.0 * Math.max(0, activeSites - 1);
  const hqLoginsCost = 1.0 * hqUserCount;
  const monthlyTotal = baseCost + additionalSitesCost + hqLoginsCost;

  const roleLabel = (r: string) => r === 'hq_admin' ? 'HQ Admin' : 'HQ Auditor';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Account & Billing</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription</p>
        </div>
      </div>

      {/* Monthly total */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground mb-1">Monthly Total</p>
            <p className="text-4xl font-heading font-bold text-foreground">
              £{monthlyTotal.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">per month (excl. VAT)</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Base plan (includes 1 site)</span>
            <span className="font-medium">£4.99</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Additional sites: £2 × {Math.max(0, activeSites - 1)}</span>
            <span className="font-medium">£{additionalSitesCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>HQ logins: £1 × {hqUserCount}</span>
            <span className="font-medium">£{hqLoginsCost.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span>£{monthlyTotal.toFixed(2)}/month</span>
          </div>
        </CardContent>
      </Card>

      {/* Active Sites */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Active Sites ({activeSites})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              {sites.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <Badge variant={s.active ? "default" : "secondary"} className="text-[10px]">
                    {s.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* HQ Users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Users className="h-4 w-4" /> HQ Users ({hqUserCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hqUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No HQ admin or auditor users. Staff logins are unlimited and free.</p>
          ) : (
            <div className="space-y-2">
              {hqUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <span>{u.display_name}</span>
                  <Badge variant="outline" className="text-[10px]">{roleLabel(u.org_role)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments placeholder */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-heading font-semibold text-sm">Payments coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">
            Stripe integration will be added for automatic billing and invoice management.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
