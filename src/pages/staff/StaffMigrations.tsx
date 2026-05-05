import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Database } from "lucide-react";
import { format } from "date-fns";

interface MigrationRow {
  version: string;
  name: string;
  applied_at_estimate: string;
}

export default function StaffMigrations() {
  const [rows, setRows] = useState<MigrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("staff_list_migrations");
      if (error) setError(error.message);
      setRows((data ?? []) as MigrationRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Database className="h-5 w-5" /> Migration status
        </h1>
        <p className="text-sm text-muted-foreground">
          Read-only view of applied database migrations. SQL execution is not available from this UI by design.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{rows.length} migrations applied</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : error ? (
            <p className="text-sm text-destructive p-6 text-center">{error}</p>
          ) : (
            <div className="divide-y">
              {rows.map(r => (
                <div key={r.version} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs">{r.version}</p>
                    <p className="text-sm font-medium truncate">{r.name || "(unnamed)"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {r.applied_at_estimate ? format(new Date(r.applied_at_estimate), "PP") : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
