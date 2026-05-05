import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { createMessengerTask, type TaskPriority } from "@/hooks/useMessengerTasks";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  messageId?: string | null;
  initialTitle?: string;
}

interface SiteUser {
  id: string;
  display_name: string;
}

export function CreateTaskDialog({ open, onOpenChange, channelId, messageId, initialTitle }: Props) {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle((initialTitle ?? "").slice(0, 120));
      setDescription("");
      setAssignedTo("");
      setDueDate("");
      setPriority("normal");
    }
  }, [open, initialTitle]);

  // Load active site members for the assignee picker
  useEffect(() => {
    if (!open || !currentSite?.id) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("memberships")
        .select("user_id, active, users:user_id(id, display_name, status)")
        .eq("site_id", currentSite.id)
        .eq("active", true);
      if (!active) return;
      const list: SiteUser[] = (data ?? [])
        .map((r: { users: { id: string; display_name: string; status: string } | null }) => r.users)
        .filter((u): u is { id: string; display_name: string; status: string } => !!u && u.status === "active")
        .map((u) => ({ id: u.id, display_name: u.display_name }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
      setUsers(list);
    })();
    return () => {
      active = false;
    };
  }, [open, currentSite?.id]);

  const handleSave = async () => {
    if (!currentSite?.id || !appUser?.id) return;
    if (!title.trim() || !assignedTo) {
      toast.error("Title and assignee are required");
      return;
    }
    setSubmitting(true);
    const { error } = await createMessengerTask({
      site_id: currentSite.id,
      organisation_id: currentSite.organisation_id,
      channel_id: channelId,
      message_id: messageId ?? null,
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo,
      assigned_by: appUser.id,
      due_date: dueDate || null,
      priority,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Failed to create task");
      return;
    }
    toast.success("Task created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Notes (optional)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Any extra details…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
