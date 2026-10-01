import { addDaysISO, daysBetweenISO, siteNow } from "@/lib/mcp/helpers";

export type ScheduleState = "complete" | "missing" | "unknown" | "exempt" | "pending";
export type CleaningFrequency = "daily" | "weekly" | "monthly";

export interface SchedulePeriod {
  effective_from: string;
  effective_to: string | null;
  scheduled: boolean;
}

export interface TemperatureScheduleVersion extends SchedulePeriod {
  temp_unit_id: string;
  expected_check_types: string[];
}

export interface CleaningScheduleVersion extends SchedulePeriod {
  cleaning_task_id: string;
  frequency: CleaningFrequency | string;
  due_time: string | null;
}

export interface ScheduleLog {
  parentId: string;
  date: string;
  kind?: string;
  done?: boolean;
}

export interface ScheduleDayBasis {
  date: string;
  closed: boolean;
  productionDay: boolean;
}

export interface ScheduleOccurrence {
  parentId: string;
  date: string;
  kind: string;
  state: ScheduleState;
}

export interface MissedScheduleInput {
  from: string;
  to: string;
  cutoverDate: string;
  timezone: string;
  operatingMode: "scheduled" | "on_demand";
  temperatureVersions: TemperatureScheduleVersion[];
  cleaningVersions: CleaningScheduleVersion[];
  temperatureLogs: ScheduleLog[];
  cleaningLogs: ScheduleLog[];
  dayBasis: ScheduleDayBasis[];
  now?: Date;
}

function periodAt<T extends SchedulePeriod>(versions: T[], date: string): T | undefined {
  return versions.find((version) =>
    version.scheduled && version.effective_from <= date && (!version.effective_to || date < version.effective_to),
  );
}

function weekStart(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDaysISO(date, -(day === 0 ? 6 : day - 1));
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function bucketStart(date: string, frequency: string): string {
  if (frequency === "weekly") return weekStart(date);
  if (frequency === "monthly") return monthStart(date);
  return date;
}

function dueMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function dateState(date: string, input: MissedScheduleInput): ScheduleState | null {
  if (date < input.cutoverDate) return "unknown";
  const basis = input.dayBasis.find((day) => day.date === date);
  if (basis?.closed) return "exempt";
  if (input.operatingMode === "on_demand" && !basis?.productionDay) return "exempt";
  return null;
}

function elapsed(date: string, due: number | null, input: MissedScheduleInput): boolean {
  const now = siteNow(input.timezone, input.now);
  if (date < now.dateISO) return true;
  if (date > now.dateISO) return false;
  return due === null || now.minutes >= due;
}

export function calculateMissedSchedule(input: MissedScheduleInput): ScheduleOccurrence[] {
  const result: ScheduleOccurrence[] = [];
  const temperatureIds = [...new Set(input.temperatureVersions.map((version) => version.temp_unit_id))];
  const cleaningIds = [...new Set(input.cleaningVersions.map((version) => version.cleaning_task_id))];

  for (let date = input.from; date <= input.to; date = addDaysISO(date, 1)) {
    const baseState = dateState(date, input);

    for (const parentId of temperatureIds) {
      const version = periodAt(input.temperatureVersions.filter((item) => item.temp_unit_id === parentId), date);
      if (!version && date >= input.cutoverDate) continue;
      const kinds = version?.expected_check_types ?? ["AM Check", "PM Check"];
      for (const kind of kinds) {
        const found = input.temperatureLogs.some((log) =>
          log.parentId === parentId && log.date === date && log.kind === kind,
        );
        const defaultDue = kind === "AM Check" ? 11 * 60 : kind === "PM Check" ? 18 * 60 : null;
        result.push({
          parentId,
          date,
          kind,
          state: baseState ?? (found ? "complete" : elapsed(date, defaultDue, input) ? "missing" : "pending"),
        });
      }
    }

    for (const parentId of cleaningIds) {
      const versions = input.cleaningVersions.filter((item) => item.cleaning_task_id === parentId);
      const version = periodAt(versions, date);
      if (!version && date >= input.cutoverDate) continue;
      const frequency = version?.frequency ?? "daily";
      const start = bucketStart(date, frequency);
      if (start !== date) continue;
      const bucketDays = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : daysBetweenISO(start, addDaysISO(monthStart(addDaysISO(date, 32)), 0));
      const end = addDaysISO(start, Math.max(0, bucketDays - 1));
      const done = input.cleaningLogs.some((log) =>
        log.parentId === parentId && log.done !== false && log.date >= start && log.date <= end,
      );
      const bucketBasis = input.dayBasis.filter((day) => day.date >= start && day.date <= end);
      const hasExpectedDay = bucketBasis.some((day) =>
        !day.closed && (input.operatingMode !== "on_demand" || day.productionDay),
      );
      const state = start < input.cutoverDate
        ? "unknown"
        : !hasExpectedDay
          ? "exempt"
          : done
            ? "complete"
            : elapsed(end, dueMinutes(version?.due_time ?? null), input)
              ? "missing"
              : "pending";
      result.push({ parentId, date: start, kind: frequency, state });
    }
  }

  return result;
}
