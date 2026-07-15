import { useState, forwardRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Briefcase, KeyRound, ArrowLeft, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";

type Screen = "choose" | "manager-login" | "manager-signup" | "manager-forgot" | "staff";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialScreen: Screen =
    searchParams.get("mode") === "signup" || searchParams.get("signup") === "true"
      ? "manager-signup"
      : "choose";
  const [screen, setScreen] = useState<Screen>(initialScreen);

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
      <SEO
        title="Sign in to MiseOS"
        description="Sign in to MiseOS or start a 14-day free trial. Run your bakery, café, or kitchen from one calm system."
        path="/auth"
      />

      <div className="w-full max-w-[420px]">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
            <span className="text-base font-bold text-primary-foreground">M</span>
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground mt-3">Sign in to MiseOS</h1>
        </div>

        {screen === "choose" && <RoleChooser onChoose={setScreen} />}
        {screen === "manager-login" && (
          <ManagerLoginCard
            onBack={() => setScreen("choose")}
            onCreate={() => setScreen("manager-signup")}
            onForgot={() => setScreen("manager-forgot")}
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
        {screen === "staff" && <StaffCard onBack={() => setScreen("choose")} />}
      </div>

      {/* Quiet admin link at the bottom — not advertised */}
      <div className="mt-10">
        <Link
          to="/staff-login"
          className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          Admin access
        </Link>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── Role chooser */

export type AuthScreen = Screen;


export function RoleChooser({ onChoose, businessName }: { onChoose: (s: Screen) => void; businessName?: string }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h2 className="font-heading text-2xl font-bold text-foreground">{businessName ? `Welcome to ${businessName}` : "Welcome to MiseOS"}</h2>
        <p className="text-sm text-muted-foreground">Choose how you want to continue</p>
      </div>

      <div className="space-y-3">
        <RoleButton
          icon={<Briefcase className="h-5 w-5" />}
          title="Manager / Owner"
          description="Run your business, manage staff, track compliance and profit"
          onClick={() => onChoose("manager-login")}
        />
        <RoleButton
          icon={<KeyRound className="h-5 w-5" />}
          title="Staff Login"
          description="Clock in, complete tasks, log temperatures and cleaning"
          onClick={() => onChoose("staff")}
        />
      </div>
      <p className="text-center text-[11px] text-muted-foreground pt-1">
        Tip: Use your branded login link for faster access.
      </p>
    </div>
  );
}

function RoleButton({
  icon, title, description, onClick,
}: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-card border rounded-xl p-4 hover:border-primary/50 hover:bg-card/80 active:scale-[0.99] transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-heading font-semibold text-foreground">{title}</div>
          <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────── Shared UI */

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back
    </button>
  );
}

function TrustLine() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-4">
      <ShieldCheck className="h-3 w-3" />
      Safe, secure, and built for real kitchens
    </p>
  );
}

export const PasswordInput = forwardRef<HTMLInputElement, {
  id: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}>(({ id, placeholder, value, onChange, required = true }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} id={id} type={show ? "text" : "password"} placeholder={placeholder}
        value={value} onChange={onChange} required={required} minLength={6} />
      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow(!show)} tabIndex={-1} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

