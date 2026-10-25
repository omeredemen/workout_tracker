import { programSchema, weekdays } from "./program.schema";
import type { ExerciseLibrary, Program } from "./types";

export type ProgramError = {
  /** Where the problem is, e.g. `phases[1].days.upper_a[3].reps`. Empty for the whole program. */
  path: string;
  message: string;
};

export type ParseProgramResult =
  { ok: true; program: Program } | { ok: false; errors: ProgramError[] };

/**
 * Validates an imported program against the schema, then runs the checks the
 * schema can't express. Cross-checks only run once the shape is valid.
 */
export function parseProgram(
  json: unknown,
  library: ExerciseLibrary,
): ParseProgramResult {
  const parsed = programSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    };
  }

  const errors = crossCheck(parsed.data, library);
  return errors.length
    ? { ok: false, errors }
    : { ok: true, program: parsed.data };
}

function crossCheck(
  program: Program,
  library: ExerciseLibrary,
): ProgramError[] {
  const errors: ProgramError[] = [];
  const add = (path: (string | number)[], message: string) =>
    errors.push({ path: formatPath(path), message });

  // Extra exercises defined by the program.
  const libraryIds = new Set(library.exercises.map((e) => e.id));
  const knownIds = new Set(libraryIds);
  program.exercises?.forEach((e, i) => {
    if (knownIds.has(e.id)) {
      add(
        ["exercises", i, "id"],
        libraryIds.has(e.id)
          ? `"${e.id}" already exists in the exercise library`
          : `"${e.id}" is defined more than once`,
      );
    }
    knownIds.add(e.id);
  });

  // Weekly schedule → day templates.
  const usedDayKeys = new Set<string>();
  for (const day of weekdays) {
    const key = program.weeklySchedule[day];
    if (key === null) continue;
    usedDayKeys.add(key);
    if (!program.dayTemplates[key]) {
      add(["weeklySchedule", day], `"${key}" is not one of the dayTemplates`);
    }
  }

  checkPhaseCoverage(program, add);

  program.phases.forEach((phase, p) => {
    for (const key of usedDayKeys) {
      if (!phase.days[key]) {
        add(
          ["phases", p, "days"],
          `Phase "${phase.id}" has no workout for "${key}", which the weekly schedule uses`,
        );
      }
    }

    for (const [dayKey, exercises] of Object.entries(phase.days)) {
      const dayPath = ["phases", p, "days", dayKey];
      if (!program.dayTemplates[dayKey]) {
        add(dayPath, `"${dayKey}" is not one of the dayTemplates`);
      }

      const seen = new Set<string>();
      const supersetCounts = new Map<string, number>();

      exercises.forEach((ex, i) => {
        const path = [...dayPath, i];
        const label = `"${ex.exerciseId}"`;

        if (!knownIds.has(ex.exerciseId)) {
          add(
            [...path, "exerciseId"],
            `${label} is not in the exercise library or the program's exercises`,
          );
        }
        if (seen.has(ex.exerciseId)) {
          add(
            [...path, "exerciseId"],
            `${label} appears more than once on this day`,
          );
        }
        seen.add(ex.exerciseId);

        if (ex.reps.length !== ex.sets) {
          add(
            [...path, "reps"],
            `${label} has ${ex.sets} sets but ${ex.reps.length} rep targets; give one target per set`,
          );
        }

        for (const technique of [ex.technique, ex.lastSetTechnique]) {
          if (technique && !program.techniques[technique]) {
            add(
              [...path],
              `${label} uses technique "${technique}", which is not explained in techniques`,
            );
          }
        }

        if (ex.superset) {
          supersetCounts.set(
            ex.superset,
            (supersetCounts.get(ex.superset) ?? 0) + 1,
          );
        }
      });

      for (const [letter, count] of supersetCounts) {
        if (count < 2) {
          add(
            dayPath,
            `Superset "${letter}" has only one exercise; a superset needs at least two`,
          );
        }
      }
      if (supersetCounts.size > 0 && !program.techniques.superset) {
        add(
          dayPath,
          `Uses supersets, but "superset" is not explained in techniques`,
        );
      }
    }
  });

  return errors;
}

function checkPhaseCoverage(
  program: Program,
  add: (path: (string | number)[], message: string) => void,
) {
  const coverage = new Map<number, string[]>();
  program.phases.forEach((phase, p) => {
    const { from, to } = phase.weeks;
    if (from > to) {
      add(
        ["phases", p, "weeks"],
        `Starts at week ${from} but ends at week ${to}`,
      );
      return;
    }
    if (to > program.durationWeeks) {
      add(
        ["phases", p, "weeks"],
        `Ends at week ${to}, but the program is only ${program.durationWeeks} weeks long`,
      );
    }
    for (let w = from; w <= to; w++) {
      coverage.set(w, [...(coverage.get(w) ?? []), phase.id]);
    }
  });

  const gaps: number[] = [];
  const overlaps = new Map<string, number[]>();
  for (let w = 1; w <= program.durationWeeks; w++) {
    const ids = coverage.get(w) ?? [];
    if (ids.length === 0) gaps.push(w);
    if (ids.length > 1) {
      const key = ids.map((id) => `"${id}"`).join(" and ");
      overlaps.set(key, [...(overlaps.get(key) ?? []), w]);
    }
  }

  if (gaps.length) {
    add(["phases"], `No phase covers ${weekList(gaps)}`);
  }
  for (const [ids, weeks] of overlaps) {
    add(["phases"], `Phases ${ids} overlap in ${weekList(weeks)}`);
  }
}

/** [1,2,3,6] → "weeks 1–3, 6" */
function weekList(weeks: number[]): string {
  const ranges: string[] = [];
  let start = weeks[0]!;
  let prev = start;
  for (const w of [...weeks.slice(1), Infinity]) {
    if (w === prev + 1) {
      prev = w;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = w;
  }
  return `${weeks.length > 1 ? "weeks" : "week"} ${ranges.join(", ")}`;
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((part, i) =>
      typeof part === "number"
        ? `[${part}]`
        : `${i === 0 ? "" : "."}${String(part)}`,
    )
    .join("");
}
