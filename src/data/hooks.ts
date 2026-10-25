"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { generateSchedule } from "@/domain/generateSchedule";
import { toIsoDate } from "@/domain/dates";
import { withProgramExercises } from "@/domain/library";
import type { IsoDate } from "@/domain/types";
import { bundledLibrary } from "./bundled";
import type { Repository } from "./repository";
import { useRepository } from "./RepositoryProvider";

type QueryResult<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "error"; data?: undefined; error: Error }
  | { status: "ready"; data: T; error?: undefined };

/**
 * Runs `query` and re-runs it whenever the repository changes. Pass a stable
 * function (useCallback) — a new function means a new query.
 */
export function useRepoQuery<T>(query: (repo: Repository) => Promise<T>): QueryResult<T> {
  const repo = useRepository();
  const [state, setState] = useState<{ query: typeof query; result: QueryResult<T> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      query(repo).then(
        (data) => !cancelled && setState({ query, result: { status: "ready", data } }),
        (error: unknown) =>
          !cancelled &&
          setState({
            query,
            result: { status: "error", error: error instanceof Error ? error : new Error(String(error)) },
          }),
      );
    };
    run();
    const unsubscribe = repo.subscribe(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repo, query]);

  // Results from a previous query (e.g. another date) are never shown.
  return state?.query === query ? state.result : { status: "loading" };
}

const getActive = async (repo: Repository) => {
  const enrollment = await repo.getActiveEnrollment();
  if (!enrollment) return null;
  const program = await repo.getProgram(enrollment.programId);
  if (!program) throw new Error("The active program is missing from storage");
  return { enrollment, programRecord: program };
};

/** The active enrollment with its program, library and calendar; data is null when none is set up. */
export function useActiveProgram() {
  const result = useRepoQuery(getActive);
  const active = result.data;
  const derived = useMemo(() => {
    if (!active) return null;
    const program = active.programRecord.json;
    return {
      enrollment: active.enrollment,
      program,
      library: withProgramExercises(bundledLibrary, program),
      schedule: generateSchedule(program, active.enrollment.startDate),
    };
  }, [active]);
  return result.status === "ready" ? { ...result, data: derived } : result;
}

export type ActiveProgram = NonNullable<
  Extract<ReturnType<typeof useActiveProgram>, { status: "ready" }>["data"]
>;

const subscribeToDayChanges = (onChange: () => void) => {
  const interval = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onChange);
  };
};

/** Today's local date, updating when the day rolls over or the app is reopened. */
export function useToday(): IsoDate {
  return useSyncExternalStore(
    subscribeToDayChanges,
    () => toIsoDate(new Date()),
    () => "",
  );
}
