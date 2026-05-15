import { useRole } from "@/hooks/useRole";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Determines whether the current user can edit records on a given date.
 * - Today: anyone with site write access can edit.
 * - Past day: only managers/owners can edit (retrospectively, tagged + audited).
 */
export function useRetrospective(selectedDate: string) {
  const { isManager } = useRole();
  const today = todayStr();
  const isPast = selectedDate < today;
  const isToday = selectedDate === today;
  const canEdit = isToday || (isPast && isManager);
  const isRetrospective = isPast && isManager;

  return {
    isToday,
    isPast,
    canEdit,
    isRetrospective,
    lockedReason: isPast && !isManager
      ? "Past records are read-only. Ask a manager to make a retrospective edit."
      : null,
  };
}
