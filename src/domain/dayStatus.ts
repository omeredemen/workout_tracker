import type { IsoDate, ScheduledDay } from "./types";

export type DayStatus =
  "rest" | "completed" | "skipped" | "in_progress" | "missed" | "planned";

/** How a scheduled day looks on the calendar, given its session (if any) and today's date. */
export function dayStatus(
  day: Pick<ScheduledDay, "date" | "dayKey">,
  session:
    { status: "in_progress" | "completed" | "skipped" } | null | undefined,
  today: IsoDate,
): DayStatus {
  if (day.dayKey === null) return "rest";
  if (session) return session.status;
  return day.date < today ? "missed" : "planned";
}
