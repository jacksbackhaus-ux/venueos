import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, MoreVertical, Pencil, Trash2, AlertCircle, Calendar, Clock, FileText, Download, Image as ImageIcon, ListTodo, Pin, BellRing, ClipboardCheck, Thermometer, Truck, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import type { MessengerMessage } from "@/hooks/useMessenger";
import { useRole } from "@/hooks/useRole";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { pinMessage } from "@/hooks/useMessengerTasks";
import { setMessageRequiresAck } from "@/hooks/useMessengerPinsAcks";
import { AckStrip } from "./AckStrip";
import { toast } from "sonner";

interface Props {
  message: MessengerMessage;
  isOwn: boolean;
  showAvatar: boolean;
  showName: boolean;
  readReceipts: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onReply?: (message: MessengerMessage) => void;
}

export function MessageBubble({ message, isOwn, showAvatar, showName, readReceipts, onEdit, onDelete, onReply }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || "");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const role = useRole();
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const canManage = role.isSupervisorPlus;

  const handlePin = async () => {
    if (!currentSite?.id || !appUser?.id || !message.channel_id) return;
    const { error } = await pinMessage({
      channel_id: message.channel_id,
      site_id: currentSite.id,
      message_id: message.id,
      pinned_by: appUser.id,
    });
    if (error) toast.error(error.message ?? "Failed to pin");
    else toast.success("Message pinned");
  };

  const handleRequestAck = async () => {
    const { error } = await setMessageRequiresAck(message.id, true);
    if (error) toast.error(error.message ?? "Failed to request acknowledgement");
    else toast.success("Acknowledgement requested");
  };

  const handleClearAck = async () => {
    const { error } = await setMessageRequiresAck(message.id, false);
    if (error) toast.error(error.message ?? "Failed to clear request");
    else toast.success("Acknowledgement cleared");
  };

  const requiresAck = !!message.requires_ack && !message.deleted_at;

  // System / shift card rendering
  if (message.message_type === "shift_card" || message.message_type === "system") {
    return <SystemCard message={message} />;
  }

  const isDeleted = !!message.deleted_at;

  return (
    <div className={cn("flex gap-2 group", isOwn ? "justify-end" : "justify-start")}>
      {!isOwn && (
        <div className="w-7 shrink-0">
          {showAvatar && (
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
              {(message.sender_name_snapshot || "?").slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <div className={cn("max-w-[78%] flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
        {showName && !isOwn && (
          <span className="text-[11px] font-semibold text-muted-foreground px-1">
            {message.sender_name_snapshot || "Unknown"}
          </span>
        )}
        <div className={cn(
          "rounded-2xl px-3 py-2 text-sm break-words relative",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
          message._optimistic && "opacity-70",
          message._failed && "ring-2 ring-destructive",
          requiresAck && "ring-2 ring-warning/60 shadow-[0_0_0_4px_hsl(var(--warning)/0.08)]"
        )}>
          {isDeleted ? (
            <p className="italic opacity-70">This message was deleted</p>
          ) : editing ? (
            <div className="space-y-2 min-w-[200px]">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="bg-background text-foreground text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={() => { onEdit(message.id, draft); setEditing(false); }}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.attachments?.length > 0 && (
                <div className="space-y-1.5 mb-1">
                  {message.attachments.map((a, i) => (
                    <Attachment key={i} attachment={a} onOpenImage={setLightbox} />
                  ))}
                </div>
              )}
              {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
              {message.is_edited && !isDeleted && (
                <span className={cn("text-[10px] ml-1.5", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  (edited)
                </span>
              )}
            </>
          )}

          {!isDeleted && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon" variant="ghost"
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100",
                    isOwn ? "-left-7" : "-right-7",
                    "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Message actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "end" : "start"}>
                {onReply && (
                  <DropdownMenuItem onClick={() => onReply(message)}>
                    <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                  </DropdownMenuItem>
                )}
                {canManage && (
                  <>
                    <DropdownMenuItem onClick={() => setTaskDialogOpen(true)}>
                      <ListTodo className="h-3.5 w-3.5 mr-2" /> Create task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePin}>
                      <Pin className="h-3.5 w-3.5 mr-2" /> Pin message
                    </DropdownMenuItem>
                    {requiresAck ? (
                      <DropdownMenuItem onClick={handleClearAck}>
                        <BellRing className="h-3.5 w-3.5 mr-2" /> Clear ack request
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={handleRequestAck}>
                        <BellRing className="h-3.5 w-3.5 mr-2" /> Request acknowledgement
                      </DropdownMenuItem>
                    )}
                    {isOwn && <DropdownMenuSeparator />}
                  </>
                )}
                {isOwn && (
                  <>
                    <DropdownMenuItem onClick={() => { setDraft(message.content || ""); setEditing(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(message.id)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {requiresAck && message.channel_id && (
          <div className="w-full max-w-[420px]">
            <AckStrip
              messageId={message.id}
              channelId={message.channel_id}
              siteId={message.site_id}
              senderId={message.sender_id}
              isOwn={isOwn}
            />
          </div>
        )}
        <ReceiptRow message={message} isOwn={isOwn} readReceipts={readReceipts} />
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-0 bg-background">
          {lightbox && <img src={lightbox} alt="Attachment" className="w-full h-auto rounded-lg" />}
        </DialogContent>
      </Dialog>

      {canManage && message.channel_id && (
        <CreateTaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          channelId={message.channel_id}
          messageId={message.id}
          initialTitle={message.content || ""}
        />
      )}
    </div>
  );
}

function ReceiptRow({ message, isOwn, readReceipts }: { message: MessengerMessage; isOwn: boolean; readReceipts: boolean }) {
  const [readers, setReaders] = useState<string[]>([]);

  useEffect(() => {
    if (!isOwn || !readReceipts || message._optimistic) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("messenger_read_receipts")
        .select("user_id, users:user_id(display_name)")
        .eq("message_id", message.id)
        .limit(20);
      if (active) {
        setReaders((data ?? []).map((r: { users: { display_name: string } | null }) => r.users?.display_name).filter(Boolean) as string[]);
      }
    })();
    return () => { active = false; };
  }, [message.id, isOwn, readReceipts, message._optimistic]);

  if (!isOwn) {
    return <span className="text-[10px] text-muted-foreground px-1">{formatTime(message.created_at)}</span>;
  }
  if (message._failed) {
    return <span className="text-[10px] text-destructive flex items-center gap-1 px-1"><AlertCircle className="h-3 w-3" /> Failed</span>;
  }
  return (
    <div className="flex items-center gap-1 px-1">
      <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
      {readReceipts && (
        readers.length > 0
          ? <CheckCheck className="h-3 w-3 text-primary" aria-label={`Seen by ${readers.join(", ")}`} />
          : <Check className="h-3 w-3 text-muted-foreground" />
      )}
      {readReceipts && readers.length > 0 && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
          Seen by {readers.slice(0, 2).join(", ")}{readers.length > 2 && ` +${readers.length - 2}`}
        </span>
      )}
    </div>
  );
}

function Attachment({ attachment, onOpenImage }: {
  attachment: { name: string; path: string; mime: string; size: number; kind: "image" | "pdf" | "file" };
  onOpenImage: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.storage
        .from("messenger-attachments")
        .createSignedUrl(attachment.path, 3600);
      if (active && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => { active = false; };
  }, [attachment.path]);

  if (attachment.kind === "image") {
    return (
      <button
        onClick={() => url && onOpenImage(url)}
        className="block rounded-lg overflow-hidden max-w-xs border border-border/30"
        aria-label={`View ${attachment.name}`}
      >
        {url
          ? <img src={url} alt={attachment.name} className="w-full h-auto" loading="lazy" />
          : <div className="aspect-video bg-muted flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
      </button>
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className="flex items-center gap-2 px-2 py-2 rounded-lg bg-background/40 hover:bg-background/60 max-w-xs"
    >
      <FileText className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{attachment.name}</p>
        <p className="text-[10px] opacity-70">{(attachment.size / 1024).toFixed(0)} KB</p>
      </div>
      <Download className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

function SystemCard({ message }: { message: MessengerMessage }) {
  const p = (message.system_payload || {}) as Record<string, any>;
  const kind = (p.kind as string) || (message.message_type === "system" ? "system" : "shift");

  // ── Shift Handover ───────────────────────────────────────────────────────
  if (kind === "shift_handover") {
    return (
      <div className="flex justify-center">
        <div className="max-w-md w-full rounded-xl border-2 border-primary/40 bg-primary/5 my-1 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-primary/20">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wide text-primary">Shift Handover</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{formatTime(message.created_at)}</span>
          </div>
          <div className="px-3 py-2.5 space-y-2 text-sm">
            <p className="text-[11px] text-muted-foreground">By {p.handover_by_name || "Unknown"}</p>
            <HandoverField label="Summary" value={p.summary} required />
            {p.issues && <HandoverField label="Issues / incidents" value={p.issues} />}
            <HandoverField label="Fridges & freezers" value={p.fridge_status_label} />
            {p.food_prep && <HandoverField label="Food prep completed" value={p.food_prep} />}
            {p.outstanding_tasks && <HandoverField label="Outstanding tasks" value={p.outstanding_tasks} />}
          </div>
        </div>
      </div>
    );
  }

  // ── Temperature breach ──────────────────────────────────────────────────
  if (kind === "temp_breach") {
    return (
      <div className="flex justify-center">
        <div className="max-w-md w-full rounded-xl border-2 border-destructive/40 bg-destructive/5 my-1 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border-b border-destructive/20">
            <Thermometer className="h-4 w-4 text-destructive" />
            <span className="text-xs font-bold uppercase tracking-wide text-destructive">Temperature Breach</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{formatTime(message.created_at)}</span>
          </div>
          <div className="px-3 py-2.5 space-y-1.5 text-sm">
            <p className="font-medium">{p.unit_name || p.food_item || "Unit"}</p>
            <p className="text-sm">
              Recorded <span className="font-semibold text-destructive">{p.value}°C</span>
              {p.min_temp !== null && p.max_temp !== null && p.min_temp !== undefined && (
                <span className="text-muted-foreground"> · acceptable {p.min_temp}°C to {p.max_temp}°C</span>
              )}
            </p>
            <p className="text-[12px]">
              <span className="text-muted-foreground">Corrective action: </span>
              <span>{p.corrective_action || "None recorded"}</span>
            </p>
            {p.logged_by_name && <p className="text-[11px] text-muted-foreground">Logged by {p.logged_by_name}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Delivery rejected ───────────────────────────────────────────────────
  if (kind === "delivery_rejected") {
    return (
      <div className="flex justify-center">
        <div className="max-w-md w-full rounded-xl border-2 border-warning/40 bg-warning/5 my-1 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-b border-warning/20">
            <Truck className="h-4 w-4 text-warning" />
            <span className="text-xs font-bold uppercase tracking-wide text-warning">Delivery Rejected</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{formatTime(message.created_at)}</span>
          </div>
          <div className="px-3 py-2.5 space-y-1.5 text-sm">
            <p className="font-medium">{p.supplier_name || "Unknown supplier"}</p>
            {p.items && <p className="text-[12px]"><span className="text-muted-foreground">Items: </span>{p.items}</p>}
            <p className="text-[12px]"><span className="text-muted-foreground">Reason: </span>{p.reason}</p>
            {p.logged_by_name && <p className="text-[11px] text-muted-foreground">Logged by {p.logged_by_name}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Default (existing shift cards) ──────────────────────────────────────
  const colour =
    kind === "shift_cancelled" ? "border-destructive/40 bg-destructive/5"
      : kind === "shift_assigned" ? "border-success/40 bg-success/5"
      : "border-primary/40 bg-primary/5";

  return (
    <div className="flex justify-center">
      <div className={cn("max-w-md w-full rounded-xl border px-3 py-2.5 my-1", colour)}>
        <div className="flex items-start gap-2">
          {kind === "shift_cancelled" ? <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" /> : <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            {p?.shift_date && (
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{p.shift_date} · {p.start_time}–{p.end_time}</span>
              </div>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-right mt-1">{formatTime(message.created_at)}</p>
      </div>
    </div>
  );
}

function HandoverField({ label, value, required }: { label: string; value: any; required?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </p>
      <p className="text-sm whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
