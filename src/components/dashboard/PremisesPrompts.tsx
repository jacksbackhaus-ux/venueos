import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { X, ShieldCheck, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import {
  KITCHEN_SETUP_ITEMS, dismissPrompt, promptDismissed, isSmallScale,
  type KitchenSetupAnswers,
} from "@/lib/premises";

/**
 * Two dismissible, device-local dashboard nudges for small-scale premises:
 *   1. Council registration missing (home / mobile).
 *   2. Kitchen setup incomplete after 7 days (home only).
 * Each shows once and never returns after dismissal.
 */
export function PremisesPrompts() {
  const { currentSite, premisesType } = useSite();
  const navigate = useNavigate();
  const siteId = currentSite?.id;
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [needsKitchen, setNeedsKitchen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    if (!siteId || !isSmallScale(premisesType)) {
      setNeedsRegistration(false);
      setNeedsKitchen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [regRes, kitchenRes] = await Promise.all([
        supabase.from("site_registrations" as any).select("local_authority_name").eq("site_id", siteId).maybeSingle(),
        premisesType === "home"
          ? supabase.from("site_kitchen_setup" as any).select("items, completed_at").eq("site_id", siteId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (cancelled) return;

      const reg = regRes.data as any;
      setNeedsRegistration(
        !promptDismissed("registration", siteId) && !reg?.local_authority_name,
      );

      if (premisesType === "home" && currentSite?.created_at) {
        const ageDays = differenceInDays(new Date(), new Date(currentSite.created_at));
        const items = ((kitchenRes.data as any)?.items ?? {}) as KitchenSetupAnswers;
        const done = KITCHEN_SETUP_ITEMS.filter((i) => items[i.key]?.checked).length;
        setNeedsKitchen(
          ageDays >= 7 &&
          done < KITCHEN_SETUP_ITEMS.length &&
          !promptDismissed("kitchen_setup", siteId),
        );
      }
    })();
    return () => { cancelled = true; };
  }, [siteId, premisesType, currentSite?.created_at]);

  const hide = (key: string) => {
    if (siteId) dismissPrompt(key, siteId);
    setHidden((h) => [...h, key]);
  };

  const prompts = [
    needsRegistration && !hidden.includes("registration") && {
      key: "registration",
      icon: <ShieldCheck className="h-4 w-4 text-primary" />,
      text: "Add your council registration — the first thing an inspector asks for.",
      cta: "Add details",
    },
    needsKitchen && !hidden.includes("kitchen_setup") && {
      key: "kitchen_setup",
      icon: <Home className="h-4 w-4 text-primary" />,
      text: "Finish your kitchen setup check — it goes straight into your Inspection Pack.",
      cta: "Finish check",
    },
  ].filter(Boolean) as { key: string; icon: JSX.Element; text: string; cta: string }[];

  if (prompts.length === 0) return null;

  return (
    <div className="space-y-2">
      {prompts.map((p) => (
        <Card key={p.key} className="flex items-center gap-3 border-primary/20 bg-primary/5 p-3">
          <span className="shrink-0">{p.icon}</span>
          <p className="min-w-0 flex-1 text-sm text-foreground">{p.text}</p>
          <Button size="sm" variant="secondary" className="shrink-0" onClick={() => navigate("/settings?tab=site")}>
            {p.cta}
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => hide(p.key)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </Card>
      ))}
    </div>
  );
}
