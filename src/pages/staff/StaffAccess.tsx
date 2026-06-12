import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Headset, Loader2, ShieldAlert, ShieldPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface Assignment {
  id: string;
  staff_user_id: string;
  organisation_id: string;
  organisation_name: string;
  access_level: string;
  reason: string;
  granted_at: string;
  expires_at: string | null;
}

interface OrgOption { id: string; name: string; slug: string | null; subscription_status: string | null }

const ACCESS_LEVELS = ["support", "onboarding", "billing", "engineering"] as const;

export default function StaffAccess() {
  const { isSuperAdmin, loading: saLoading } = useSuperAdmin();
  const { user } = useAuth();
  const { startImpersonation } = useImpersonation();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Grant form
  const [staffEmail, setStaffEmail] = useState("");
  const [orgId, setOrgId] = useState("");
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [accessLevel, setAccessLevel] = useState<typeof ACCESS_LEVELS[number]>("support");
  const [reason, setReason] = useState("");
  const [granting, setGranting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: rows, error: rowsErr }, { data: orgRows, error: orgErr }] = await Promise.all([
      sb.rpc("staff_list_org_assignments"),
      // Staff-gated SECURITY DEFINER listing — direct table reads are blocked by
      // tenant RLS for internal staff (they have no customer org membership).
      sb.rpc("staff_list_all_organisations"),
    ]);
    if (rowsErr) toast.error(rowsErr.message);
    if (orgErr) {
      console.error("[StaffAccess] organisation list failed:", orgErr.message);
      toast.error(`Couldn't load organisations: ${orgErr.message}`);
    }
    setAssignments((rows ?? []) as Assignment[]);
    setOrgs((orgRows ?? []) as OrgOption[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (isSuperAdmin) void refresh(); }, [isSuperAdmin, refresh]);

  if (saLoading) return null;
  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
          <h2 className="font-heading font-semibold">Super admin only</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Only platform super admins can manage staff access assignments.
          </p>
        </CardContent>
      </Card>
    );
  }

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim() || !orgId || !reason.trim()) {
      toast.error("Email, organisation, and reason are required.");
      return;
    }
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    setGranting(true);

    // Look up the staff user by email via super_admins or internal_staff_roles join.
    // We only allow granting to users who already exist in internal_staff_roles
    // (you must add them to internal staff first via the database).
    const { data: matches, error: matchErr } = await sb.rpc("staff_list_internal_staff");
    if (matchErr) {
      setGranting(false);
      toast.error(matchErr.message);
      return;
    }
    const staff = (matches as Array<{ user_id: string; email: string | null }>)
      .find(s => (s.email ?? "").toLowerCase() === staffEmail.trim().toLowerCase());
    if (!staff) {
      setGranting(false);
      toast.error("That email isn't an active internal staff member. Add them to internal_staff_roles first.");
      return;
    }

    const { error: insErr } = await sb.from("staff_org_access").insert({
      staff_user_id: staff.user_id,
      organisation_id: orgId,
      access_level: accessLevel,
      reason: reason.trim(),
    });
    setGranting(false);
    if (insErr) {
      if (/duplicate key/i.test(insErr.message)) {
        toast.error("That staff member already has active access to this organisation.");
      } else {
        toast.error(insErr.message);
      }
      return;
    }
    toast.success(`Granted ${accessLevel} access.`);
    setStaffEmail(""); setOrgId(""); setReason(""); setAccessLevel("support");
    await refresh();
  };

  const revoke = async (a: Assignment) => {
    if (!confirm(`Revoke ${a.access_level} access to ${a.organisation_name}?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await sb.from("staff_org_access")
      .update({ revoked_at: new Date().toISOString(), revoked_by: user?.id ?? null })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Access revoked.");
    await refresh();
  };

  const impersonate = async (a: Assignment) => {
    setImpersonatingId(a.id);
    const res = await startImpersonation({
      organisationId: a.organisation_id,
      reason: `Support session via assignment: ${a.reason}`,
      returnTo: "/staff/access",
    });
    setImpersonatingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Support mode started for ${a.organisation_name}.`);
    // Full reload so all customer-context providers initialise cleanly.
    window.location.assign("/");
  };



  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Staff Access Management</h1>
        <p className="text-sm text-muted-foreground">
          Grant internal staff per-organisation access. Super-admin bypass means you don't need
          a row for yourself. All actions require a reason and are auditable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grant access</CardTitle>
          <CardDescription>
            The staff member must already exist in <code>internal_staff_roles</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={grant} className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-email">Staff email</Label>
              <Input id="g-email" type="email" value={staffEmail}
                onChange={e => setStaffEmail(e.target.value)} placeholder="alex@miseos.app" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-org">Organisation</Label>
              <Popover open={orgPickerOpen} onOpenChange={setOrgPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="g-org"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={orgPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !orgId && "text-muted-foreground")}>
                      {orgId
                        ? orgs.find(o => o.id === orgId)?.name ?? "Choose an organisation…"
                        : "Choose an organisation…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const o = orgs.find(x => x.id === value);
                      const haystack = `${o?.name ?? ""} ${o?.slug ?? ""}`.toLowerCase();
                      return haystack.includes(search.toLowerCase()) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Search by name or slug…" />
                    <CommandList>
                      <CommandEmpty>
                        {orgs.length === 0
                          ? "No customer organisations available. Check query filters or organisation status."
                          : "No organisation matches your search."}
                      </CommandEmpty>
                      <CommandGroup>
                        {orgs.map(o => (
                          <CommandItem
                            key={o.id}
                            value={o.id}
                            onSelect={() => { setOrgId(o.id); setOrgPickerOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4 shrink-0", orgId === o.id ? "opacity-100" : "opacity-0")} />
                            <div className="min-w-0">
                              <p className="truncate text-sm">{o.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {o.slug ?? "no slug"}
                                {o.subscription_status ? ` · ${o.subscription_status}` : ""}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!loading && orgs.length === 0 && (
                <p className="text-xs text-warning">
                  No customer organisations available. Check query filters or organisation status.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-level">Access level</Label>
              <Select value={accessLevel} onValueChange={v => setAccessLevel(v as typeof ACCESS_LEVELS[number])}>
                <SelectTrigger id="g-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="g-reason">Reason (min 5 chars)</Label>
              <Textarea id="g-reason" value={reason} onChange={e => setReason(e.target.value)}
                rows={2} placeholder="e.g. Onboarding new bakery — week of 12 May" required />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={granting}>
                {granting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldPlus className="h-4 w-4 mr-2" />}
                Grant access
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active assignments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No active assignments.</p>
          ) : (
            <div className="divide-y">
              {assignments.map(a => {
                const expired = !!a.expires_at && new Date(a.expires_at).getTime() <= Date.now();
                const canImpersonate = !expired && (isSuperAdmin || a.staff_user_id === user?.id);
                return (
                  <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{a.organisation_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <code className="mr-2">
                          {a.staff_user_id === user?.id ? "you" : `${a.staff_user_id.slice(0, 8)}…`}
                        </code>
                        <Badge variant="secondary" className="mr-2 text-[10px]">{a.access_level}</Badge>
                        Granted {format(new Date(a.granted_at), "PP")}
                        {a.expires_at && ` · expires ${format(new Date(a.expires_at), "PP")}`}
                        {expired && " · expired"}
                      </p>
                      <p className="text-xs text-muted-foreground italic mt-0.5">{a.reason}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canImpersonate || impersonatingId === a.id}
                        onClick={() => void impersonate(a)}
                      >
                        {impersonatingId === a.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          : <Headset className="h-3.5 w-3.5 mr-1.5" />}
                        Impersonate
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void revoke(a)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
