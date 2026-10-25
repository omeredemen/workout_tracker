import { bundledProgram } from "./bundled";
import { newId } from "./ids";
import type { EnrollmentRecord } from "./records";
import type { Repository } from "./repository";

/**
 * Enrolls in the bundled program from `startDate` (a Monday), making it the
 * active enrollment. Programs are immutable, so the stored copy is reused only
 * if it is identical to the bundled one.
 */
export async function startBundledProgram(
  repo: Repository,
  startDate: string,
): Promise<EnrollmentRecord> {
  const json = JSON.stringify(bundledProgram);
  const existing = (await repo.listPrograms()).find(
    (p) => p.slug === bundledProgram.id && JSON.stringify(p.json) === json,
  );
  const program =
    existing ??
    (await repo.saveProgram({
      id: newId(),
      slug: bundledProgram.id,
      name: bundledProgram.name,
      json: bundledProgram,
    }));

  return repo.saveEnrollment({
    id: newId(),
    programId: program.id,
    startDate,
    isActive: true,
  });
}
