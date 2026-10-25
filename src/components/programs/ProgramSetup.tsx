"use client";

import { addDays, startOfWeek } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseIsoDate, toIsoDate } from "@/domain/dates";
import { bundledProgram } from "@/data/bundled";
import { useActiveProgram, useRepoQuery, useToday } from "@/data/hooks";
import { startBundledProgram } from "@/data/programs";
import type { Repository } from "@/data/repository";
import { useRepository } from "@/data/RepositoryProvider";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { ErrorMessage, Loading, Screen } from "@/components/ui/Screen";
import { button, card } from "@/components/ui/styles";
import { StartDatePicker } from "./StartDatePicker";

const countSessions = async (repo: Repository) => {
  const enrollment = await repo.getActiveEnrollment();
  return enrollment ? (await repo.listSessions(enrollment.id)).length : 0;
};

export function ProgramSetup() {
  const repo = useRepository();
  const router = useRouter();
  const today = useToday();
  const active = useActiveProgram();
  const loggedSessions = useRepoQuery(countSessions);
  const [startDate, setStartDate] = useState(() =>
    toIsoDate(startOfWeek(parseIsoDate(today), { weekStartsOn: 1 })),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (active.status === "loading") return <Loading />;
  if (active.status === "error") return <ErrorMessage error={active.error} />;

  const current = active.data;
  const program = current?.program ?? bundledProgram;

  async function start() {
    if (
      current &&
      (loggedSessions.data ?? 0) > 0 &&
      !window.confirm(
        "Start over with a new date? Workouts you've logged stay in your history (and in \"last time\"), but won't appear on the new calendar.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await startBundledProgram(repo, startDate);
      router.push("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Program" subtitle={program.description}>
      <section className={card}>
        <h2 className="text-lg font-semibold">{program.name}</h2>
        <p className="text-muted text-sm">
          {program.durationWeeks} weeks ·{" "}
          {Object.values(program.weeklySchedule).filter(Boolean).length}{" "}
          workouts a week
        </p>
        <ol className="mt-3 flex flex-col gap-2">
          {program.phases.map((phase) => (
            <li key={phase.id} className="text-sm">
              <span className="text-muted">
                Weeks {phase.weeks.from}–{phase.weeks.to}:
              </span>{" "}
              {phase.name}
            </li>
          ))}
        </ol>
      </section>

      {current && !editing ? (
        <section className={card}>
          <p className="text-muted text-sm">Started</p>
          <p className="text-lg font-semibold">
            {formatLongDate(current.enrollment.startDate)}
          </p>
          <p className="text-muted text-sm">
            Ends {formatShortDate(current.schedule.at(-1)!.date)}
          </p>
          <button
            type="button"
            className={`${button.secondary} mt-3 w-full`}
            onClick={() => {
              setStartDate(current.enrollment.startDate);
              setEditing(true);
            }}
          >
            Change start date
          </button>
        </section>
      ) : (
        <section className={`${card} flex flex-col gap-4`}>
          <h2 className="font-semibold">
            {current ? "New start date" : "When do you start?"}
          </h2>
          <StartDatePicker value={startDate} onChange={setStartDate} />
          <p className="text-muted text-sm">
            Ends{" "}
            {formatShortDate(
              toIsoDate(
                addDays(parseIsoDate(startDate), program.durationWeeks * 7 - 1),
              ),
            )}
          </p>
          <button
            type="button"
            className={button.primary}
            onClick={start}
            disabled={saving}
          >
            {current ? "Restart from this date" : "Start program"}
          </button>
          {current && (
            <button
              type="button"
              className={button.ghost}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          )}
        </section>
      )}
    </Screen>
  );
}
