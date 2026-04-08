import { Settings as SettingsIcon } from "lucide-react";

const Settings = () => (
  <div className="p-4 md:p-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
        <SettingsIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Temperature limits, templates, and configuration</p>
      </div>
    </div>
    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      <SettingsIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Coming soon</p>
      <p className="text-sm">Temperature limits, cleaning templates, approval workflows</p>
    </div>
  </div>
);

export default Settings;
