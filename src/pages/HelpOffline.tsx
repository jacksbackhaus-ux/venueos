import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudOff, Bell, Shield } from "lucide-react";

export default function HelpOffline() {
  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <SEO title="Offline & Notifications — MiseOS" description="How MiseOS works offline and what notifications you can expect." path="/help/offline" />

      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Offline & Notifications</h1>
        <p className="text-sm text-muted-foreground">
          How MiseOS keeps working when your internet drops, and what alerts you’ll receive.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CloudOff className="h-4 w-4" /> Offline mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            You can log <strong>temperatures, cleaning tasks, day-sheet checks, incidents and deliveries</strong> even when you have no signal.
            Each action is saved on this device and a small banner appears at the top of the screen so you know.
          </p>
          <p>
            As soon as your phone or tablet is back online, MiseOS automatically sends the queued actions in the order you logged them.
            Duplicate sends are safe — the server recognises each entry and won’t create a second copy.
          </p>
          <p>
            If something can’t be saved (for example you no longer have permission, or the data is invalid), the banner turns red and the
            item is marked <em>Needs attention</em> so a manager can fix it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>You only see alerts that match your role and the modules turned on at your site:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Temperature breach</strong> — when a fridge or freezer fails its check.</li>
            <li><strong>Missed cleaning</strong> — a scheduled cleaning task wasn’t done on time.</li>
            <li><strong>Missed opening checks</strong> — day-sheet not complete by 11:00 local time.</li>
            <li><strong>Incident updates</strong> — a new incident is logged or its status changes.</li>
            <li><strong>Rota changes</strong> — your shift is added, moved or swapped.</li>
            <li><strong>Margin alerts</strong> (managers only) — recipe costs cross your threshold.</li>
          </ul>
          <p>You can turn each of these on or off in your account settings.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Data on your device</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Offline entries are kept in your browser’s private storage on this device only. They’re cleared automatically once they’ve been
            sent to MiseOS. Nothing about other staff, customers or financials is cached locally beyond what’s needed to keep the screens working.
          </p>
          <p>
            All data is encrypted in transit and at rest on our servers. See our privacy notice for full details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
