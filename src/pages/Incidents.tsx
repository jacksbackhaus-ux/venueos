import { AlertTriangle } from "lucide-react";

const Incidents = () => (
  <div className="p-4 md:p-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
        <AlertTriangle className="h-5 w-5 text-warning" />
      </div>
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Incidents & Corrective Actions</h1>
        <p className="text-sm text-muted-foreground">Issue tracking, root cause, and follow-up</p>
      </div>
    </div>
    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Coming soon</p>
      <p className="text-sm">Central issue register with corrective actions and trend analysis</p>
    </div>
  </div>
);

export default Incidents;
