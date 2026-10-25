import type { RowOf, TableName } from "../localStorageRepository";

/** A Supabase row: snake_case columns, plus user_id and server_updated_at. */
export type RemoteRow = Record<string, unknown>;

type Column = { local: string; remote: string; kind?: "number" | "numberArray" };

export type SyncTable = {
  local: TableName;
  remote: string;
  columns: Column[];
  /**
   * Columns (local names) that identify the row besides its id, and the parent
   * column used to fetch candidates. Rows created on two devices for the same
   * key are merged by adopting the server's id.
   */
  naturalKey?: { columns: string[]; parent: string };
};

const c = (local: string, remote: string, kind?: Column["kind"]): Column => ({ local, remote, kind });
const common = [
  c("id", "id"),
  c("createdAt", "created_at"),
  c("updatedAt", "updated_at"),
  c("deletedAt", "deleted_at"),
];

/** In push order: parents before children. */
export const SYNC_TABLES: SyncTable[] = [
  {
    local: "programs",
    remote: "programs",
    columns: [...common, c("slug", "slug"), c("name", "name"), c("json", "json")],
  },
  {
    local: "enrollments",
    remote: "enrollments",
    columns: [...common, c("programId", "program_id"), c("startDate", "start_date"), c("isActive", "is_active")],
  },
  {
    local: "swaps",
    remote: "exercise_swaps",
    columns: [
      ...common,
      c("enrollmentId", "enrollment_id"),
      c("phaseId", "phase_id"),
      c("dayKey", "day_key"),
      c("plannedExerciseId", "planned_exercise_id"),
      c("replacementExerciseId", "replacement_exercise_id"),
      c("fromDate", "from_date"),
    ],
    naturalKey: {
      columns: ["enrollmentId", "phaseId", "dayKey", "plannedExerciseId", "fromDate"],
      parent: "enrollmentId",
    },
  },
  {
    local: "sessions",
    remote: "sessions",
    columns: [
      ...common,
      c("enrollmentId", "enrollment_id"),
      c("date", "date"),
      c("week", "week", "number"),
      c("phaseId", "phase_id"),
      c("dayKey", "day_key"),
      c("status", "status"),
      c("cardioDone", "cardio_done"),
      c("notes", "notes"),
      c("startedAt", "started_at"),
      c("finishedAt", "finished_at"),
    ],
    naturalKey: { columns: ["enrollmentId", "date"], parent: "enrollmentId" },
  },
  {
    local: "setLogs",
    remote: "set_logs",
    columns: [
      ...common,
      c("sessionId", "session_id"),
      c("performedOn", "performed_on"),
      c("plannedExerciseId", "planned_exercise_id"),
      c("exerciseId", "exercise_id"),
      c("setIndex", "set_index", "number"),
      c("weightKg", "weight_kg", "number"),
      c("reps", "reps", "number"),
      c("rirActual", "rir_actual", "number"),
      c("miniSetReps", "mini_set_reps", "numberArray"),
      c("dropWeightKg", "drop_weight_kg", "number"),
      c("dropReps", "drop_reps", "number"),
    ],
    naturalKey: { columns: ["sessionId", "plannedExerciseId", "setIndex"], parent: "sessionId" },
  },
  {
    local: "bodyMetrics",
    remote: "body_metrics",
    columns: [
      ...common,
      c("date", "date"),
      c("weightKg", "weight_kg", "number"),
      c("waistCm", "waist_cm", "number"),
      c("neckCm", "neck_cm", "number"),
    ],
    naturalKey: { columns: ["date"], parent: "date" },
  },
];

export function toRemote(table: SyncTable, row: RowOf<TableName>, userId: string): RemoteRow {
  const local = row as unknown as Record<string, unknown>;
  const out: RemoteRow = { user_id: userId };
  for (const col of table.columns) {
    const value = local[col.local];
    out[col.remote] = col.kind === "numberArray" ? (value ?? []) : (value ?? null);
  }
  return out;
}

export function toLocal<K extends TableName>(table: SyncTable, row: RemoteRow): RowOf<K> {
  const out: Record<string, unknown> = {};
  for (const col of table.columns) {
    const value = row[col.remote];
    out[col.local] =
      value === null || value === undefined
        ? col.kind === "numberArray"
          ? []
          : null
        : col.kind === "number"
          ? Number(value) // numeric columns can arrive as strings
          : col.kind === "numberArray"
            ? (value as unknown[]).map(Number)
            : col.local.endsWith("At") && typeof value === "string"
              ? new Date(value).toISOString() // normalise "…+00:00" to "…Z"
              : value;
  }
  return out as RowOf<K>;
}

export function naturalKeyOf(table: SyncTable, row: Record<string, unknown>): string | null {
  return table.naturalKey ? JSON.stringify(table.naturalKey.columns.map((k) => row[k])) : null;
}
