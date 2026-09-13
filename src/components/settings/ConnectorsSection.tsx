import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Bot, Copy, Check, Loader2, ShieldCheck, ShieldOff, ScrollText, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MCP_PATH = "/functions/v1/mcp";

function connectionUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  return `${base}${MCP_PATH}`;
}

/** "log_temperature" -> "Log temperature" */
function humanizeToolName(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

interface ActivityRow {
  id: string;
  tool_name: string;
  outcome: string;
  error_message: string | null;
  created_at: string;
  actor_email: string | null;
  client_name: string | null;
  site_id: string | null;
  sites: { name: string } | null;
}

/**
 * Settings → Connectors.
 *
 * Everything here reads through the same tables the MCP server itself uses
 * (mcp_settings, mcp_activity_log) and their existing RLS — there is no
 * separate permission model for this screen. The whole Settings page already
 * requires a manager to reach it (RoleGuard require="viewSettings"), so this
 * only needs one further distinction: `canManage` mirrors the database's own
 * check for who may flip the org switch (is_org_owner_or_hq_admin) — an org
 * owner or HQ admin. The activity log itself needs no extra gating here: its
 * own RLS already returns the whole organisation's activity to a manager and
 * only the caller's own entries to anyone else.
 */
export function ConnectorsSection({ canManage }: { canManage: boolean }) {
  const { organisationId } = useSite();
  const { appUser } = useAuth();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const url = connectionUrl();

  const settingsQ = useQuery({
    queryKey: ["mcp-settings", organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_settings")
        .select("enabled, updated_at")
        .eq("organisation_id", organisationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // No row yet means every call is still allowed — the MCP wrapper only
  // blocks when a row exists with enabled = false. Mirror that here so the
  // switch reads "on" for an org that has never touched this setting.
  const enabled = settingsQ.data?.enabled ?? true;

  const setEnabled = useMutation({
    mutationFn: async (next: boolean) => {
      if (!organisationId) throw new Error("No organisation");
      const { error } = await supabase
        .from("mcp_settings")
        .upsert(
          { organisation_id: organisationId, enabled: next, updated_by: appUser?.id ?? null },
          { onConflict: "organisation_id" },
        );
      if (error) throw error;
    },
    onSuccess: (_void, next) => {
      qc.invalidateQueries({ queryKey: ["mcp-settings", organisationId] });
      toast.success(next ? "AI assistant access turned on" : "AI assistant access turned off");
    },
    onError: (e: any) => toast.error(e?.message || "Could not update this setting."),
  });

  const activityQ = useQuery({
    queryKey: ["mcp-activity", organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_activity_log")
        .select("id, tool_name, outcome, error_message, created_at, actor_email, client_name, site_id, sites(name)")
        .eq("organisation_id", organisationId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as ActivityRow[];
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Connection address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy manually.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect Claude, ChatGPT, Copilot or another AI assistant to MiseOS so you can log checks and
        ask questions in chat. Each person connects their own MiseOS account and signs in the normal
        way — the assistant only ever sees and does what that person could already see and do in the
        app, and every action it takes is recorded below.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {enabled ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
            AI assistant access
          </CardTitle>
          <CardDescription>
            Turning this off refuses every assistant action for your whole organisation immediately,
            whoever connected them. It does not disconnect anyone — turning it back on restores
            access straight away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{enabled ? "Assistants can connect" : "Assistants are blocked"}</p>
                {!canManage && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Lock className="h-3 w-3" /> Only the account owner can change this.
                  </p>
                )}
              </div>
              <Switch
                checked={enabled}
                disabled={!canManage || setEnabled.isPending}
                onCheckedChange={(next) => setEnabled.mutate(next)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" /> Connect an assistant
          </CardTitle>
          <CardDescription>
            Give this address to the assistant. It will redirect you to sign in to MiseOS and approve
            access, the same way any other app would.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              readOnly value={url}
              className="font-mono text-sm bg-muted/40"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button onClick={copy} variant="default" className="shrink-0 gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy address"}
            </Button>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="claude">
              <AccordionTrigger className="text-sm">Claude</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Settings → Connectors → Add custom connector → paste the address above → Add. Claude
                will open MiseOS for you to sign in and approve.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="chatgpt">
              <AccordionTrigger className="text-sm">ChatGPT</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Settings → Connectors → Add connector → paste the address above. You'll be sent to
                MiseOS to sign in and approve access.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="other">
              <AccordionTrigger className="text-sm">Copilot, Cursor or another MCP client</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Add a new MCP server using the address above. Most clients support OAuth sign-in
                automatically; if yours asks for an API key instead, it does not support this yet.
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <p className="text-xs text-muted-foreground">
            To disconnect an assistant, remove it from that assistant's own settings — or turn off
            access above to block every assistant for your organisation at once.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Recent activity
          </CardTitle>
          <CardDescription>
            Every action an assistant has taken, newest first — a permanent record that cannot be
            edited or deleted. Managers see this for the whole organisation; everyone else sees
            their own.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (activityQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No assistant activity yet.</p>
          ) : (
            <div className="space-y-1">
              {(activityQ.data ?? []).map((row, i) => (
                <div key={row.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{humanizeToolName(row.tool_name)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.actor_email ?? "Unknown user"}
                        {row.sites?.name ? ` · ${row.sites.name}` : ""}
                        {row.client_name ? ` · ${row.client_name}` : ""}
                      </p>
                      {row.outcome === "error" && row.error_message && (
                        <p className="text-xs text-destructive mt-0.5 truncate">{row.error_message}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] border-transparent",
                          row.outcome === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
                        )}
                      >
                        {row.outcome === "error" ? "Failed" : "Success"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(row.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
