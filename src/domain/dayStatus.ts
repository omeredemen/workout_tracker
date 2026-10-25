import type { IsoDate, ScheduledDay } from "./types";

export type DayStatus =
  "rest" | "completed" | "skipped" | "in_progress" | "missed" | "planned";

/** How a scheduled day looks on the calendar, given its session (if any) and today's date. */
export function dayStatus(
  day: Pick<ScheduledDay, "date" | "dayKey">,
  session:
    | { status: "planned" | "in_progress" | "completed" | "skipped" }
    | null
    | undefined,
  today: IsoDate,
): DayStatus {
  if (day.dayKey === null) return "rest";
  // A "planned" session only holds cardio or notes; the workout itself hasn't started.
  if (session && session.status !== "planned") return session.status;
  return day.date < today ? "missed" : "planned";
}
