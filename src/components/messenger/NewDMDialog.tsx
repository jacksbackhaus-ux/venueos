import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
}

interface Member {
  id: string;
  display_name: string;
}

export function NewDMDialog({ open, onOpenChange, onCreated }: Props) {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !currentSite) return;
    setLoading(true);
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
      setLoading(false);
    })();
  }, [open, currentSite, appUser?.id]);

  const filtered = members.filter(
    (m) =>
      !search ||
      m.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const startDM = async (targetUser: Member) => {
    if (!currentSite || !appUser) return;
    setCreating(targetUser.id);

    // Check if a DM channel already exists between these two users
    const { data: existing } = await supabase
      .from("messenger_channels")
      .select("id, messenger_participants!inner(user_id)")
      .eq("site_id", currentSite.id)
      .eq("type", "direct");

    // Look for a channel where both users are participants
    const existingDM = (existing ?? []).find((ch) => {
      const participants = (ch.messenger_participants as { user_id: string }[]).map(
        (p) => p.user_id
      );
      return (
        participants.includes(appUser.id) &&
        participants.includes(targetUser.id)
      );
    });

    if (existingDM) {
      // DM already exists — just open it
      setCreating(null);
      onOpenChange(false);
      onCreated(existingDM.id);
      return;
    }

    // Create a new DM channel
    const dmName = [appUser.display_name, targetUser.display_name]
      .sort()
      .join(", ");

    const { data: ch, error } = await supabase
      .from("messenger_channels")
      .insert({
        site_id: currentSite.id,
        organisation_id: currentSite.organisation_id,
        name: dmName,
        description: null,
        type: "direct",
        is_private: true,
        is_system: false,
        created_by_user_id: appUser.id,
      })
      .select()
      .single();

    if (error || !ch) {
      toast.error(error?.message || "Could not start conversation");
      setCreating(null);
      return;
    }

    // Add both users as participants
    await supabase.from("messenger_participants").insert([
      { channel_id: ch.id, user_id: appUser.id, role: "admin" },
      { channel_id: ch.id, user_id: targetUser.id, role: "member" },
    ]);

    setCreating(null);
    onOpenChange(false);
    onCreated(ch.id);
  };

  const reset = () => {
    setSearch("");
    setMembers([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            New Direct Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>

          <ScrollArea className="h-64 rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center h-full py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full py-8">
                <p className="text-sm text-muted-foreground">
                  {search ? "No staff found" : "No staff at this site"}
                </p>
              </div>
            ) : (
              <div className="p-1">
                {filtered.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => startDM(member)}
                    disabled={creating === member.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {member.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="flex-1 font-medium truncate">
                      {member.display_name}
                    </span>
                    {creating === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
