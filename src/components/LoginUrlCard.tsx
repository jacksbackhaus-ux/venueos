import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Check, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildOrgLoginUrl } from "@/lib/publicAppUrl";

interface Props {
  organisationId: string;
}

/**
 * Shows the org-specific login URL with copy + QR code.
 * Pulls the current slug from the organisations table at mount and
 * backfills it from the org name if it's missing (slug trigger normalises).
 */
export function LoginUrlCard({ organisationId }: Props) {
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!organisationId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("organisations")
        .select("slug, name")
        .eq("id", organisationId)
        .maybeSingle();
      let s = (data as any)?.slug as string | null | undefined;
      if (!s && (data as any)?.name) {
        // Trigger normalises whatever we send into a unique slug.
        const { data: updated } = await supabase
          .from("organisations")
          .update({ slug: (data as any).name } as any)
          .eq("id", organisationId)
          .select("slug")
          .maybeSingle();
        s = (updated as any)?.slug ?? null;
      }
      if (cancelled) return;
      setSlug(s ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [organisationId]);

  if (loading || !slug) return null;

  const url = buildOrgLoginUrl(slug);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Login URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy manually.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Your Login Page
        </CardTitle>
        <CardDescription>
          Share this URL with your team so they always land on your branded sign-in page.
          They can bookmark it on their phone or scan the QR code below.
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
            {copied ? "Copied" : "Copy URL"}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="rounded-lg border border-border bg-background p-3 shrink-0">
            <QRCodeSVG value={url} size={132} level="M" includeMargin={false} />
          </div>
          <div className="text-sm text-muted-foreground space-y-2 flex-1">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <QrCode className="h-4 w-4" /> How staff use this
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
              <li>Bookmark the URL on their phone's home screen</li>
              <li>Scan the QR code to open it instantly</li>
              <li>They'll then enter their <strong>Site ID</strong> and <strong>Staff ID</strong> to log in</li>
              <li>Managers sign in with email + password on the same page</li>
            </ul>
            <p className="text-[11px] pt-1">
              Your URL identifier is <span className="font-mono text-foreground">{slug}</span>. It's set once at signup and can't be changed in this version.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
