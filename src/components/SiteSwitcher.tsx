import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, ChevronDown, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { isManagerRole, siteRoleLabel } from "@/lib/siteRoleLabel";
import { showMultiSiteHQ } from "@/lib/launchFlags";

/**
 * Persistent site switcher. Used in the desktop sidebar header and as a
 * mobile-friendly popover trigger. Shows the current site + role, opens a
 * list of accessible sites (with per-site role) and — when the user has
 * multi-site manager access — pins "All Sites (Overview)" at the top.
 */
export function SiteSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "header" }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { sites, memberships, currentSite, currentMembership, setCurrentSiteId } = useSite();
  const { orgRole } = useAuth();
  const role = useRole();

  const isOrgOwner = orgRole?.org_role === "org_owner";
  const isHQAdmin =
    orgRole?.org_role === "org_owner" ||
    orgRole?.org_role === "hq_admin" ||
    orgRole?.org_role === "hq_auditor";

  const hasManagerAccessSomewhere =
    isHQAdmin || memberships.some((m) => isManagerRole(m.site_role));
  const canSeeAllSites = showMultiSiteHQ && sites.length >= 2 && hasManagerAccessSomewhere;

  const currentRoleLabel = siteRoleLabel(currentMembership?.site_role, { isOrgOwner });

  const handleSelect = (siteId: string) => {
    setCurrentSiteId(siteId);
    setOpen(false);
    navigate("/");
  };

  const handleAllSites = () => {
    setOpen(false);
    navigate("/hq");
  };

  if (!currentSite && sites.length === 0) return null;

  const triggerClass =
    variant === "sidebar"
      ? "w-full flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
      : "flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 max-w-[60%]";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClass} aria-label="Switch site">
          <div
            className={cn(
              "flex items-center justify-center shrink-0",
              variant === "sidebar" ? "h-8 w-8 rounded-md bg-primary/10" : "",
            )}
          >
            <MapPin className={cn("text-primary", variant === "sidebar" ? "h-4 w-4" : "h-3 w-3")} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-semibold text-foreground truncate",
                variant === "sidebar" ? "text-sm" : "text-xs",
              )}
            >
              {currentSite?.name ?? "No site selected"}
            </p>
            {variant === "sidebar" && currentRoleLabel && (
              <p className="text-[10px] text-muted-foreground truncate">
                Working here as {currentRoleLabel}
              </p>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[280px] p-0 max-h-[70vh] overflow-y-auto"
      >
        {currentSite && (
          <div className="px-3 py-2 border-b bg-muted/30">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Currently working at
            </p>
            <p className="text-sm font-semibold text-foreground truncate">
              {currentSite.name}
              {currentRoleLabel && (
                <span className="text-xs font-normal text-muted-foreground"> · {currentRoleLabel}</span>
              )}
            </p>
          </div>
        )}

        {canSeeAllSites && (
          <button
            type="button"
            onClick={handleAllSites}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors border-b"
          >
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">All Sites (Overview)</p>
              <p className="text-[11px] text-muted-foreground">Compliance across your sites</p>
            </div>
          </button>
        )}

        <div className="py-1">
          {sites.map((site) => {
            const m = memberships.find((x) => x.site_id === site.id);
            const label = siteRoleLabel(m?.site_role, { isOrgOwner });
            const active = site.id === currentSite?.id;
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => handleSelect(site.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  active ? "bg-primary/10" : "hover:bg-muted/60",
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                    active ? "bg-primary/20" : "bg-muted",
                  )}
                >
                  <MapPin className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold truncate",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {site.name}
                  </p>
                  {label && (
                    <p className="text-[11px] text-muted-foreground truncate">{label}</p>
                  )}
                </div>
                {active && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        {role.canViewSettings && (
          <div className="border-t px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Manage sites & users →
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
