import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Building2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Runs after a user signs up or logs in without a profile.
 * - If `signup_pending` metadata exists, runs handle_signup automatically.
 * - Otherwise, shows a manual setup form so the user can finish onboarding.
 */
export default function Onboarding() {
  const { user, refreshAppUser, signOut, appUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [autoRunning, setAutoRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsManual, setNeedsManual] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    orgName: "",
    siteName: "",
    siteAddress: "",
  });

  // If already has a profile, bounce to dashboard
  useEffect(() => {
    if (!isLoading && appUser) {
      navigate("/", { replace: true });
    }
  }, [appUser, isLoading, navigate]);

  // If no auth user, bounce to /auth
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Try auto-setup from signup metadata
  useEffect(() => {
    if (!user || appUser || autoRunning || needsManual) return;

    const meta = user.user_metadata || {};
    if (!meta.signup_pending || !meta.org_name || !meta.site_name || !meta.display_name) {
      // Pre-fill form from any metadata we have
      setForm(f => ({
        ...f,
        displayName: meta.display_name || user.user_metadata?.full_name || "",
        orgName: meta.org_name || "",
        siteName: meta.site_name || "",
        siteAddress: meta.site_address || "",
      }));
      setNeedsManual(true);
      return;
    }

    setAutoRunning(true);
    (async () => {
      const { error } = await supabase.rpc('handle_signup', {
        _org_name: meta.org_name,
        _site_name: meta.site_name,
        _display_name: meta.display_name,
        _email: user.email || '',
        _site_address: meta.site_address || null,
      });

      if (error) {
        console.error('Signup error:', error);
        toast.error("Auto setup failed: " + error.message);
        setAutoRunning(false);
        setNeedsManual(true);
        setForm(f => ({
          ...f,
          displayName: meta.display_name || "",
          orgName: meta.org_name || "",
          siteName: meta.site_name || "",
          siteAddress: meta.site_address || "",
        }));
        return;
      }

      await supabase.auth.updateUser({ data: { signup_pending: false } });
      await refreshAppUser();
      toast.success("Your account is ready!");
      navigate("/", { replace: true });
    })();
  }, [user, appUser, autoRunning, needsManual, refreshAppUser, navigate]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim() || !form.orgName.trim() || !form.siteName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('handle_signup', {
      _org_name: form.orgName.trim(),
      _site_name: form.siteName.trim(),
      _display_name: form.displayName.trim(),
      _email: user?.email || '',
      _site_address: form.siteAddress.trim() || null,
    });
    if (error) {
      console.error('Manual signup error:', error);
      toast.error("Setup failed: " + error.message);
      setSubmitting(false);
      return;
    }
    await supabase.auth.updateUser({ data: { signup_pending: false } });
    await refreshAppUser();
    toast.success("Your account is ready!");
    navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (isLoading || (!needsManual && !appUser && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Setting up your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Finish setting up</CardTitle>
            <CardDescription>
              Welcome{user?.email ? `, ${user.email}` : ""}. Create your organisation and first site to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-name">Your Name *</Label>
                <Input id="o-name" value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-org">Organisation Name *</Label>
                <Input id="o-org" placeholder="My Bakery Ltd" value={form.orgName}
                  onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-site">Site Name *</Label>
                <Input id="o-site" placeholder="High Street Branch" value={form.siteName}
                  onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-addr">Site Address</Label>
                <Input id="o-addr" placeholder="123 High St, London" value={form.siteAddress}
                  onChange={e => setForm(f => ({ ...f, siteAddress: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                Complete setup
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
