"use client";

import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import { useCallback, useState } from "react";
import { parseIsoDate, toIsoDate } from "@/domain/dates";
import { dayStatus, type DayStatus } from "@/domain/dayStatus";
import {
  useActiveProgram,
  useRepoQuery,
  useToday,
  type ActiveProgram,
} from "@/data/hooks";
import type { Repository } from "@/data/repository";
import { ErrorMessage, Loading, Screen } from "@/components/ui/Screen";
import { button, card } from "@/components/ui/styles";
import { statusCell, statusLabel } from "./status";
import { workoutHref } from "@/lib/routes";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEGEND: DayStatus[] = ["completed", "in_progress", "missed", "planned"];

export function CalendarView() {
  const active = useActiveProgram();
  if (active.status === "loading") return <Loading />;
  if (active.status === "error") return <ErrorMessage error={active.error} />;
  if (!active.data) {
    return (
      <Screen title="Calendar">
        <section className={`${card} flex flex-col gap-3`}>
          <p className="text-muted">No program yet.</p>
          <Link href="/programs" className={button.primary}>
            Choose start date
          </Link>
        </section>
      </Screen>
    );
  }
  return <ProgramCalendar active={active.data} />;
}

function ProgramCalendar({ active }: { active: ActiveProgram }) {
  const { program, schedule, enrollment } = active;
  const today = useToday();
  const first = schedule[0]!.date;
  const last = schedule.at(-1)!.date;

  // Open on the current month, or the nearest end of the program.
  const [month, setMonth] = useState(() =>
    startOfMonth(
      parseIsoDate(today < first ? first : today > last ? last : today),
    ),
  );
  const sessions = useRepoQuery(
    useCallback(
      (repo: Repository) => repo.listSessions(enrollment.id),
      [enrollment.id],
    ),
  );
  if (sessions.status === "loading") return <Loading />;
  if (sessions.status === "error")
    return <ErrorMessage error={sessions.error} />;

  const dayByDate = new Map(schedule.map((d) => [d.date, d]));
  const sessionByDate = new Map(sessions.data.map((s) => [s.date, s]));
  const phaseName = new Map(program.phases.map((p) => [p.id, p.name]));

  const weeks: Date[][] = [];
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  for (
    let d = startOfWeek(month, { weekStartsOn: 1 });
    d <= gridEnd;
    d = addDays(d, 7)
  ) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }

  const canGoBack = toIsoDate(month) > first;
  const canGoForward = toIsoDate(endOfMonth(month)) < last;

  return (
    <Screen
      title={format(month, "MMMM yyyy")}
      subtitle={program.name}
      action={
        <div className="flex gap-1">
          <button
            type="button"
            className={button.secondary}
            onClick={() => setMonth(addMonths(month, -1))}
            disabled={!canGoBack}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            className={button.secondary}
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={!canGoForward}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      }
    >
      <div className="text-muted grid grid-cols-7 gap-1.5 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {weeks.map((days) => {
          // The program starts on a Monday, so each row is exactly one program week.
          const programWeek = dayByDate.get(toIsoDate(days[0]!));
          return (
            <div key={toIsoDate(days[0]!)} className="flex flex-col gap-1">
              {programWeek && (
                <p className="text-muted truncate text-xs">
                  <span className="text-foreground font-semibold">
                    Week {programWeek.week}
                  </span>{" "}
                  · {phaseName.get(programWeek.phaseId)}
                </p>
              )}
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((date) => {
                  const iso = toIsoDate(date);
                  const day = dayByDate.get(iso);
                  const inMonth = isSameMonth(date, month);
                  const status = day
                    ? dayStatus(day, sessionByDate.get(iso), today)
                    : null;
                  const className = `flex aspect-square items-center justify-center rounded-xl text-sm font-medium ${
                    status ? statusCell[status] : "text-muted/50"
                  } ${inMonth ? "" : "opacity-40"} ${iso === today ? "ring-2 ring-accent" : ""}`;
                  const label = `${format(date, "EEEE d MMMM")}${status ? `, ${statusLabel[status]}` : ""}`;

                  return day?.dayKey ? (
                    <Link
                      key={iso}
                      href={workoutHref(iso)}
                      className={className}
                      aria-label={label}
                    >
                      {format(date, "d")}
                    </Link>
                  ) : (
                    <div key={iso} className={className} aria-label={label}>
                      {format(date, "d")}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="text-muted flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {LEGEND.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`size-3 rounded ${statusCell[s]}`} aria-hidden />
            {statusLabel[s]}
          </li>
        ))}
      </ul>
    </Screen>
  );
}
