import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { PasswordInput } from "@/pages/Auth";

/**
 * Internal-only sign-in page for MiseOS employees.
 * Reuses the standard email/password Supabase auth (no provider change).
 * After login: if `is_internal_staff()` is true → /staff, otherwise sign out
 * and show "Not authorised" so customers can't accidentally land here.
 *
 * Linked to from a small hyperlink on /auth — not advertised to customers.
 */
export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // If already signed in AND internal staff → straight to /staff.
  // If signed in but NOT staff, leave them where they are (they may be a customer).
  // 1) If already signed in AND internal staff → /staff.
  // 2) If already signed in AND NOT internal staff (i.e. a customer with an
  //    appUser, or an unknown account) → sign them out and bounce to /auth
  //    so a customer who hits this URL by mistake can never even render the
  //    form in an authed state.
  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setChecking(false); return; }
      const { data: ok } = await supabase.rpc("is_internal_staff");
      if (ok === true) {
        navigate("/staff", { replace: true });
        return;
      }
      // Authed but not internal staff → this page is not for them.
      await supabase.auth.signOut();
      toast.error("Internal staff access only. Please use the standard login.");
      navigate("/auth", { replace: true });
    })();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Verify internal-staff status server-side via SECURITY DEFINER helper.
    const { data: ok, error: rpcErr } = await supabase.rpc("is_internal_staff");
    setLoading(false);

    if (rpcErr || ok !== true) {
      // Sign them out so a non-staff customer doesn't end up half-authed in the staff console.
      await supabase.auth.signOut();
      toast.error("Not authorised for staff access. Please use the standard login.");
      navigate("/auth", { replace: true });
      return;
    }

    toast.success("Welcome to the MiseOS Staff Console.");
    navigate("/staff", { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center mr-3">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">MiseOS Staff</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Internal Sign In</CardTitle>
            <CardDescription>
              For MiseOS employees only. Customer accounts will be rejected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-email">Work email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  placeholder="you@miseos.app"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Password</Label>
                <PasswordInput
                  id="staff-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Sign In
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/auth" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3 mr-1" /> Back to customer login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
