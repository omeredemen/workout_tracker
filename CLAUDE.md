@AGENTS.md

# Workout Tracker

Mobile-first PWA: import a training program (JSON), pick a Monday start date, follow the generated calendar, log every set. Full spec and milestones: `data/PROJECT_PLAN.md` — read it before starting a milestone.

## Stack

Next.js 16 (App Router) · TypeScript strict (+ `noUncheckedIndexedAccess`) · Tailwind CSS 4 · Zod 4 · date-fns 4 · Vitest · Supabase (from M4) · hand-written service worker (`public/sw.js`) · Vercel · pnpm.

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
- The workout page is `/workout?date=yyyy-MM-dd` (build links with `workoutHref`), read with `useSearchParams` inside `<Suspense>`. Keeping it a static route (not `/workout/[date]`) lets the service worker serve it offline for any date. Every route should stay static (○ in `next build`).
- Read data with `useRepoQuery(useCallback(...))`; it re-runs on any repository change. `useActiveProgram()` gives the enrollment, program, merged library and schedule.
- Generate ids with `newId()` (`src/data/ids.ts`), never `crypto.randomUUID()`: the dev server opened over the LAN is not a secure context.
- Saves are upserts; sessions and set logs upsert on their natural keys, so double taps can't create duplicates.
- Changing the start date creates a new enrollment; old logs stay in history.

## Gym features (M3)

- `restAfterSet` (domain) decides rest length: set rest = `rules.restBetweenSetsSec.min`, after an exercise's last set = `restBetweenExercisesSec`, none mid-superset or after the final set. The timer only starts for newly logged sets on today's workout.
- The rest timer (`src/lib/restTimer.ts`) stores its end timestamp in localStorage and is rendered by `RestTimerBar` in the root layout, so it survives navigation, reloads and screen lock.
- Weight suggestions come from progressive-overload advice (`src/domain/overload.ts`, `adviseSet`, per set index so RPT works): beat target +1 rep twice in a row at a weight (or +4 once, or the target drops ≥2) → add max(2.5 %, one step); miss by ≥2 twice → drop ~10 %; else repeat. Past sets are judged against their own planned target (`plannedTargetReps`). No history → this session's previous set. Suggestions render muted until saved.
- Session changes go through `updateSession` (`src/data/sessions.ts`), which creates the row on demand.

## Sync (M4)

- Local-first: the UI only ever talks to `LocalStorageRepository`. `src/data/sync/` pushes queued local changes to Supabase and pulls remote ones (`syncOnce`); `SyncProvider` runs it on start, after changes (2 s debounce), on `online`/visibility, and every 5 min.
- Once a device has an owner (`claimFor`, on first sign-in, which queues all existing rows = the one-time import), every write is recorded as dirty in `workout-tracker:sync:v1`; that list is the offline write queue.
- Conflicts: last write wins on `updated_at`, enforced on the server by the `keep_newest` trigger and locally in `applyRemote`. Rows created on two devices for the same natural key adopt the server's id (`adoptServerIds` / `remapId`).
- Pulls use the server-set `server_updated_at`, re-reading 60 s back to tolerate out-of-order commits.
- A device holding another account's data must be cleared before syncing (Settings shows a "Different account" prompt).
- New synced columns: add them to the migration, `SYNC_TABLES` (`src/data/sync/tables.ts`) and the record type.
- Tests: `supabase/tests/rls.test.ts` runs migrations + RLS on PGlite; `e2e/fake-supabase.mts` serves auth + REST on PGlite for Playwright (codes are always `123456`).

## PWA (M5)

- `src/app/manifest.ts`, icons in `public/icons/` and `src/app/apple-icon.png` / `icon.svg` (regenerate with `node scripts/generate-icons.mjs` from `scripts/icon.svg`).
- `public/sw.js` precaches every page in its `PAGES` list (add new routes there) and their static assets at install; pages are network-first with cache fallback. Router (RSC) requests are never cached: offline they get a 503 so Next.js falls back to a full page load, which the cache serves. It registers only in production (`ServiceWorker` component), versioned by `NEXT_PUBLIC_APP_VERSION` (commit SHA on Vercel).
- `pnpm test:e2e` has two projects: `app` (dev server :3100) and `pwa` (production build in `.next-e2e`, :3200) for service worker and offline tests.

## Progress, import, settings (M6)

- `src/domain/progress.ts`: `movingAverage` (7 calendar days), `bestSetPerSession` (highest Epley e1RM; most reps for bodyweight), `weeklyCompletion`.
- Charts are hand-written SVG (`src/components/charts/`), following the dataviz skill: one data colour `--series-1` (validated in both modes), 2px lines, hairline grids, crosshair/keyboard tooltip, a table view on every chart, legends only for 2+ series.
- Body metrics are a synced table (`body_metrics`); units (`src/lib/units.ts`) and maintenance calories are per-device preferences in localStorage, not synced. Weights are stored in kg; compare edits in display units.
- Programs page: start the built-in program, re-date the current one, or import JSON (paste/upload) validated by `parseProgram` against the bundled library. `startProgram` reuses an identical stored program, else stores a new one.
- Settings → Export writes every table (including soft-deleted rows) as JSON.

## Troubleshooting

- New Tailwind classes not applying, or type errors mentioning deleted routes, in `pnpm dev`: the persistent dev cache is stale. Stop the server and `rm -rf .next/dev`.

## Conventions

- Mobile-first, ~390 px wide: big tap targets, `inputMode="decimal"` / `"numeric"` for weight/reps, respect safe-area insets, dark mode via `prefers-color-scheme`.
- Colors go through the theme tokens in `globals.css` (`background`, `foreground`, `muted`), not raw hex in components.
- Show readable validation errors for imported programs; never silently fix program data.
