import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * This page runs after a new user confirms their magic link.
 * It checks if the auth user has signup metadata and creates the org/site/user.
 */
export default function Onboarding() {
  const { user, refreshAppUser } = useAuth();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user || done) return;

    const meta = user.user_metadata;
    if (!meta?.signup_pending) {
      // Not a new signup — just redirect
      navigate("/", { replace: true });
      return;
    }

    const setupOrg = async () => {
      const { data, error } = await supabase.rpc('handle_signup', {
        _org_name: meta.org_name,
        _site_name: meta.site_name,
        _display_name: meta.display_name,
        _email: user.email || '',
        _site_address: meta.site_address || null,
      });

      if (error) {
        console.error('Signup error:', error);
        toast.error("Failed to set up your account: " + error.message);
        return;
      }

      // Clear signup_pending flag
      await supabase.auth.updateUser({
        data: { signup_pending: false },
      });

      await refreshAppUser();
      setDone(true);
      toast.success("Your account is ready!");
      navigate("/", { replace: true });
    };

    setupOrg();
  }, [user, done, navigate, refreshAppUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Setting up your account…</p>
      </div>
    </div>
  );
}
