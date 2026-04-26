import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
}

interface Member { id: string; display_name: string }

export function NewChannelDialog({ open, onOpenChange, onCreated }: Props) {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !currentSite) return;
    (async () => {
      const { data } = await supabase
        .from("memberships")
        .select("user_id, users:user_id(id, display_name)")
        .eq("site_id", currentSite.id)
        .eq("active", true);
      const mapped: Member[] = (data ?? [])
        .map((m: { users: Member | null }) => m.users)
        .filter((u): u is Member => !!u && u.id !== appUser?.id);
      setMembers(mapped);
      setSelected(new Set(mapped.map((m) => m.id))); // default: include all
    })();
  }, [open, currentSite, appUser?.id]);

  const reset = () => {
    setName(""); setDescription(""); setIsPrivate(false); setSelected(new Set());
  };

  const handleCreate = async () => {
    if (!currentSite || !appUser) return;
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!cleanName) { toast.error("Channel name required"); return; }
    setSaving(true);
    const { data: ch, error } = await supabase
      .from("messenger_channels")
      .insert({
        site_id: currentSite.id,
        organisation_id: currentSite.organisation_id,
        name: cleanName,
        description: description.trim() || null,
        type: "group",
        is_private: isPrivate,
        is_system: false,
        created_by_user_id: appUser.id,
      })
      .select()
      .single();

    if (error || !ch) {
      toast.error(error?.message || "Could not create channel");
      setSaving(false);
      return;
    }

    // Add creator as admin + selected members
    const rows = [
      { channel_id: ch.id, user_id: appUser.id, role: "admin" as const },
      ...Array.from(selected).map((uid) => ({ channel_id: ch.id, user_id: uid, role: "member" as const })),
    ];
    await supabase.from("messenger_participants").insert(rows);

    toast.success(`#${cleanName} created`);
    setSaving(false);
    reset();
    onOpenChange(false);
    onCreated(ch.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Name</Label>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. front-of-house"
              maxLength={40}
            />
            <p className="text-[11px] text-muted-foreground">Lowercase, hyphens — like a hashtag.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description (optional)</Label>
            <Textarea
              id="ch-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={200}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Private channel</Label>
              <p className="text-[11px] text-muted-foreground">Only invited members can see it.</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
          {members.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm">Members</Label>
              <ScrollArea className="h-40 rounded-md border p-2">
                <div className="space-y-1">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={selected.has(m.id)}
                        onCheckedChange={(c) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (c) next.add(m.id); else next.delete(m.id);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{m.display_name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
