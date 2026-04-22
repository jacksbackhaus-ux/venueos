import { Loader2 } from "lucide-react";

interface FullScreenLoaderProps {
  message?: string;
}

export function FullScreenLoader({ message }: FullScreenLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}