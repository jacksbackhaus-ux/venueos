import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, CheckCircle2, Circle, Loader2, User, AlertCircle } from "lucide-react";
import { useChannelTasks, updateTaskStatus, type MessengerTask } from "@/hooks/useMessengerTasks";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-breach/15 text-breach border-breach/30",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted/50 text-muted-foreground",
};

export function TasksPanel({ open, onOpenChange, channelId }: Props) {
  const { tasks, loading } = useChannelTasks(channelId);
  const { appUser } = useAuth();
  const role = useRole();

  const grouped = useMemo(() => {
    const g: Record<string, MessengerTask[]> = { open: [], in_progress: [], done: [] };
    tasks.forEach((t) => {
      g[t.status]?.push(t);
    });
    return g;
  }, [tasks]);

  const handleSetStatus = async (task: MessengerTask, status: MessengerTask["status"]) => {
    const canEdit = role.isSupervisorPlus || task.assigned_to === appUser?.id;
    if (!canEdit) {
      toast.error("You can only update tasks assigned to you");
      return;
    }
    const { error } = await updateTaskStatus(task.id, status);
    if (error) toast.error(error.message ?? "Failed to update task");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle>Channel tasks</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {loading && (
              <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
            )}
            {!loading && tasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                No tasks yet for this channel.
              </p>
            )}
            {(["open", "in_progress", "done"] as const).map((bucket) => {
              const list = grouped[bucket];
              if (list.length === 0) return null;
              return (
                <section key={bucket}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {STATUS_LABEL[bucket]}
                    </h3>
                    <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
                  </div>
                  <ul className="space-y-2">
                    {list.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        currentUserId={appUser?.id ?? null}
                        canManage={role.isSupervisorPlus}
                        onSetStatus={handleSetStatus}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function TaskRow({
  task,
  currentUserId,
  canManage,
  onSetStatus,
}: {
  task: MessengerTask;
  currentUserId: string | null;
  canManage: boolean;
  onSetStatus: (t: MessengerTask, s: MessengerTask["status"]) => void;
}) {
  const canEdit = canManage || task.assigned_to === currentUserId;
  const overdue =
    task.status !== "done" &&
    task.due_date &&
    task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <li className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.status === "done" ? "line-through opacity-60" : ""}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </div>
        {task.priority !== "normal" && (
          <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <User className="h-3 w-3" />
          {task.assigned_to_name ?? "—"}
        </span>
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 ${overdue ? "text-breach" : ""}`}>
            <CalendarDays className="h-3 w-3" />
            {new Date(`${task.due_date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {overdue && <AlertCircle className="h-3 w-3" />}
          </span>
        )}
      </div>
      {canEdit && task.status !== "done" && (
        <div className="flex gap-1.5 pt-1">
          {task.status === "open" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onSetStatus(task, "in_progress")}
            >
              <Loader2 className="h-3 w-3 mr-1" /> Start
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSetStatus(task, "done")}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark done
          </Button>
        </div>
      )}
      {canEdit && task.status === "done" && canManage && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => onSetStatus(task, "open")}
        >
          <Circle className="h-3 w-3 mr-1" /> Reopen
        </Button>
      )}
    </li>
  );
}
