import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useInternalStaff } from "@/hooks/useInternalStaff";
import { Loader2, Building2, LogOut, Link2, Copy, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandingSection } from "@/components/settings/BrandingSection";

/**
 * Shown after a verified user signs in but has no profile yet.
 * Always starts with empty fields — collects organisation, first site, and display name.
 */
export default function Onboarding() {
  const { user, refreshAppUser, signOut, appUser, isLoading } = useAuth();
  const { isInternalStaff, loading: staffLoading } = useInternalStaff();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "welcome">("form");
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    orgName: "",
    siteName: "",
    siteAddress: "",
  });

  // Internal MiseOS staff should never be sent through customer onboarding —
  // bounce them to the Staff Console instead.
  useEffect(() => {
    if (!staffLoading && isInternalStaff && step === "form") {
      navigate("/staff", { replace: true });
    }
  }, [isInternalStaff, staffLoading, navigate, step]);

  // If profile already exists AND we are not in the post-signup welcome screen,
  // bounce to dashboard. (During the welcome step we WANT to keep showing it.)
  useEffect(() => {
    if (!isLoading && appUser && step === "form") {
      navigate("/", { replace: true });
    }
  }, [appUser, isLoading, navigate, step]);

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
    const { data, error } = await supabase.rpc('handle_signup', {
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
    // Fetch the auto-generated slug for the new org
    const orgId = (data as any)?.organisation_id;
    if (orgId) {
      const { data: orgRow } = await supabase
        .from("organisations")
        .select("slug, name")
        .eq("id", orgId)
        .maybeSingle();
      setOrgSlug((orgRow as any)?.slug ?? null);
      setOrgName((orgRow as any)?.name ?? form.orgName.trim());
    } else {
      setOrgName(form.orgName.trim());
    }
    setStep("welcome");
    setSubmitting(false);
    toast.success("Your account is ready!");
    // Refresh appUser in the background so downstream guards work after Continue.
    void refreshAppUser();
  };

  const continueToPricing = () => {
    navigate("/pricing", { replace: true });
  };

  const copyUrl = async () => {
    if (!orgSlug) return;
    const url = `${window.location.origin}/login/${orgSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Login URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy manually.");
    }
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

  if (step === "welcome") {
    const url = orgSlug ? `${window.location.origin}/login/${orgSlug}` : null;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Card>
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mx-auto mb-2">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Welcome to MiseOS, {orgName}!</CardTitle>
              <CardDescription>
                Your account is live. Here's the unique login page for your team — bookmark or share it now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {url ? (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Link2 className="h-4 w-4" /> Your team's login URL</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input readOnly value={url} className="font-mono text-sm bg-muted/40" onFocus={(e) => e.currentTarget.select()} />
                      <Button onClick={copyUrl} className="shrink-0 gap-1.5">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
                    <div className="rounded-lg border border-border bg-background p-3 shrink-0 mx-auto sm:mx-0">
                      <QRCodeSVG value={url} size={132} level="M" />
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1.5 flex-1">
                      <p>Staff scan this QR code or open the URL on their phone, then log in with their <strong>Site ID</strong> and <strong>Staff ID</strong>.</p>
                      <p>You'll always be able to find this URL in <strong>Account &amp; Billing</strong>.</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your account is set up. You can find your team's login URL in Account &amp; Billing.
                </p>
              )}

              <Button onClick={continueToPricing} className="w-full mt-2">
                Continue to plan setup <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
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
