import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquarePlus, Loader2, X, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FeedbackType = "feedback" | "bug" | "feature" | "other";

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "feedback", label: "Feedback" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export function FeedbackWidget() {
  const { appUser, staffSession, isAuthenticated } = useAuth();
  const { isImpersonating } = useImpersonation();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const orgId = appUser?.organisation_id ?? staffSession?.organisation_id ?? null;
  const userId = appUser?.id ?? staffSession?.user_id ?? null;

  const browserInfo = useMemo(
    () =>
      [
        `UA: ${navigator.userAgent}`,
        `Viewport: ${window.innerWidth}×${window.innerHeight}`,
        `Lang: ${navigator.language}`,
        `Time: ${new Date().toISOString()}`,
      ].join(" · "),
    []
  );

  // Hide while impersonating (avoid internal noise) or when not logged in to a customer org.
  if (isImpersonating) return null;
  if (!isAuthenticated || !orgId) return null;
  // Hide on staff console routes — feedback is customer-facing only.
  if (location.pathname.startsWith("/staff")) return null;

  const reset = () => {
    setType("feedback");
    setTitle("");
    setDescription("");
    setScreenshot(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadScreenshot = async (feedbackId: string): Promise<string | null> => {
    if (!screenshot) return null;
    const ext = (screenshot.name.split(".").pop() || "png").toLowerCase();
    const path = `${orgId}/${feedbackId}.${ext}`;
    const { error } = await sb.storage
      .from("feedback-screenshots")
      .upload(path, screenshot, { upsert: true, contentType: screenshot.type || "image/png" });
    if (error) {
      console.warn("[feedback] screenshot upload failed", error);
      return null;
    }
    return path;
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Please add a title and description.");
      return;
    }
    if (!orgId) return;
    setSubmitting(true);
    try {
      const insertPayload: Record<string, unknown> = {
        organisation_id: orgId,
        user_id: userId,
        type,
        title: title.trim().slice(0, 200),
        description: description.trim().slice(0, 5000),
        page: location.pathname + location.search,
        browser_info: browserInfo,
      };

      const { data: inserted, error: insertError } = await sb
        .from("feedback")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error("[feedback] insert failed", insertError);
        toast.error("Couldn't submit feedback. Please try again.");
        setSubmitting(false);
        return;
      }

      // Upload screenshot (best-effort) and patch the row.
      if (screenshot) {
        const path = await uploadScreenshot(inserted.id);
        if (path) {
          await sb.from("feedback").update({ screenshot_url: path }).eq("id", inserted.id);
        }
      }

      // Fire-and-forget email notification — never block the user.
      sb.functions
        .invoke("send-feedback-notification", { body: { feedback_id: inserted.id } })
        .catch((e: unknown) => console.warn("[feedback] notify failed", e));

      toast.success("Thanks — we've received your feedback.");
      reset();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className={cn(
          "fixed z-40 right-3 bottom-20 md:bottom-4 md:right-4",
          "flex items-center gap-1.5 rounded-full bg-foreground text-background shadow-lg",
          "px-3.5 py-2 text-xs font-medium hover:opacity-90 transition-opacity",
          "border border-foreground/20"
        )}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Feedback
      </button>

      <Sheet open={open} onOpenChange={(v) => { if (!submitting) setOpen(v); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Send feedback</SheetTitle>
            <SheetDescription>
              Tell us what's working, what isn't, or what you'd like to see next.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="fb-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
                <SelectTrigger id="fb-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-title">Title</Label>
              <Input
                id="fb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A short summary"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-desc">Description</Label>
              <Textarea
                id="fb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What did you expect?"
                rows={6}
                maxLength={5000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-screenshot">Screenshot (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="fb-screenshot"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                />
                {screenshot && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setScreenshot(null); if (fileRef.current) fileRef.current.value = ""; }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {screenshot && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> {screenshot.name}
                </p>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              We'll attach the current page ({location.pathname}) and browser info automatically.
            </p>
          </div>

          <SheetFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || !title.trim() || !description.trim()}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default FeedbackWidget;
