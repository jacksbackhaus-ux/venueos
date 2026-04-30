import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageSquareHeart, Plus, Loader2, Check, AlertCircle, Smile, Meh, Frown,
  Inbox, CheckCircle2, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

type Source = "in_person" | "google" | "social_media" | "email" | "phone" | "other";
type Category = "food_quality" | "service" | "cleanliness" | "allergen_concern" | "complaint" | "compliment" | "suggestion";
type Sentiment = "positive" | "neutral" | "negative";

const SOURCES: { value: Source; label: string }[] = [
  { value: "in_person", label: "In Person" },
  { value: "google", label: "Google Review" },
  { value: "social_media", label: "Social Media" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "food_quality", label: "Food Quality" },
  { value: "service", label: "Service" },
  { value: "cleanliness", label: "Cleanliness" },
  { value: "allergen_concern", label: "Allergen Concern" },
  { value: "complaint", label: "Complaint" },
  { value: "compliment", label: "Compliment" },
  { value: "suggestion", label: "Suggestion" },
];

const SENTIMENTS: { value: Sentiment; label: string; icon: React.ElementType }[] = [
  { value: "positive", label: "Positive", icon: Smile },
  { value: "neutral", label: "Neutral", icon: Meh },
  { value: "negative", label: "Negative", icon: Frown },
];

const SOURCE_LABEL = Object.fromEntries(SOURCES.map(s => [s.value, s.label])) as Record<Source, string>;
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label])) as Record<Category, string>;

function sentimentClasses(s: Sentiment): string {
  if (s === "positive") return "bg-success/10 text-success border-success/30";
  if (s === "negative") return "bg-breach/10 text-breach border-breach/30";
  return "bg-muted text-muted-foreground border-border";
}

