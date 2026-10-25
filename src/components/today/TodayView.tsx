"use client";

import Link from "next/link";
import { useCallback } from "react";
import { dayStatus } from "@/domain/dayStatus";
import { resolveWorkout } from "@/domain/resolveWorkout";
import type { ScheduledDay } from "@/domain/types";
import {
  useActiveProgram,
  useRepoQuery,
  useToday,
  type ActiveProgram,
} from "@/data/hooks";
import type { Repository } from "@/data/repository";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { statusCell, statusLabel } from "@/components/calendar/status";
import { CardioToggle } from "./CardioToggle";
import { ErrorMessage, Loading, Screen } from "@/components/ui/Screen";
import { button, card } from "@/components/ui/styles";

export function TodayView() {
  const active = useActiveProgram();
  const today = useToday();

  if (active.status === "loading") return <Loading />;
  if (active.status === "error") return <ErrorMessage error={active.error} />;
  if (!active.data) {
    return (
      <Screen title="Today" subtitle={formatLongDate(today)}>
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="text-lg font-semibold">Set up your program</h2>
          <p className="text-muted">
            Pick a start date to get your calendar of workouts.
          </p>
          <Link href="/programs" className={button.primary}>
            Choose start date
          </Link>
        </section>
      </Screen>
    );
  }
  return <TodayWithProgram active={active.data} today={today} />;
}

function TodayWithProgram({
  active,
  today,
}: {
  active: ActiveProgram;
  today: string;
}) {
  const { program, library, schedule, enrollment } = active;
  const data = useRepoQuery(
    useCallback(
      async (repo: Repository) => ({
        sessions: await repo.listSessions(enrollment.id),
        swaps: await repo.listSwaps(enrollment.id),
      }),
      [enrollment.id],
    ),
  );
  if (data.status === "loading") return <Loading />;
  if (data.status === "error") return <ErrorMessage error={data.error} />;

  const sessionByDate = new Map(data.data.sessions.map((s) => [s.date, s]));
  const day = schedule.find((d) => d.date === today);
  const first = schedule[0]!;
  const last = schedule.at(-1)!;

  if (!day) {
    const before = today < first.date;
    return (
      <Screen title="Today" subtitle={formatLongDate(today)}>
        <section className={card}>
          <h2 className="text-lg font-semibold">
            {before
              ? `${program.name} starts ${formatLongDate(first.date)}`
              : `${program.name} is complete`}
          </h2>
          <p className="text-muted mt-1">
            {before
              ? "Your calendar is ready."
              : `It ended ${formatShortDate(last.date)}.`}
          </p>
          <Link href="/calendar" className={`${button.secondary} mt-3 w-full`}>
            Open calendar
          </Link>
        </section>
      </Screen>
    );
  }

  const phase = program.phases.find((p) => p.id === day.phaseId)!;
  const session = sessionByDate.get(today);
  const status = dayStatus(day, session, today);
  const workout = resolveWorkout(program, library, data.data.swaps, day);
  const next = schedule.find((d) => d.date > today && d.dayKey !== null);
  const week = schedule.filter((d) => d.week === day.week);

  return (
    <Screen
      title="Today"
      subtitle={`${formatLongDate(today)} · Week ${day.week} of ${program.durationWeeks}`}
    >
      <WeekStrip
        days={week}
        today={today}
        statusFor={(d) => dayStatus(d, sessionByDate.get(d.date), today)}
      />

      {workout ? (
        <section className={`${card} flex flex-col gap-3`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{workout.dayName}</h2>
              <p className="text-muted text-sm">{phase.name}</p>
            </div>
            {status !== "planned" && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusCell[status]}`}
              >
                {statusLabel[status]}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {workout.blocks
              .flatMap((b) =>
                b.kind === "single" ? [b.exercise] : b.exercises,
              )
              .map((e) => (
                <li
                  key={e.plannedExerciseId}
                  className="flex justify-between gap-3"
                >
                  <span>{e.exercise.name}</span>
                  <span className="text-muted shrink-0">
                    {e.sets} × {e.targetReps.join("/")}
                  </span>
                </li>
              ))}
          </ul>
          <Link href={`/workout/${today}`} className={button.primary}>
            {status === "completed"
              ? "View workout"
              : status === "in_progress"
                ? "Continue workout"
                : "Start workout"}
          </Link>
        </section>
      ) : (
        <section className={card}>
          <h2 className="text-xl font-semibold">Rest day</h2>
          {next && (
            <p className="text-muted mt-1">
              Next: {program.dayTemplates[next.dayKey!]?.name} on{" "}
              {formatShortDate(next.date)}
            </p>
          )}
        </section>
      )}

      <CardioToggle
        program={program}
        enrollmentId={enrollment.id}
        day={day}
        session={session}
      />
    </Screen>
  );
}

function WeekStrip({
  days,
  today,
  statusFor,
}: {
  days: ScheduledDay[];
  today: string;
  statusFor: (day: ScheduledDay) => ReturnType<typeof dayStatus>;
}) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="This week">
      {days.map((d) => {
        const status = statusFor(d);
        const label = formatShortDate(d.date).split(" ");
        const content = (
          <>
            <span className="text-[11px] uppercase opacity-80">{label[0]}</span>
            <span className="text-base font-semibold">{label[1]}</span>
          </>
        );
        const className = `flex h-14 flex-col items-center justify-center rounded-xl ${statusCell[status]} ${d.date === today ? "ring-2 ring-accent" : ""}`;
        return (
          <li key={d.date} title={statusLabel[status]}>
            {d.dayKey ? (
              <Link href={`/workout/${d.date}`} className={className}>
                {content}
              </Link>
            ) : (
              <div className={className}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
