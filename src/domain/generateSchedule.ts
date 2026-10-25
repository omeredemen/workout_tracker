import { addDays, getDay, isMonday } from "date-fns";
import { parseIsoDate, toIsoDate } from "./dates";
import type { IsoDate, Program, ScheduledDay, Weekday } from "./types";

// date-fns getDay(): 0 = Sunday.
const WEEKDAY_BY_INDEX: Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/**
 * Expands a program into one entry per calendar day from `startDate` (a Monday).
 * The calendar is fixed: missed workouts stay on their date.
 */
export function generateSchedule(
  program: Program,
  startDate: IsoDate,
): ScheduledDay[] {
  const start = parseIsoDate(startDate);
  if (!isMonday(start)) {
    throw new Error(`Start date ${startDate} is not a Monday`);
  }

  const days: ScheduledDay[] = [];
  for (let i = 0; i < program.durationWeeks * 7; i++) {
    const date = addDays(start, i);
    const week = Math.floor(i / 7) + 1;
    days.push({
      date: toIsoDate(date),
      week,
      phaseId: phaseForWeek(program, week).id,
      dayKey: program.weeklySchedule[WEEKDAY_BY_INDEX[getDay(date)]!],
    });
  }
  return days;
}

export function phaseForWeek(program: Program, week: number) {
  const phase = program.phases.find(
    (p) => week >= p.weeks.from && week <= p.weeks.to,
  );
  if (!phase) throw new Error(`No phase covers week ${week}`);
  return phase;
}