interface FeedbackRow {
  id: string;
  site_id: string;
  organisation_id: string;
  logged_by: string | null;
  feedback_date: string;
  source: Source;
  category: Category;
  sentiment: Sentiment;
  description: string;
  action_taken: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

const CustomerFeedback = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const { isSupervisorPlus } = useRole();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userId = appUser?.id || staffSession?.user_id || null;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthFrom = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthTo = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [activeTab, setActiveTab] = useState<"list" | "summary">("list");
  const [showLog, setShowLog] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveAction, setResolveAction] = useState("");

  // Form state
  const [feedbackDate, setFeedbackDate] = useState(todayStr);
  const [source, setSource] = useState<Source>("in_person");
  const [category, setCategory] = useState<Category>("food_quality");
  const [sentiment, setSentiment] = useState<Sentiment>("neutral");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["feedback_entries", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("feedback_entries")
        .select("*")
        .eq("site_id", siteId)
        .order("feedback_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FeedbackRow[];
    },
    enabled: !!siteId,
  });

  const openEntries = entries.filter(e => !e.resolved);
  const resolvedEntries = entries.filter(e => e.resolved);

  const monthEntries = useMemo(
    () => entries.filter(e => e.feedback_date >= monthFrom && e.feedback_date <= monthTo),
    [entries, monthFrom, monthTo],
  );

  const monthByCategory = useMemo(() => {
    const map = new Map<Category, number>();
    for (const e of monthEntries) map.set(e.category, (map.get(e.category) || 0) + 1);
    return map;
  }, [monthEntries]);

  const monthBySentiment = useMemo(() => {
    const map: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    for (const e of monthEntries) map[e.sentiment]++;
    return map;
  }, [monthEntries]);

  const logFeedback = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("No site selected");
      if (!description.trim()) throw new Error("Description is required");
      const { error } = await supabase.from("feedback_entries").insert({
        site_id: siteId,
        organisation_id: organisationId,
        logged_by: userId,
        feedback_date: feedbackDate,
        source,
        category,
        sentiment,
        description: description.trim(),
        action_taken: actionTaken.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feedback logged");
      queryClient.invalidateQueries({ queryKey: ["feedback_entries", siteId] });
      setShowLog(false);
      setDescription(""); setActionTaken("");
      setSource("in_person"); setCategory("food_quality"); setSentiment("neutral");
      setFeedbackDate(todayStr);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveEntry = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const { error } = await supabase
        .from("feedback_entries")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          action_taken: action.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as resolved");
      queryClient.invalidateQueries({ queryKey: ["feedback_entries", siteId] });
      setResolvingId(null);
      setResolveAction("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderEntry = (e: FeedbackRow) => {
    const Icon = SENTIMENTS.find(s => s.value === e.sentiment)?.icon || Meh;
    return (
      <motion.div
        key={e.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-border rounded-lg p-3 space-y-2 bg-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={sentimentClasses(e.sentiment)}>
              <Icon className="h-3 w-3 mr-1" />
              {SENTIMENTS.find(s => s.value === e.sentiment)?.label}
            </Badge>
            <Badge variant="secondary">{CATEGORY_LABEL[e.category]}</Badge>
            <span className="text-xs text-muted-foreground">{SOURCE_LABEL[e.source]}</span>
          </div>
          <div className="text-xs text-muted-foreground shrink-0">
            {format(parseISO(e.feedback_date), "d MMM")}
          </div>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{e.description}</p>
        {e.action_taken && (
          <div className="text-xs bg-muted/40 rounded px-2 py-1.5 border-l-2 border-primary">
            <span className="font-semibold text-foreground">Action: </span>
            <span className="text-muted-foreground">{e.action_taken}</span>
          </div>
        )}
        {!e.resolved && isSupervisorPlus && (
          resolvingId === e.id ? (
            <div className="space-y-2 pt-1">
              <Textarea
                value={resolveAction}
                onChange={(ev) => setResolveAction(ev.target.value)}
                placeholder="Action taken (optional)"
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => resolveEntry.mutate({ id: e.id, action: resolveAction || e.action_taken || "" })}
                  disabled={resolveEntry.isPending}
                >
                  {resolveEntry.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                  Confirm Resolve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setResolvingId(null); setResolveAction(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setResolvingId(e.id); setResolveAction(e.action_taken || ""); }}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Mark Resolved
            </Button>
          )
        )}
        {e.resolved && e.resolved_at && (
          <div className="text-xs text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Resolved {format(parseISO(e.resolved_at), "d MMM, HH:mm")}
          </div>
        )}
      </motion.div>
    );
  };

  const maxCatCount = Math.max(1, ...Array.from(monthByCategory.values()));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareHeart className="h-7 w-7 text-primary" />
            Customer Feedback
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Log and track customer feedback to spot patterns and improve service.
          </p>
        </div>
        <Button onClick={() => setShowLog(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Log Feedback
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "list" | "summary")}>
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="list">Feedback</TabsTrigger>
          <TabsTrigger value="summary">This Month</TabsTrigger>
        </TabsList>

        {/* LIST */}
        <TabsContent value="list" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-primary" />
                  Open
                </CardTitle>
                <Badge variant="secondary" className="font-semibold">
                  {openEntries.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : openEntries.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No open feedback. Nice work.
                </div>
              ) : (
                <div className="space-y-2">{openEntries.map(renderEntry)}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Resolved
                </CardTitle>
                <Badge variant="secondary" className="font-semibold">
                  {resolvedEntries.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {resolvedEntries.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Nothing resolved yet.
                </div>
              ) : (
                <div className="space-y-2">{resolvedEntries.slice(0, 20).map(renderEntry)}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUMMARY */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {format(new Date(), "MMMM yyyy")} Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                  Sentiment
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SENTIMENTS.map(s => {
                    const Icon = s.icon;
                    const count = monthBySentiment[s.value];
                    return (
                      <div key={s.value} className={`p-3 rounded-lg border ${sentimentClasses(s.value)}`}>
                        <Icon className="h-4 w-4 mb-1" />
                        <div className="text-xs">{s.label}</div>
                        <div className="font-heading font-bold text-xl">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                  By Category
                </div>
                {monthEntries.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    No feedback logged this month yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {CATEGORIES.map(cat => {
                      const count = monthByCategory.get(cat.value) || 0;
                      if (count === 0) return null;
                      const pct = (count / maxCatCount) * 100;
                      return (
                        <div key={cat.value} className="flex items-center gap-3">
                          <div className="w-32 text-xs text-muted-foreground">{cat.label}</div>
                          <div className="flex-1 h-7 rounded-md bg-muted/40 overflow-hidden relative">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4 }}
                              className="h-full bg-primary/80"
                            />
                            <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                              {count}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* LOG DIALOG */}
      <Dialog open={showLog} onOpenChange={setShowLog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Log Feedback</DialogTitle>
            <DialogDescription>Capture customer feedback to track and respond to.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={feedbackDate}
                onChange={(e) => setFeedbackDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="source">Source</Label>
                <Select value={source} onValueChange={(v) => setSource(v as Source)}>
                  <SelectTrigger id="source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Sentiment</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {SENTIMENTS.map(s => {
                  const Icon = s.icon;
                  const selected = sentiment === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSentiment(s.value)}
                      className={`p-2 rounded-md border flex flex-col items-center gap-1 text-xs transition ${
                        selected ? sentimentClasses(s.value) : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did the customer say?"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="action">Action taken (optional)</Label>
              <Textarea
                id="action"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="How was this addressed, if at all?"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLog(false)}>Cancel</Button>
            <Button onClick={() => logFeedback.mutate()} disabled={logFeedback.isPending}>
              {logFeedback.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Log Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerFeedback;
