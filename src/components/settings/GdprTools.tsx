import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isImpersonationActive } from "@/lib/impersonationGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

async function errorFrom(error: any, data: any): Promise<string | null> {
  if (data?.error) return data.error;
  if (!error) return null;
  try {
    const body = await error.context?.json?.();
    if (body?.error) return body.error;
  } catch { /* ignore */ }
  return error.message ?? "Something went wrong.";
}

/** Downloads the person's data as JSON straight to the browser. Never stored. */
export async function exportPersonalData(targetUserId?: string, label = "personal-data") {
  if (isImpersonationActive()) { toast.error("Not available during support access."); return; }
  const { data, error } = await supabase.functions.invoke("gdpr-export", {
    body: targetUserId ? { target_user_id: targetUserId } : {},
  });
  const msg = await errorFrom(error, data);
  if (msg) { toast.error(msg); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `miseos-${label}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("Export downloaded.");
}

export function AnonymiseDialog({
  open, onOpenChange, targetUserId, targetName, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Omit for self-service. */
  targetUserId?: string;
  targetName?: string;
  onDone?: () => void;
}) {
  const self = !targetUserId;
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const run = async () => {
    if (isImpersonationActive()) { toast.error("Not available during support access."); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gdpr-anonymise", {
      body: self ? { password } : { target_user_id: targetUserId },
    });
    setBusy(false);
    const msg = await errorFrom(error, data);
    if (msg) { toast.error(msg); return; }
    if ((data as any)?.contact_support) toast.message("Anonymised. Please contact support to close the linked sign-in.");
    else toast.success("Anonymised.");
    setConfirm(""); setPassword("");
    onOpenChange(false);
    if (self) {
      try { await signOut(); } catch { /* session already ended */ }
      navigate("/auth", { replace: true });
      return;
    }
    onDone?.();
  };

  const ready = confirm === "DELETE" && (!self || password.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {self ? "Delete / anonymise your account?" : `Anonymise ${targetName ?? "this person"}?`}
          </DialogTitle>
          <DialogDescription>This can't be undone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">What's removed</p>
            <p className="text-muted-foreground">
              Name on the profile (becomes "Former staff member"), email address and Staff ID. {self ? "You" : "They"} won't be able to sign in again.
            </p>
          </div>
          <div>
            <p className="font-medium">What's kept</p>
            <p className="text-muted-foreground">
              Food safety records {self ? "you" : "they"} completed keep the name recorded at the time, because the business must keep them.
              Screens that look names up live — training records, rota history, timesheets, holidays, availability and messenger member lists — will show "Former staff member" from then on.
            </p>
          </div>
          <p className="text-muted-foreground">
            If the business still needs this data with the name attached, for payroll for example, export it first.
          </p>
          {self && (
            <div className="space-y-1.5">
              <Label className="text-xs">Your password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Type DELETE to confirm</Label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" disabled={!ready || busy} onClick={run}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Anonymise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Settings › Account › Data & Privacy. */
export function GdprSelfSection({ isOrgOwner }: { isOrgOwner: boolean }) {
  const { staffSession } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  if (staffSession) {
    return (
      <div className="space-y-2">
        <h3 className="font-heading font-semibold text-sm">Data & Privacy (GDPR)</h3>
        <p className="text-xs text-muted-foreground">Ask your manager to export your data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-heading font-semibold text-sm">Data & Privacy (GDPR)</h3>
      <Button
        variant="outline" size="sm" className="w-full justify-start gap-2" disabled={exporting}
        onClick={async () => { setExporting(true); await exportPersonalData(); setExporting(false); }}
      >
        {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Export My Personal Data
      </Button>
      {isOrgOwner ? (
        <p className="text-[10px] text-muted-foreground">
          As the business owner, you can't delete your own account here — it would leave the business without an owner. Cancel your subscription and contact support instead.
        </p>
      ) : (
        <>
          <Button
            variant="outline" size="sm" className="w-full justify-start gap-2 text-breach hover:text-breach"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="h-3 w-3" /> Delete / Anonymise Account
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Anonymising removes your name, email and Staff ID and ends your sign-in. Food safety records you completed keep the name recorded at the time, as the business must keep them.
          </p>
        </>
      )}
      <AnonymiseDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
