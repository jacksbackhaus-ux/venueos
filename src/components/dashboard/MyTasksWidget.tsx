import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, CalendarDays, ChevronRight, AlertCircle } from "lucide-react";
import { useMyMessengerTasks } from "@/hooks/useMessengerTasks";
import { useModuleAccess } from "@/hooks/useModuleAccess";

export function MyTasksWidget() {
  const navigate = useNavigate();
  const { isActive } = useModuleAccess();
  const { tasks, loading } = useMyMessengerTasks();

  if (!isActive("messenger")) return null;
  if (loading) return null;
  if (tasks.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            My tasks
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y -mx-2">
          {tasks.slice(0, 6).map((t) => {
            const overdue = t.due_date && t.due_date < today;
            const onClick = () => {
              if (t.channel_id) navigate(`/messenger?channel=${t.channel_id}`);
              else navigate("/messenger");
            };
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={onClick}
                  className="w-full flex items-center gap-3 py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {t.channel_name && <span>#{t.channel_name}</span>}
                      {t.due_date && (
                        <span className={`inline-flex items-center gap-1 ${overdue ? "text-breach" : ""}`}>
                          <CalendarDays className="h-3 w-3" />
                          {new Date(`${t.due_date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          {overdue && <AlertCircle className="h-3 w-3" />}
                        </span>
                      )}
                      {t.priority === "high" && (
                        <span className="text-breach font-semibold uppercase tracking-wide">High</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