/** Standalone login form kept for OrgLogin (per-org branded page). */
export function EmailLoginForm({
  expectedOrgId,
  orgName,
}: { expectedOrgId?: string; orgName?: string } = {}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Enforce org scoping when used on a branded login page.
    if (expectedOrgId && data.user) {
      const { data: appUser } = await supabase
        .from("users")
        .select("organisation_id")
        .eq("auth_user_id", data.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!appUser || appUser.organisation_id !== expectedOrgId) {
        await supabase.auth.signOut();
        setLoading(false);
        toast.error(
          `This account is not part of ${orgName || "this business"}. Use the correct login link.`
        );
        return;
      }
    }
    setLoading(false);
  };

  return (
    <Card className="border bg-card shadow-none">
      <CardContent className="p-6 space-y-4">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-login-email" className="text-xs font-medium">Email</Label>
            <Input id="org-login-email" type="email" placeholder="you@bakery.co.uk" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-login-password" className="text-xs font-medium">Password</Label>
            <PasswordInput id="org-login-password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full rounded-lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Log in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────── Manager: login */

export function ManagerLoginCard({
  onBack, onCreate, onForgot, expectedOrgId, orgName,
}: { onBack: () => void; onCreate: () => void; onForgot: () => void; expectedOrgId?: string; orgName?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      if (error.message.includes("Email not confirmed")) {
        toast.error("Please confirm your email before logging in.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    if (expectedOrgId && data.user) {
      const { data: appUser } = await supabase
        .from("users")
        .select("organisation_id")
        .eq("auth_user_id", data.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!appUser || appUser.organisation_id !== expectedOrgId) {
        await supabase.auth.signOut();
        setLoading(false);
        toast.error(`This account is not part of ${orgName || "this business"}. Use the correct login link.`);
        return;
      }
    }
    setLoading(false);
  };

  return (
    <div>
      <BackLink onBack={onBack} />
      <Card className="border bg-card shadow-none">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Log in</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-medium">Email</Label>
              <Input id="login-email" type="email" placeholder="you@bakery.co.uk" value={email}
                onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-medium">Password</Label>
              <PasswordInput id="login-password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full rounded-lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Log in
            </Button>
          </form>

          <div className="flex items-center justify-between text-xs pt-1">
            <button type="button" onClick={onCreate}
              className="text-primary hover:underline font-medium">
              Create account
            </button>
            <button type="button" onClick={onForgot}
              className="text-muted-foreground hover:text-foreground">
              Forgot password
            </button>
          </div>
        </CardContent>
      </Card>
      <TrustLine />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── Manager: signup */

export function ManagerSignupCard({
  onBack, onLogin,
}: { onBack: () => void; onLogin: () => void }) {
  const [form, setForm] = useState({ businessName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim() || !form.email.trim() || !form.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: form.businessName.trim(),
          business_name: form.businessName.trim(),
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setVerifySent(true);
      toast.success("Check your email to confirm your account.");
    }
  };

  if (verifySent) {
    return (
      <div>
        <BackLink onBack={onBack} />
        <Card className="border bg-card shadow-none">
          <CardContent className="p-6 space-y-4 text-center">
            <h2 className="font-heading text-xl font-bold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We've sent a confirmation link to <strong className="text-foreground">{form.email}</strong>.
              Click it to activate your account, then log in.
            </p>
            <Button onClick={onLogin} className="w-full rounded-lg">Back to log in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <BackLink onBack={onBack} />
      <Card className="border bg-card shadow-none">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Create account</h2>
            <p className="text-xs text-muted-foreground mt-1">Up and running in minutes. No charge until your trial ends.</p>
          </div>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-business" className="text-xs font-medium">Business name</Label>
              <Input id="s-business" placeholder="e.g. Brick Lane Bakery" value={form.businessName}
                onChange={update("businessName")} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email" className="text-xs font-medium">Email</Label>
              <Input id="s-email" type="email" placeholder="you@bakery.co.uk" value={form.email}
                onChange={update("email")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-password" className="text-xs font-medium">Password</Label>
              <PasswordInput id="s-password" placeholder="Min 6 characters" value={form.password}
                onChange={update("password")} />
            </div>
            <Button type="submit" className="w-full rounded-lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create account
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground pt-1">
            Already have an account?{" "}
            <button type="button" onClick={onLogin} className="text-primary hover:underline font-medium">
              Log in
            </button>
          </p>
        </CardContent>
      </Card>
      <TrustLine />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── Manager: reset */

export function ManagerForgotCard({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("If an account exists, a reset link has been sent.");
      onBack();
    }
  };

  return (
    <div>
      <BackLink onBack={onBack} />
      <Card className="border bg-card shadow-none">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Reset password</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your email and we'll send a link to set a new password.
            </p>
          </div>
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-medium">Email</Label>
              <Input id="forgot-email" type="email" placeholder="you@bakery.co.uk" value={email}
                onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <Button type="submit" className="w-full rounded-lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send reset link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── Staff */

export function StaffCard({ onBack, orgSlug, orgName }: { onBack: () => void; orgSlug?: string; orgName?: string }) {
  const { setStaffSession } = useAuth();
  const navigate = useNavigate();
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
      setAttempts(a => a + 1);
      if (attempts >= 4) {
        setLockedUntil(Date.now() + 30000);
        setAttempts(0);
        toast.error("Too many failed attempts. Locked for 30 seconds.");
      }
    };

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session && !sessionData.session.user.is_anonymous) {
      await supabase.auth.signOut();
      setStaffSession(null);
    }

    const { data: freshSessionData } = await supabase.auth.getSession();
    if (!freshSessionData.session) {
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        setLoading(false);
        failAttempt("Could not start session. Please try again.");
        return;
      }
    }

    const { data, error } = orgSlug
      ? await supabase.rpc('link_staff_session_for_org', {
          _org_slug: orgSlug,
          _site_id: siteCode.trim(),
          _staff_code: staffCode.trim(),
        })
      : await supabase.rpc('link_staff_session', {
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
    try {
      localStorage.removeItem("current_site_id");
      localStorage.removeItem("hq_site_selected");
    } catch { /* ignore */ }
    toast.success(`Welcome, ${result.display_name}!`);
    navigate("/", { replace: true });
  };

  return (
    <div>
      <BackLink onBack={onBack} />
      <Card className="border bg-card shadow-none">
        <CardContent className="p-6 space-y-5">
          <div className="text-center">
            <h2 className="font-heading text-xl font-bold text-foreground">Staff Login</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {orgName ? <>Enter the Site ID and PIN for <strong>{orgName}</strong>.</> : "Ask your manager if you don't have these."}
            </p>
          </div>
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="site-code" className="text-xs font-medium">Site ID</Label>
              <Input id="site-code" placeholder="e.g. JB4821" value={siteCode}
                onChange={e => setSiteCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest text-center text-lg h-12" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-code" className="text-xs font-medium">Staff PIN</Label>
              <Input id="staff-code" placeholder="e.g. J01" value={staffCode}
                onChange={e => setStaffCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest text-center text-lg h-12" required />
            </div>
            <Button type="submit" className="w-full rounded-lg h-11" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
