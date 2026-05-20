import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft } from "lucide-react";
import {
  AuthScreen,
  RoleChooser,
  ManagerLoginCard,
  ManagerSignupCard,
  ManagerForgotCard,
  StaffCard,
} from "./Auth";
import { FullScreenLoader } from "@/components/FullScreenLoader";

interface OrgBrandingPublic {
  logo_url: string | null;
  business_display_name: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
}

interface OrgPublic {
  id: string;
  name: string;
  slug: string;
  branding: OrgBrandingPublic | null;
}

export default function OrgLogin() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, staffSession, user, appUser } = useAuth();

  const [org, setOrg] = useState<OrgPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<AuthScreen>("choose");

  useEffect(() => {
    if (authLoading) return;
    if (staffSession) navigate("/", { replace: true });
    else if (isAuthenticated && user && !user.is_anonymous) {
      // Remember the slug per-user only when it actually matches their org.
      if (appUser && org && appUser.organisation_id === org.id) {
        import("@/lib/postLoginRoute").then(m => m.rememberSlugForUser(user.id, org.slug));
      }
      navigate(appUser ? "/" : "/onboarding", { replace: true });
    }
  }, [authLoading, isAuthenticated, staffSession, user, appUser, navigate, org]);


  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.rpc("get_org_public_by_slug", { _slug: slug }).then(({ data, error }) => {
      if (cancelled) return;
      setOrg(error || !data ? null : (data as unknown as OrgPublic));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  const branding = org?.branding ?? null;
  const displayName = branding?.business_display_name?.trim() || org?.name || "";
  const logoUrl = useMemo(() => {
    if (!branding?.logo_url) return null;
    return supabase.storage.from("org-logos").getPublicUrl(branding.logo_url).data.publicUrl;
  }, [branding?.logo_url]);

  const primary = branding?.primary_colour || "#0D9488";
  const accent = branding?.secondary_colour || "#F59E0B";

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

  // Scoped brand styling — never overrides global tokens.
  const brandStyle = {
    ["--brand-primary" as any]: primary,
    ["--brand-accent" as any]: accent,
    ["--brand-primary-foreground" as any]: "#ffffff",
  } as React.CSSProperties;

  return (
    <div
      data-branded="true"
      style={brandStyle}
      className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-[420px]">
        {/* Branded header */}
        <div className="flex flex-col items-center mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="h-16 w-16 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ background: primary }}
            >
              <span className="text-lg font-bold text-white">
                {displayName.charAt(0).toUpperCase() || "M"}
              </span>
            </div>
          )}
          <h1 className="font-heading text-xl font-bold text-foreground mt-3">{displayName}</h1>
          <div className="h-0.5 w-10 rounded-full mt-2" style={{ background: accent }} aria-hidden />
        </div>

        {screen === "choose" && <RoleChooser onChoose={setScreen} businessName={displayName} />}
        {screen === "manager-login" && (
          <ManagerLoginCard
            onBack={() => setScreen("choose")}
            onCreate={() => setScreen("manager-signup")}
            onForgot={() => setScreen("manager-forgot")}
            expectedOrgId={org.id}
            orgName={displayName}
          />
        )}
        {screen === "manager-signup" && (
          <ManagerSignupCard
            onBack={() => setScreen("choose")}
            onLogin={() => setScreen("manager-login")}
          />
        )}
        {screen === "manager-forgot" && (
          <ManagerForgotCard onBack={() => setScreen("manager-login")} />
        )}
        {screen === "staff" && (
          <StaffCard
            onBack={() => setScreen("choose")}
            orgSlug={org.slug}
            orgName={displayName}
          />
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Powered by MiseOS · <Link to="/auth" className="underline hover:text-foreground">Standard sign-in</Link>
        </p>
      </div>
    </div>
  );
}
