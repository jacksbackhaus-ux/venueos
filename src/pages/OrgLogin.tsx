import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, KeyRound, Loader2, Building2, ArrowLeft } from "lucide-react";
import { EmailLoginForm } from "./Auth";
import { FullScreenLoader } from "@/components/FullScreenLoader";

interface OrgPublic {
  id: string;
  name: string;
  slug: string;
}

interface OrgBrandingPublic {
  logo_url: string | null;
  business_display_name: string | null;
  primary_colour: string | null;
}

export default function OrgLogin() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, staffSession, user, appUser } = useAuth();

  const [org, setOrg] = useState<OrgPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"login" | "staff">("login");

  // If already signed in, bounce
  useEffect(() => {
    if (authLoading) return;
    if (staffSession) navigate("/", { replace: true });
    else if (isAuthenticated && user && !user.is_anonymous) {
      navigate(appUser ? "/" : "/onboarding", { replace: true });
    }
  }, [authLoading, isAuthenticated, staffSession, user, appUser, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("get_org_public_by_slug", { _slug: slug })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setOrg(null);
        else setOrg(data as unknown as OrgPublic);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (authLoading || loading) return <FullScreenLoader />;

  if (!org) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-12 w-12 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Organisation not found</CardTitle>
            <CardDescription>
              We couldn't find a customer at <span className="font-mono">/login/{slug}</span>.
              Check the link with your manager, or use the standard sign-in page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth"><ArrowLeft className="h-4 w-4 mr-2" /> Standard sign-in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const branding = (org as any).branding as OrgBrandingPublic | null;
  const logoUrl = branding?.logo_url
    ? supabase.storage.from("org-logos").getPublicUrl(branding.logo_url).data.publicUrl
    : null;
  const displayName = branding?.business_display_name?.trim() || org.name;
  const primary = branding?.primary_colour || undefined;

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      style={primary ? ({ ["--brand-primary" as any]: primary } as React.CSSProperties) : undefined}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6 space-y-2">
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="h-16 w-16 rounded-2xl object-cover mx-auto mb-1" />
          ) : (
            <div
              className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-1"
              style={{ background: primary ? `${primary}1A` : undefined }}
            >
              <Building2 className="h-7 w-7" style={primary ? { color: primary } : undefined} />
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold text-foreground">{displayName}</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to {displayName} on MiseOS
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">
              <Mail className="h-4 w-4 mr-1.5" /> Manager
            </TabsTrigger>
            <TabsTrigger value="staff">
              <KeyRound className="h-4 w-4 mr-1.5" /> Staff
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login"><EmailLoginForm /></TabsContent>
          <TabsContent value="staff"><OrgStaffLoginForm orgSlug={org.slug} orgName={org.name} /></TabsContent>
        </Tabs>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Powered by MiseOS · <Link to="/auth" className="underline hover:text-foreground">Standard sign-in</Link>
        </p>
      </div>
    </div>
  );
}

function OrgStaffLoginForm({ orgSlug, orgName }: { orgSlug: string; orgName: string }) {
  const { setStaffSession } = useAuth();
  const [siteCode, setSiteCode] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteCode || !staffCode) return;

    if (lockedUntil && Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Try again in ${secs}s.`);
      return;
    }

    setLoading(true);

    const failAttempt = (msg: string) => {
      toast.error(msg);
      setAttempts((a) => a + 1);
      if (attempts >= 4) {
        setLockedUntil(Date.now() + 30000);
        setAttempts(0);
        toast.error("Too many failed attempts. Locked for 30 seconds.");
      }
    };

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        setLoading(false);
        failAttempt("Could not start session. Please try again.");
        return;
      }
    }

    const { data, error } = await supabase.rpc("link_staff_session_for_org", {
      _org_slug: orgSlug,
      _site_id: siteCode.trim(),
      _staff_code: staffCode.trim(),
    });
    setLoading(false);

    if (error) {
      await supabase.auth.signOut();
      failAttempt("Login failed. Check your codes.");
      return;
    }

    const result = data as { valid: boolean; error?: string; user_id?: string; display_name?: string; site_role?: string; organisation_id?: string; site_id?: string };
    if (!result.valid) {
      await supabase.auth.signOut();
      failAttempt(result.error || "Invalid credentials");
      return;
    }

    setStaffSession({
      user_id: result.user_id!,
      display_name: result.display_name!,
      site_role: result.site_role!,
      organisation_id: result.organisation_id!,
      site_id: result.site_id!,
    });
    toast.success(`Welcome, ${result.display_name}!`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Login</CardTitle>
        <CardDescription>
          Enter the Site ID and Staff ID for <strong>{orgName}</strong>. Ask your manager if you don't have these.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStaffLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-site-code">Site ID</Label>
            <Input
              id="org-site-code" placeholder="e.g. JB4821" value={siteCode}
              onChange={(e) => setSiteCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest text-center text-lg" required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-staff-code">Staff ID</Label>
            <Input
              id="org-staff-code" placeholder="e.g. J01" value={staffCode}
              onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest text-center text-lg" required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Log In
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
