import type { Program } from "@/domain/types";
import { newId } from "./ids";
import type { EnrollmentRecord } from "./records";
import type { Repository } from "./repository";

/**
 * Enrolls in `program` from `startDate` (a Monday), making it the active
 * enrollment. Programs are immutable once stored, so an existing copy is
 * reused only if it is identical; otherwise a new program row is created.
 */
export async function startProgram(
  repo: Repository,
  program: Program,
  startDate: string,
): Promise<EnrollmentRecord> {
  const json = JSON.stringify(program);
  const existing = (await repo.listPrograms()).find(
    (p) => p.slug === program.id && JSON.stringify(p.json) === json,
  );
  const stored =
    existing ??
    (await repo.saveProgram({ id: newId(), slug: program.id, name: program.name, json: program }));

  return repo.saveEnrollment({ id: newId(), programId: stored.id, startDate, isActive: true });
}
