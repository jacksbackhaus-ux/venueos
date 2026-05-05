import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ClipboardCheck, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channelId: string;
  siteId: string;
}

type FridgeStatus = "all_ok" | "issues_noted" | "not_checked";

const FRIDGE_LABEL: Record<FridgeStatus, string> = {
  all_ok: "All checked and within range",
  issues_noted: "One or more issues noted",
  not_checked: "Not checked",
};

export function HandoverDialog({ open, onOpenChange, channelId, siteId }: Props) {
  const { appUser } = useAuth();
  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [fridge, setFridge] = useState<FridgeStatus>("all_ok");
  const [foodPrep, setFoodPrep] = useState("");
  const [outstanding, setOutstanding] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSummary(""); setIssues(""); setFridge("all_ok"); setFoodPrep(""); setOutstanding("");
  };

  const submit = async () => {
    if (!summary.trim()) { toast.error("Shift summary is required"); return; }
    if (!appUser) return;
    setSubmitting(true);

    const lines = [
      `📋 Shift Handover — ${appUser.display_name}`,
      ``,
      `Summary: ${summary.trim()}`,
    ];
    if (issues.trim()) lines.push(`Issues / incidents: ${issues.trim()}`);
    lines.push(`Fridges & freezers: ${FRIDGE_LABEL[fridge]}`);
    if (foodPrep.trim()) lines.push(`Food prep completed: ${foodPrep.trim()}`);
    if (outstanding.trim()) lines.push(`Outstanding for next shift: ${outstanding.trim()}`);

    const { error } = await supabase.from("messenger_messages").insert({
      channel_id: channelId,
      site_id: siteId,
      sender_id: appUser.id,
      sender_name_snapshot: appUser.display_name,
      content: lines.join("\n"),
      message_type: "shift_card",
      system_payload: {
        kind: "shift_handover",
        handover_by_user_id: appUser.id,
        handover_by_name: appUser.display_name,
        summary: summary.trim(),
        issues: issues.trim() || null,
        fridge_status: fridge,
        fridge_status_label: FRIDGE_LABEL[fridge],
        food_prep: foodPrep.trim() || null,
        outstanding_tasks: outstanding.trim() || null,
      } as any,
    } as any);

    setSubmitting(false);
    if (error) { toast.error("Failed to post handover: " + error.message); return; }
    toast.success("Handover posted to channel");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Shift Handover
          </DialogTitle>
          <DialogDescription>
            Post a structured handover to the channel for the next shift.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ho-summary">Shift summary <span className="text-destructive">*</span></Label>
            <Textarea
              id="ho-summary" rows={3}
              placeholder="How did the shift go overall?"
              value={summary} onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ho-issues">Any issues or incidents</Label>
            <Textarea
              id="ho-issues" rows={2}
              placeholder="Optional"
              value={issues} onChange={(e) => setIssues(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ho-fridge">Fridge & freezer status</Label>
            <Select value={fridge} onValueChange={(v) => setFridge(v as FridgeStatus)}>
              <SelectTrigger id="ho-fridge"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_ok">{FRIDGE_LABEL.all_ok}</SelectItem>
                <SelectItem value="issues_noted">{FRIDGE_LABEL.issues_noted}</SelectItem>
                <SelectItem value="not_checked">{FRIDGE_LABEL.not_checked}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ho-prep">Food prep completed</Label>
            <Textarea
              id="ho-prep" rows={2}
              placeholder="Optional — what was prepped this shift"
              value={foodPrep} onChange={(e) => setFoodPrep(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ho-out">Outstanding tasks for next shift</Label>
            <Textarea
              id="ho-out" rows={2}
              placeholder="Optional"
              value={outstanding} onChange={(e) => setOutstanding(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !summary.trim()}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Post Handover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
