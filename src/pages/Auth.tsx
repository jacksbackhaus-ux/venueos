import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, KeyRound, Building2, Loader2 } from "lucide-react";

export default function Auth() {
  const [tab, setTab] = useState<"login" | "signup" | "staff">("login");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center mr-3">
            <span className="text-sm font-bold text-primary-foreground">BH</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Hygiene HQ</h1>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="login">
              <Mail className="h-4 w-4 mr-1.5" /> Login
            </TabsTrigger>
            <TabsTrigger value="signup">
              <Building2 className="h-4 w-4 mr-1.5" /> Sign Up
            </TabsTrigger>
            <TabsTrigger value="staff">
              <KeyRound className="h-4 w-4 mr-1.5" /> Staff
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login"><EmailLoginForm /></TabsContent>
          <TabsContent value="signup"><SignupForm /></TabsContent>
          <TabsContent value="staff"><StaffLoginForm /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmailLoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("Check your email for the login link!");
    }
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Check your inbox</CardTitle>
          <CardDescription className="text-center">
            We sent a magic link to <strong>{email}</strong>. Click it to log in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Try a different email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Owner / Manager Login</CardTitle>
        <CardDescription>Sign in with your email via magic link — no password needed.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" placeholder="you@bakery.co.uk" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Send Magic Link
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignupForm() {
  const [form, setForm] = useState({
    email: "", displayName: "", orgName: "", siteName: "", siteAddress: ""
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.orgName || !form.siteName || !form.displayName) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);

    // First create auth user via magic link
    const { error } = await supabase.auth.signInWithOtp({
      email: form.email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          signup_pending: true,
          org_name: form.orgName,
          site_name: form.siteName,
          display_name: form.displayName,
          site_address: form.siteAddress || null,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setStep("verify");
      toast.success("Check your email to complete signup!");
    }
  };

  if (step === "verify") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Verify your email</CardTitle>
          <CardDescription className="text-center">
            Click the link we sent to <strong>{form.email}</strong> to finish setting up your account.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your Account</CardTitle>
        <CardDescription>Set up your organisation and first bakery site.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Your Name *</Label>
            <Input id="s-name" placeholder="Jane Smith" value={form.displayName} onChange={update("displayName")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">Email *</Label>
            <Input id="s-email" type="email" placeholder="jane@bakery.co.uk" value={form.email} onChange={update("email")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-org">Organisation Name *</Label>
            <Input id="s-org" placeholder="BackHaus Bakery Ltd" value={form.orgName} onChange={update("orgName")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-site">Site Name *</Label>
            <Input id="s-site" placeholder="High Street Branch" value={form.siteName} onChange={update("siteName")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-addr">Site Address</Label>
            <Input id="s-addr" placeholder="123 High St, London" value={form.siteAddress} onChange={update("siteAddress")} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
            Create Account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffLoginForm() {
  const { setStaffSession } = useAuth();
  const [siteCode, setSiteCode] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteCode || !staffCode) return;

    // Rate limiting
    if (lockedUntil && Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Try again in ${secs}s.`);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('validate_staff_code', {
      _site_id: siteCode.trim(),
      _staff_code: staffCode.trim(),
    });
    setLoading(false);

    if (error) {
      toast.error("Login failed. Check your codes.");
      setAttempts(a => a + 1);
      if (attempts >= 4) {
        setLockedUntil(Date.now() + 30000);
        setAttempts(0);
        toast.error("Too many failed attempts. Locked for 30 seconds.");
      }
      return;
    }

    const result = data as { valid: boolean; error?: string; user_id?: string; display_name?: string; site_role?: string; organisation_id?: string };
    if (!result.valid) {
      toast.error(result.error || "Invalid credentials");
      setAttempts(a => a + 1);
      if (attempts >= 4) {
        setLockedUntil(Date.now() + 30000);
        setAttempts(0);
      }
      return;
    }

    setStaffSession({
      user_id: result.user_id!,
      display_name: result.display_name!,
      site_role: result.site_role!,
      organisation_id: result.organisation_id!,
      site_id: siteCode.trim(),
    });
    toast.success(`Welcome, ${result.display_name}!`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Login</CardTitle>
        <CardDescription>Enter your site ID and staff code. Ask your manager if you don't have these.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStaffLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="site-code">Site ID</Label>
            <Input id="site-code" placeholder="Site UUID" value={siteCode} onChange={e => setSiteCode(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-code">Staff Code</Label>
            <Input id="staff-code" placeholder="Your unique code" value={staffCode}
              onChange={e => setStaffCode(e.target.value)} required />
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
