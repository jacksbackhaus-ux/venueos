import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";

export function DashboardFeedback() {
  const { currentSite } = useSite();
  const { appUser, staffSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState("neutral");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!currentSite || !description.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("feedback_entries").insert({
      site_id: currentSite.id,
      organisation_id: currentSite.organisation_id,
      logged_by: appUser?.id ?? staffSession?.user_id ?? null,
      feedback_date: new Date().toISOString().slice(0, 10),
      source: "in_app",
      category: "product",
      sentiment,
      description: description.trim(),
      resolved: false,
    });
    setSubmitting(false);
    if (error) { toast.error("Could not submit feedback"); return; }
    toast.success("Thanks — feedback sent");
    setDescription(""); setSentiment("neutral"); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
          <MessageSquare className="h-3.5 w-3.5" />
          Send feedback
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>How's it going?</Label>
            <Select value={sentiment} onValueChange={setSentiment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">👍 Going well</SelectItem>
                <SelectItem value="neutral">😐 Neutral</SelectItem>
                <SelectItem value="negative">👎 Frustrating</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>What would make MiseOS better?</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Tell us what's working, what's not, or what's missing…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !description.trim()}>Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
