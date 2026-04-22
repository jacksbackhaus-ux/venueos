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
 * Shown after a verified user signs in but has no profile yet.
 * Always starts with empty fields — collects organisation, first site, and display name.
 */
export default function Onboarding() {
  const { user, refreshAppUser, signOut, appUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    orgName: "",
    siteName: "",
    siteAddress: "",
  });

  // If profile already exists, bounce to dashboard
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

  // Pre-fill display name only from the name they entered at signup (not org/site)
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata || {};
    setForm(f => ({
      ...f,
      displayName: f.displayName || meta.display_name || meta.full_name || "",
    }));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim() || !form.orgName.trim() || !form.siteName.trim()) {
      toast.error("Please fill in your name, organisation, and site name");
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
      console.error('Onboarding error:', error);
      toast.error("Setup failed: " + error.message);
      setSubmitting(false);
      return;
    }
    await refreshAppUser();
    toast.success("Your account is ready!");
    navigate("/pricing", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (isLoading || (!user && !appUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Set up your business</CardTitle>
            <CardDescription>
              Welcome{user?.email ? `, ${user.email}` : ""}. Tell us about your organisation and first location to get started. You can add more sites and configure everything else from Settings later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-name">Your Name *</Label>
                <Input id="o-name" value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-org">Organisation Name *</Label>
                <Input id="o-org" placeholder="e.g. My Bakery Ltd" value={form.orgName}
                  onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-site">First Site Name *</Label>
                <Input id="o-site" placeholder="e.g. High Street Branch" value={form.siteName}
                  onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-addr">Site Address (optional)</Label>
                <Input id="o-addr" value={form.siteAddress}
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
