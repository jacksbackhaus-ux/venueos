import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

const MCP_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

type Activity = {
  id: string; tool_name: string; outcome: string; client_name: string | null;
  actor_email: string | null; created_at: string; error_message: string | null;
};

const steps = [
  { name: "Claude", text: "Settings → Connectors → Add custom connector. Paste the address, then sign in to MiseOS when asked." },
  { name: "ChatGPT", text: "Settings → Connectors (developer mode) → Create. Paste the address and choose OAuth sign-in." },
  { name: "Copilot / Cursor / others", text: "Add a new MCP server using the address above. You'll be asked to sign in to MiseOS." },
];

export function ConnectedAppsSection({ organisationId, canManage }: { organisationId: string | null; canManage: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("mcp_settings").select("enabled").eq("organisation_id", organisationId).maybeSingle(),
      supabase.from("mcp_activity_log")
        .select("id, tool_name, outcome, client_name, actor_email, created_at, error_message")
        .eq("organisation_id", organisationId).order("created_at", { ascending: false }).limit(25),
    ]);
    setEnabled(s ? s.enabled : true);
    setActivity((a as Activity[]) ?? []);
  }, [organisationId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (value: boolean) => {
    if (!organisationId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("mcp_settings").upsert({
      organisation_id: organisationId, enabled: value,
      updated_at: new Date().toISOString(), updated_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error("Couldn't save: " + error.message); return; }
    setEnabled(value);
    toast.success(value ? "AI assistants turned on" : "AI assistants turned off for your organisation");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Connect an AI assistant</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect Claude, ChatGPT or Copilot to MiseOS so you can log checks and ask questions in chat.
            Each person connects their own account and only sees what they can already see in MiseOS. Nothing can be deleted.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={MCP_URL} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copy connection address">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="space-y-2">
            {steps.map(s => (
              <div key={s.name} className="rounded-md border p-3">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="text-sm font-medium">Allow AI assistants for this organisation</p>
            <p className="text-xs text-muted-foreground">
              {canManage ? "Turning this off blocks every assistant straight away." : "Only owners and managers can change this."}
            </p>
          </div>
          <Switch checked={enabled} disabled={!canManage || saving} onCheckedChange={toggle} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent assistant activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assistant activity yet.</p>
          ) : (
            <ul className="divide-y">
              {activity.map(a => (
                <li key={a.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{a.tool_name.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.actor_email ?? "Unknown user"}{a.client_name ? ` · ${a.client_name}` : ""} · {new Date(a.created_at).toLocaleString("en-GB")}
                    </p>
                    {a.error_message && <p className="text-xs text-destructive truncate">{a.error_message}</p>}
                  </div>
                  <Badge variant={a.outcome === "success" ? "secondary" : "destructive"}>{a.outcome}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
