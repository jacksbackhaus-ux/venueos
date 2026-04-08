import { Bug } from "lucide-react";

const PestMaintenance = () => (
  <div className="p-4 md:p-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Bug className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Pest Control & Maintenance</h1>
        <p className="text-sm text-muted-foreground">Sightings, preventative checks, and service logs</p>
      </div>
    </div>
    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      <Bug className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Coming soon</p>
      <p className="text-sm">Pest sighting reports, maintenance log with photo uploads</p>
    </div>
  </div>
);

export default PestMaintenance;
