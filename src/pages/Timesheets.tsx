import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Sparkles } from "lucide-react";

export default function Timesheets() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-8 w-8 text-primary" />
        <h1 className="font-heading text-3xl font-bold">Timesheets</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-success" />
            Coming soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2">
          <p>Track clock-ins, breaks, and total hours worked per shift — included in your Base plan.</p>
          <p className="text-sm">We're finishing this module. It will appear here automatically once released.</p>
        </CardContent>
      </Card>
    </div>
  );
}
