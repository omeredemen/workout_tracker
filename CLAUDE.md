@AGENTS.md

# Workout Tracker

Mobile-first PWA: import a training program (JSON), pick a Monday start date, follow the generated calendar, log every set. Full spec and milestones: `data/PROJECT_PLAN.md` — read it before starting a milestone.

## Stack

Next.js 16 (App Router) · TypeScript strict (+ `noUncheckedIndexedAccess`) · Tailwind CSS 4 · Zod 4 · date-fns 4 · Vitest · Supabase (from M4) · Serwist for the service worker (M5) · Vercel · pnpm.

Next.js 16 differs from older versions — check `node_modules/next/dist/docs/` before using an API you're unsure of. `next.config.ts` enables `cacheComponents` and `partialPrefetching`; the offline guide (`01-app/02-guides/offline-support.md`) is relevant for M5.

## Commands

pnpm is run through corepack (not installed globally): use `corepack pnpm <cmd>`, or run `corepack enable` once to get a plain `pnpm`.

| Command                             | What it does                                                       |
| ----------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                          | dev server                                                         |
| `pnpm dev:phone`                    | dev server reachable from a phone at `http://<laptop LAN IP>:3000` |
| `pnpm test`                         | Vitest, single run (`pnpm test:watch` for watch mode)              |
| `pnpm test:e2e`                     | Playwright smoke tests (installed Chrome; own dev server on :3100) |
| `pnpm typecheck`                    | `next typegen` + `tsc --noEmit`                                    |
| `pnpm lint`                         | ESLint                                                             |
| `pnpm format` / `pnpm format:check` | Prettier (with Tailwind class sorting)                             |

A milestone is done only when `test`, `typecheck` and `lint` are clean. Commit after each milestone.

## Folder rules

- `data/` — provided JSON (`program.schema.json`, `wolverine.program.json`, `exercise-library.json`) and the project plan. Import with the `@data/*` alias. Don't edit these files to make code pass; flag ambiguities instead (plan §7).
- `src/domain/` — pure TypeScript domain logic and Zod schemas. **No React, Next, Supabase or `@/data` imports** (enforced by ESLint). Every function is unit-tested in `src/domain/__tests__/`.
- `src/data/` — the `Repository` interface and its implementations (localStorage first, Supabase in M4). UI talks only to the interface.
- `src/components/` — React components (`ui/`, `workout/`, `calendar/`, `nav/`).
- `src/app/` — routes only; keep them thin.
- `supabase/migrations/` — numbered SQL migrations.

## Data model decisions (these replace plan §4 where they differ)

- Every table has `user_id`; RLS on every table is `user_id = auth.uid()`.
- Ids are UUIDs generated on the device; every row has `updated_at` and soft-delete `deleted_at`, so writes are repeatable upserts (needed for the M4 import and the M5 offline queue).
- The exercise library is a bundled static file, not a table. The calendar is computed by `generateSchedule`, never stored.
- `sessions` rows are created only when something happens (cardio ticked, workout started or skipped). Status is `planned | in_progress | completed | skipped`; `planned` means the row exists only for cardio/notes. "Missed" is derived (a past workout day whose session is absent or `planned`). Unique `(enrollment_id, date)`.
- `set_logs`: weights stored in **kg** (units are display-only); has `performed_on` (copied from `sessions.date`), `planned_exercise_id` + actual `exercise_id`, `mini_set_reps smallint[]`, `drop_weight_kg` / `drop_reps`. Unique `(session_id, planned_exercise_id, set_index)`.
- "Last time" looks up the **actual** `exercise_id`, not the planned slot.
- A planned slot is identified by `(phase_id, day_key, exerciseId)`; `parseProgram` rejects a day that lists the same exercise twice.
- `exercise_swaps` has a `from_date`: a swap applies from that date to the end of its phase, so earlier workouts in the phase still show what was actually done. Unique `(enrollment_id, phase_id, day_key, planned_exercise_id, from_date)`; the latest `from_date` on or before the day wins, and swapping back to the planned exercise counts as no swap. The same-swap-group rule is enforced in `src/domain/` (`canSwap`).
- `programs.json` can't be changed once imported; re-importing creates a new program row.
- One active enrollment per user (partial unique index).
- `profiles` table holds per-user settings (units).

## Domain layer (M1)

- Entry points: `parseProgram(json, library)` → `{ ok, program } | { ok, errors: {path, message}[] }`; `generateSchedule`, `resolveWorkout`, `getSwapOptions` / `canSwap` / `isMidPhase`, `previousPerformance`, `nutritionTargets`.
- Dates are `IsoDate` strings (`yyyy-MM-dd`, local time); convert only through `src/domain/dates.ts`.
- Pass `withProgramExercises(library, program)` wherever a program's own extra exercises must be visible (`resolveWorkout`, swap options).
- Types come from the Zod schemas (`z.output`), in `src/domain/types.ts`. Test fixtures live in `src/domain/__tests__/fixtures.ts`.

## App layer (M2)

- Data lives in localStorage, so every page wraps its view in `<ClientOnly>` (in the page, not the root layout, or Next's instant-navigation validation drops the segment). Nothing may read the clock, storage or `crypto.randomUUID` during prerender.
- `/workout/[date]` reads its param with `useParams` inside `<Suspense>` (required by Cache Components).
- Read data with `useRepoQuery(useCallback(...))`; it re-runs on any repository change. `useActiveProgram()` gives the enrollment, program, merged library and schedule.
- Generate ids with `newId()` (`src/data/ids.ts`), never `crypto.randomUUID()`: the dev server opened over the LAN is not a secure context.
- Saves are upserts; sessions and set logs upsert on their natural keys, so double taps can't create duplicates.
- Changing the start date creates a new enrollment; old logs stay in history.

## Gym features (M3)

- `restAfterSet` (domain) decides rest length: set rest = `rules.restBetweenSetsSec.min`, after an exercise's last set = `restBetweenExercisesSec`, none mid-superset or after the final set. The timer only starts for newly logged sets on today's workout.
- The rest timer (`src/lib/restTimer.ts`) stores its end timestamp in localStorage and is rendered by `RestTimerBar` in the root layout, so it survives navigation, reloads and screen lock.
- Weight suggestions: same set index last time (handles RPT), else this session's previous set; suggestions render muted until saved.
- Session changes go through `updateSession` (`src/data/sessions.ts`), which creates the row on demand.

## Conventions

- Mobile-first, ~390 px wide: big tap targets, `inputMode="decimal"` / `"numeric"` for weight/reps, respect safe-area insets, dark mode via `prefers-color-scheme`.
- Colors go through the theme tokens in `globals.css` (`background`, `foreground`, `muted`), not raw hex in components.
- Show readable validation errors for imported programs; never silently fix program data.
