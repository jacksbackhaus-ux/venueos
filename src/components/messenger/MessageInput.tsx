import { useRef, useState } from "react";
import { Plus, Send, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MessengerMessage } from "@/hooks/useMessenger";

interface Props {
  channelId: string;
  disabled?: boolean;
  onSend: (content: string, attachments: MessengerMessage["attachments"]) => Promise<void>;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/jpg", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function MessageInput({ channelId, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<MessengerMessage["attachments"]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploads: MessengerMessage["attachments"] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED_MIME.has(f.type)) {
        toast.error(`${f.name}: only JPG, PNG, PDF allowed`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: max 10 MB`);
        continue;
      }
      const ts = Date.now();
      const safe = f.name.replace(/[^a-z0-9._-]/gi, "_");
      // path: {site_id}/{channel_id}/{tempId}/{filename} — but we don't have site_id here; use channel_id only and resolve site via RLS
      const { data: ch } = await supabase
        .from("messenger_channels").select("site_id").eq("id", channelId).single();
      if (!ch?.site_id) { toast.error("Channel not found"); continue; }
      const path = `${ch.site_id}/${channelId}/upload-${ts}/${safe}`;
      const { error } = await supabase.storage.from("messenger-attachments").upload(path, f, { contentType: f.type });
      if (error) {
        toast.error(`Upload failed: ${f.name}`);
        continue;
      }
      uploads.push({
        name: f.name,
        path,
        mime: f.type,
        size: f.size,
        kind: f.type.startsWith("image/") ? "image" : f.type === "application/pdf" ? "pdf" : "file",
      });
    }
    setPending((prev) => [...prev, ...uploads]);
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleSend = async () => {
    if (disabled) return;
    const content = text.trim();
    if (!content && pending.length === 0) return;
    setText("");
    const atts = pending;
    setPending([]);
    await onSend(content, atts);
  };

  return (
    <div className="border-t border-border bg-background p-2 md:p-3">
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pending.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
              {p.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
              <span className="truncate max-w-[140px]">{p.name}</span>
              <button onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Button
          size="icon" variant="ghost"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || uploading}
          aria-label="Attach file"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={disabled ? "Read-only channel" : "Type a message…"}
          disabled={disabled}
          rows={1}
          className="min-h-10 max-h-32 resize-none rounded-2xl flex-1 text-sm"
        />
        <Button
          size="icon"
          className={cn("h-10 w-10 shrink-0 rounded-full", (!text.trim() && pending.length === 0) && "opacity-50")}
          onClick={handleSend}
          disabled={disabled || (!text.trim() && pending.length === 0)}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
