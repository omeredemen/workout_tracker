import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const dir = join(__dirname, "..");
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ids = {
  program: "10000000-0000-4000-8000-000000000001",
  enrollment: "20000000-0000-4000-8000-000000000001",
  session: "30000000-0000-4000-8000-000000000001",
  setLog: "40000000-0000-4000-8000-000000000001",
};
const now = "2026-10-19T10:00:00Z";

let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(
    user
      ? `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`
      : "set role anon;",
  );
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

const count = async (user: string, table: string) =>
  (await as(user, `select count(*)::int as n from public.${table}`)).rows[0]!.n;

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(readFileSync(join(dir, "tests/supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(join(dir, "migrations")).sort()) {
    await db.exec(readFileSync(join(dir, "migrations", file), "utf8"));
  }
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);

  // User A's data, written as user A.
  await as(
    A,
    `insert into public.programs (id, user_id, slug, name, json, created_at, updated_at) values ($1, $2, 'wolverine', 'Wolverine', '{}', $3, $3)`,
    [ids.program, A, now],
  );
  await as(
    A,
    `insert into public.enrollments (id, user_id, program_id, start_date, is_active, created_at, updated_at) values ($1, $2, $3, '2026-10-19', true, $4, $4)`,
    [ids.enrollment, A, ids.program, now],
  );
  await as(
    A,
    `insert into public.sessions (id, user_id, enrollment_id, date, week, phase_id, day_key, status, created_at, updated_at) values ($1, $2, $3, '2026-10-19', 1, 'phase_1', 'upper_a', 'in_progress', $4, $4)`,
    [ids.session, A, ids.enrollment, now],
  );
  await as(
    A,
    `insert into public.set_logs (id, user_id, session_id, performed_on, planned_exercise_id, exercise_id, set_index, weight_kg, reps, mini_set_reps, created_at, updated_at) values ($1, $2, $3, '2026-10-19', 'lat_pulldown', 'lat_pulldown', 0, 52.5, 10, '{4,3}', $4, $4)`,
    [ids.setLog, A, ids.session, now],
  );
}, 60_000);

describe("row level security", () => {
  it("lets a user read their own rows", async () => {
    for (const table of ["programs", "enrollments", "sessions", "set_logs"]) {
      expect(await count(A, table)).toBe(1);
    }
    const log = (
      await as(A, "select weight_kg, mini_set_reps from public.set_logs")
    ).rows[0]!;
    expect(Number(log.weight_kg)).toBe(52.5);
    expect(log.mini_set_reps).toEqual([4, 3]);
  });

  it("hides other users' rows", async () => {
    for (const table of [
      "programs",
      "enrollments",
      "sessions",
      "set_logs",
      "exercise_swaps",
      "body_metrics",
      "profiles",
    ]) {
      expect(await count(B, table)).toBe(0);
    }
  });

  it("doesn't let a user change or delete other users' rows", async () => {
    const updated = await as(B, "update public.set_logs set reps = 99");
    const deleted = await as(B, "delete from public.sessions");
    expect(updated.affectedRows).toBe(0);
    expect(deleted.affectedRows).toBe(0);
    expect(
      (await as(A, "select reps from public.set_logs")).rows[0]!.reps,
    ).toBe(10);
  });

  it("doesn't let a user write rows owned by someone else", async () => {
    await expect(
      as(
        B,
        `insert into public.programs (id, user_id, slug, name, json, created_at, updated_at) values (gen_random_uuid(), $1, 'x', 'x', '{}', now(), now())`,
        [A],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(B, "update public.programs set user_id = $1", [B]),
    ).resolves.toMatchObject({ affectedRows: 0 });
  });

  it("doesn't let a user attach rows to another user's parent rows", async () => {
    await expect(
      as(
        B,
        `insert into public.enrollments (id, user_id, program_id, start_date, created_at, updated_at) values (gen_random_uuid(), $1, $2, '2026-10-19', now(), now())`,
        [B, ids.program],
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      as(
        B,
        `insert into public.set_logs (id, user_id, session_id, performed_on, planned_exercise_id, exercise_id, set_index, reps, created_at, updated_at) values (gen_random_uuid(), $1, $2, '2026-10-19', 'x', 'x', 5, 1, now(), now())`,
        [B, ids.session],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("gives anonymous visitors no access", async () => {
    await expect(as(null, "select * from public.set_logs")).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("constraints", () => {
  it("only accepts Monday start dates", async () => {
    await expect(
      as(
        A,
        `insert into public.enrollments (id, user_id, program_id, start_date, created_at, updated_at) values (gen_random_uuid(), $1, $2, '2026-10-20', now(), now())`,
        [A, ids.program],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("allows one active enrollment per user", async () => {
    await expect(
      as(
        A,
        `insert into public.enrollments (id, user_id, program_id, start_date, is_active, created_at, updated_at) values (gen_random_uuid(), $1, $2, '2026-10-26', true, now(), now())`,
        [A, ids.program],
      ),
    ).rejects.toThrow(/enrollments_one_active/);
  });

  it("enforces one set log per slot and set index", async () => {
    await expect(
      as(
        A,
        `insert into public.set_logs (id, user_id, session_id, performed_on, planned_exercise_id, exercise_id, set_index, reps, created_at, updated_at) values (gen_random_uuid(), $1, $2, '2026-10-19', 'lat_pulldown', 'lat_pulldown', 0, 8, now(), now())`,
        [A, ids.session],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("keeps the newest version when an older update arrives (last write wins)", async () => {
    await as(
      A,
      "update public.set_logs set reps = 11, updated_at = '2026-10-19T12:00:00Z'",
    );
    const stale = await as(
      A,
      "update public.set_logs set reps = 7, updated_at = '2026-10-19T11:00:00Z'",
    );
    expect(stale.affectedRows).toBe(0);
    expect(
      (await as(A, "select reps from public.set_logs")).rows[0]!.reps,
    ).toBe(11);
  });

  it("applies upserts of newer versions and skips older ones", async () => {
    const upsert = (reps: number, at: string) =>
      as(
        A,
        `insert into public.set_logs (id, user_id, session_id, performed_on, planned_exercise_id, exercise_id, set_index, reps, created_at, updated_at)
         values ($1, $2, $3, '2026-10-19', 'lat_pulldown', 'lat_pulldown', 0, $4, $5, $5)
         on conflict (id) do update set reps = excluded.reps, updated_at = excluded.updated_at`,
        [ids.setLog, A, ids.session, reps, at],
      );
    await upsert(5, "2026-10-19T09:00:00Z");
    expect(
      (await as(A, "select reps from public.set_logs")).rows[0]!.reps,
    ).toBe(11);
    await upsert(12, "2026-10-19T13:00:00Z");
    expect(
      (await as(A, "select reps from public.set_logs")).rows[0]!.reps,
    ).toBe(12);
  });

  it("sets server_updated_at itself, ignoring the client's value", async () => {
    await as(
      A,
      "update public.sessions set notes = 'x', server_updated_at = '2000-01-01'",
    );
    const row = (await as(A, "select server_updated_at from public.sessions"))
      .rows[0]!;
    expect(
      new Date(row.server_updated_at as string).getFullYear(),
    ).toBeGreaterThan(2000);
  });
});
