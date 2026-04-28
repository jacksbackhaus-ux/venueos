import { useEffect, useState } from "react";
import { Lock, Eye, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  userKey: string | null | undefined;
}

const STORAGE_PREFIX = "messenger_disclosure_seen:";

export function MessengerDisclosureModal({ userKey }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userKey) return;
    const seen = localStorage.getItem(`${STORAGE_PREFIX}${userKey}`);
    if (!seen) setOpen(true);
  }, [userKey]);

  const handleConfirm = () => {
    if (userKey) {
      localStorage.setItem(`${STORAGE_PREFIX}${userKey}`, new Date().toISOString());
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleConfirm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-heading">Welcome to Messenger</DialogTitle>
          <DialogDescription className="text-center">
            A quick note about how this workplace tool works.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <MessageIcon />
            <div className="text-sm">
              <p className="font-medium">A workplace communication tool</p>
              <p className="text-muted-foreground">
                Use Messenger to chat with your team about shifts, tasks and day-to-day operations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Encrypted in transit and at rest</p>
              <p className="text-muted-foreground">
                Messages are protected with industry-standard encryption.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">May be reviewed by management</p>
              <p className="text-muted-foreground">
                Messages may be accessed by management for compliance and HR purposes.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm} className="w-full">
            I understand, take me to Messenger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageIcon() {
  return (
    <svg className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
