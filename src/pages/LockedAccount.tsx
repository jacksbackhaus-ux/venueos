import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, LogOut } from "lucide-react";

/**
 * Full-screen lock shown when an organisation's trial has expired without
 * a paid subscription. Data is retained — they just can't use the app
 * until they choose a plan. Only org_owner can do that.
 */
export default function LockedAccount() {
  const navigate = useNavigate();
  const { orgRole, signOut } = useAuth();
  const isOwner = orgRole?.org_role === "org_owner";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-warning/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-warning" />
          </div>
          <h1 className="font-heading text-xl font-bold">Your free trial has ended</h1>
          <p className="text-sm text-muted-foreground">
            Your data is safe and waiting for you. To keep using VenueOS,
            {isOwner ? " choose a plan and add your payment details." : " ask your account manager to choose a plan."}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {isOwner && (
              <Button onClick={() => navigate("/pricing")} className="w-full">
                Choose a plan
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
