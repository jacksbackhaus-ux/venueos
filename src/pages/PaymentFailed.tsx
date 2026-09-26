import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { openCustomerPortal } from "@/lib/stripe";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, LogOut } from "lucide-react";

/**
 * Shown when the organisation's subscription is past_due (renewal payment
 * failed). Sits outside AccessGuard so it can never become a dead end.
 * The button opens the Stripe billing portal directly — no in-app hop.
 */
export default function PaymentFailed() {
  const { orgRole, signOut } = useAuth();
  const { loading, isPastDue } = useOrgAccess();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = orgRole?.org_role === "org_owner";

  if (!loading && !isPastDue) return <Navigate to="/" replace />;

  const handleUpdateCard = async () => {
    setOpening(true);
    setError(null);
    try {
      await openCustomerPortal(`${window.location.origin}/`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't open the billing page. Please try again.");
      setOpening(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <CreditCard className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-heading text-xl font-bold">Your last payment didn't go through</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Please update your card to resume using MiseOS. Your data is safe and waiting for you."
              : "Your account owner needs to update the card on file to resume using MiseOS. Your data is safe."}
          </p>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex flex-col gap-2 pt-2">
            {isOwner && (
              <Button onClick={handleUpdateCard} disabled={opening} className="w-full">
                {opening && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update card
              </Button>
            )}
            <Button variant="ghost" onClick={() => signOut()} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
