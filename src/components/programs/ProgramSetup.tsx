"use client";

import { addDays, startOfWeek } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseIsoDate, toIsoDate } from "@/domain/dates";
import type { Program } from "@/domain/types";
import { bundledProgram } from "@/data/bundled";
import { useActiveProgram, useRepoQuery, useToday } from "@/data/hooks";
import { startProgram } from "@/data/programs";
import type { Repository } from "@/data/repository";
import { useRepository } from "@/data/RepositoryProvider";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { ErrorMessage, Loading, Screen } from "@/components/ui/Screen";
import { button, card } from "@/components/ui/styles";
import { ImportProgram } from "./ImportProgram";
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
  /** The program about to be started (or re-dated); null = nothing chosen. */
  const [chosen, setChosen] = useState<Program | null>(null);
  const [saving, setSaving] = useState(false);

  if (active.status === "loading") return <Loading />;
  if (active.status === "error") return <ErrorMessage error={active.error} />;

  const current = active.data;
  // With nothing running, the built-in program is the default choice.
  const candidate = chosen ?? (current ? null : bundledProgram);

  async function start(program: Program) {
    if (
      current &&
      (loggedSessions.data ?? 0) > 0 &&
      !window.confirm(
        "Start a new calendar? Workouts you've logged stay in your history (and in \"last time\"), but won't appear on the new calendar.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await startProgram(repo, program, startDate);
      router.push("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title="Program"
      subtitle={
        current ? "Your current program" : "Choose a program and when to start"
      }
    >
      {current && !chosen && (
        <section className={`${card} flex flex-col gap-1`}>
          <ProgramSummary program={current.program} />
          <p className="text-muted mt-2 text-sm">
            Started {formatLongDate(current.enrollment.startDate)} · ends{" "}
            {formatShortDate(current.schedule.at(-1)!.date)}
          </p>
          <button
            type="button"
            className={`${button.secondary} mt-2 w-full`}
            onClick={() => {
              setStartDate(current.enrollment.startDate);
              setChosen(current.program);
            }}
          >
            Change start date
          </button>
        </section>
      )}

      {candidate && (
        <section className={`${card} flex flex-col gap-4`}>
          <ProgramSummary program={candidate} />
          <h3 className="font-semibold">
            {current ? "New start date" : "When do you start?"}
          </h3>
          <StartDatePicker value={startDate} onChange={setStartDate} />
          <p className="text-muted text-sm">
            Ends{" "}
            {formatShortDate(
              toIsoDate(
                addDays(
                  parseIsoDate(startDate),
                  candidate.durationWeeks * 7 - 1,
                ),
              ),
            )}
          </p>
          <button
            type="button"
            className={button.primary}
            onClick={() => start(candidate)}
            disabled={saving}
          >
            {current ? "Start from this date" : "Start program"}
          </button>
          {chosen && (
            <button
              type="button"
              className={button.ghost}
              onClick={() => setChosen(null)}
            >
              Cancel
            </button>
          )}
        </section>
      )}

      {!chosen && (
        <>
          {current && current.program.id !== bundledProgram.id && (
            <button
              type="button"
              className={button.secondary}
              onClick={() => setChosen(bundledProgram)}
            >
              Switch to {bundledProgram.name} (built in)
            </button>
          )}
          <ImportProgram
            onValid={(program) => {
              setChosen(program);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}
    </Screen>
  );
}

function ProgramSummary({ program }: { program: Program }) {
  const perWeek = Object.values(program.weeklySchedule).filter(Boolean).length;
  return (
    <div>
      <h2 className="text-lg font-semibold">{program.name}</h2>
      {program.description && (
        <p className="text-muted text-sm">{program.description}</p>
      )}
      <p className="text-muted text-sm">
        {program.durationWeeks} weeks · {perWeek} workouts a week
      </p>
      <ol className="mt-3 flex flex-col gap-1.5">
        {program.phases.map((phase) => (
          <li key={phase.id} className="text-sm">
            <span className="text-muted">
              Weeks {phase.weeks.from}–{phase.weeks.to}:
            </span>{" "}
            {phase.name}
          </li>
        ))}
      </ol>
    </div>
  );
}
