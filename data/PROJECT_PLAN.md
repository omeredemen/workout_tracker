# Workout Tracker – Project Plan

A mobile-first web app (installable PWA) that takes a training program as JSON, generates a dated calendar from a start date, and lets me log every set at the gym and track progress over time.

> **For Claude Code:** read this whole file before writing code. Work one milestone at a time, propose the plan for each milestone before implementing it, run tests and the type checker before calling a milestone done, and commit after each one.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Language | TypeScript (`strict: true`) |
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| Validation | Zod (runtime validation of imported program JSON) |
| Dates | date-fns |
| Tests | Vitest (unit), Playwright (one smoke test, optional) |
| Database + auth | Supabase (Postgres + magic-link auth + Row Level Security) — added in Milestone 4 |
| Hosting | Vercel |
| Package manager | pnpm |

Data access happens client-side through a **repository interface**, so the app works first with `localStorage` and later with Supabase without rewriting the UI.

---

## 2. Files I'm providing (put these in `/data`)

| File | What it is |
|---|---|
| `program.schema.json` | JSON Schema for any training program the app can import |
| `wolverine.program.json` | My current 12-week program (3 phases × 4 training days) |
| `exercise-library.json` | Every exercise, its equipment, and its **swap group** |

### How the program format works
- `weeklySchedule` maps weekdays to day templates (`mon: "upper_a"`, `wed: null` = rest day).
- `phases[]` each cover a week range (`{from: 1, to: 4}`) and define the exercises for each day template.
- Each planned exercise has:
  - `exerciseId` → a key in `exercise-library.json` (or in the program's optional `exercises` array)
  - `sets`, and `reps` as **one target per set** (`[10,10,10]`, RPT = `[6,8,10]`)
  - `rir` as a string: `"0"` or `"1-2"`
  - `technique`: `straight` | `rpt` | `drop_set`
  - optional `lastSetTechnique`: `rest_pause` | `drop_set` (applies to the final set only)
  - optional `superset`: a letter; same letter on the same day = do back to back
  - optional `perSide: true` (e.g. lunges, 20 reps per leg)
  - optional `note`
- `techniques` holds explanations shown in the app (RPT, Rest-Pause, Superset, Drop Set).
- `rules` holds rest times (sets: 120–180 s, exercises: 60 s) and daily cardio (30 min incline walk, incline 10, 6 km/h).
- `nutrition` holds targets: deficit 400–600 kcal, protein 2 g/kg, fat 0.8 g/kg, carbs = remaining calories.

### Swap rules (from `exercise-library.json`)
- An exercise can only be swapped for another exercise **in the same `swapGroup`**.
- Exercises with `swapGroup: null` cannot be swapped.
- Swaps should ideally happen only when a phase starts. The app allows swaps any time but shows a warning mid-phase.
- A swap applies to **the rest of the current phase** for that day's exercise, not just one session.

---

## 3. Domain logic (pure functions, fully unit-tested)

Put these in `src/domain/` with no React or database imports.

1. **`parseProgram(json)`** – validate with Zod, plus cross-checks the JSON Schema can't express:
   - every `exerciseId` exists in the library or the program's own `exercises`
   - `reps.length === sets`
   - each superset letter appears at least twice in a day
   - phases cover weeks 1..`durationWeeks` exactly with no gaps or overlaps
   - every day template used in `weeklySchedule` exists in every phase
   - every referenced technique exists in `techniques`
   - Return readable errors for the import screen.
2. **`generateSchedule(program, startDate)`** → `ScheduledDay[]`
   - `startDate` must be a Monday (the date picker only allows Mondays).
   - Output for each of `durationWeeks × 7` days: `{ date, week, phaseId, dayKey | null }`.
   - The calendar is **fixed**: missed workouts are marked missed, not shifted.
3. **`resolveWorkout(program, library, swaps, scheduledDay)`** → the exercise list for that date, with swaps applied and supersets grouped.
4. **`getSwapOptions(library, exerciseId)`** → same-group alternatives.
5. **`previousPerformance(logs, exerciseId, beforeDate)`** → the most recent sets for that exercise (used for "last time").
6. **`nutritionTargets(program.nutrition, bodyweightKg, maintenanceKcal?)`** → grams of protein/fat, and carbs if maintenance calories are known.

Tests must cover: a Monday start date, phase boundaries (week 4 → 5, 8 → 9), RPT targets, a swap mid-phase, a broken program JSON producing clear errors.

---

## 4. Data model

Same shape for the localStorage repository and the Supabase tables.

```
programs        id, user_id, name, json (jsonb), created_at
enrollments     id, user_id, program_id, start_date, is_active, created_at
exercise_swaps  id, enrollment_id, phase_id, day_key, planned_exercise_id, replacement_exercise_id, created_at
sessions        id, enrollment_id, date, week, phase_id, day_key,
                status ('planned'|'in_progress'|'completed'|'skipped'),
                cardio_done (bool), notes, started_at, finished_at
set_logs        id, session_id, exercise_id (actually performed), planned_exercise_id,
                set_index, weight, reps, rir_actual (nullable),
                mini_set_reps (int[] – rest-pause extra reps), created_at
body_metrics    id, user_id, date, weight_kg, waist_cm (nullable), neck_cm (nullable)
```

Supabase: every table gets RLS so a user only reads and writes their own rows (`user_id = auth.uid()`, or via the enrollment's `user_id`). Write migrations as SQL files in `supabase/migrations/`.

---

## 5. Screens

1. **Today** (home) – today's workout or "Rest day", cardio checkbox, button to start the workout.
2. **Calendar** – month view; each day colored as completed / missed / planned / rest; phase name shown per week; tap a day to open it.
3. **Workout** – exercises in order; supersets shown as one grouped card; each set row has target reps, weight and reps inputs, and last time's numbers next to it; RPT shows a different target per set; rest-pause last set shows up to 3 extra mini-set inputs; technique badge opens its explanation; a "swap" button per exercise; "finish workout" saves the session.
4. **Rest timer** – starts automatically when a set is saved; 2:00 default, quick +30 s; vibrates when done (if supported). Supersets: timer starts after the second exercise.
5. **Progress** – bodyweight log with 7-day average; per-exercise history (best set per session over time); weekly completion count.
6. **Programs** – import a program JSON (paste or upload), show validation errors, choose start date, set active.
7. **Settings** – units, sign in / out, export all data as JSON.

UI rules: mobile-first (designed for ~390 px width), big tap targets for use between sets, dark mode, numeric keypad for weight/reps inputs.

---

## 6. Milestones

Each milestone ends with: tests passing, `pnpm typecheck` and `pnpm lint` clean, a short summary, and a git commit.

### M0 – Project setup
- Next.js + TypeScript strict + Tailwind + ESLint + Prettier + Vitest.
- Folders: `src/domain`, `src/data` (repositories), `src/components`, `src/app`, `data/`.
- Copy the three JSON files into `data/`.
- Create a `CLAUDE.md` summarizing the stack, folder rules, commands and conventions from this plan.
- **Done when:** `pnpm dev` runs and `pnpm test` runs one sample test.

### M1 – Domain layer (no UI)
- TypeScript types matching `program.schema.json` and the library.
- Zod schemas + `parseProgram`, `generateSchedule`, `resolveWorkout`, `getSwapOptions`, `previousPerformance`.
- **Done when:** the Wolverine program parses with zero errors, generates 84 days (48 workouts, 36 rest days), and all tests in section 3 pass.

### M2 – Usable locally (localStorage)
- `Repository` interface + `LocalStorageRepository`.
- Wolverine bundled as the default program; pick a start date.
- Today, Calendar and Workout screens with set logging.
- **Done when:** I can open today's workout on my phone, log all sets, finish it, and see the day marked completed on the calendar after a reload.

### M3 – Gym features
- "Last time" numbers, rest timer, superset grouping, RPT per-set targets, rest-pause mini-sets, technique explanations, swap modal (same group only, mid-phase warning), cardio checkbox.
- **Done when:** a full phase 3 workout (RPT + rest-pause + superset) can be logged without confusion.

### M4 – Supabase sync + login
- Magic-link auth, migrations with RLS, `SupabaseRepository` behind the same interface.
- One-time import of localStorage data after first sign-in.
- **Done when:** data logged on my phone appears on my laptop after signing in, and one user can't read another user's rows.

### M5 – PWA + deploy
- Web manifest, icons, service worker; offline logging that queues writes and syncs when back online.
- Deploy to Vercel with environment variables for Supabase.
- **Done when:** the app installs to my phone's home screen and I can log a set in airplane mode that syncs later.

### M6 – Progress & nutrition
- Bodyweight log with 7-day average, per-exercise charts, weekly completion stats.
- Nutrition targets from the program (protein and fat grams from bodyweight).
- Program import screen for future programs, with readable validation errors.
- Data export as JSON.

---

## 7. Known ambiguities in the source program

These are decided in the JSON; flag them in the UI as notes, don't silently change them.

- **Phase 3, Friday – Adductor Machine** is marked SS in the PDF but has no partner. Treated as a straight set.
- **Phase 2, Thursday – "Rope Triceps Extension"** could mean a pushdown or an overhead extension. Kept as its own exercise in the triceps group.
- **"Leg Curl"** doesn't specify seated or lying. Kept as a generic entry in the hamstring group; seated, lying and Nordic curls are swap options.
- **Merged names:** "Seated Row Machine" and "Machine Row" → `machine_seated_row`; "Rope Pushdown" and "Triceps Rope Pushdown" → `rope_pushdown`; "M Chest Fly" and "Machine Pec Deck" → `pec_deck`; "DB Skull Crusher" and "Skullcrusher" → `skull_crusher`.
- **Lunge, Seated Calf Raise, Abductor, Adductor** aren't in the swap document, so they have no swap options.

---

## 8. Kickoff prompt for Claude Code

```
Read PROJECT_PLAN.md and the three files in data/. Then start Milestone M0.
Before writing code, list the steps you'll take and any decisions you need from me.
After M0 is done and committed, stop and summarize.
```

For each later milestone:

```
Start Milestone M<n> from PROJECT_PLAN.md. Use plan mode first, then implement,
run tests + typecheck + lint, update CLAUDE.md if conventions changed, and commit.
```

### Tips
- One milestone per session keeps context focused.
- After each milestone, open the app on your phone and actually use it before moving on.
- If something feels wrong, describe what you saw ("the timer didn't start after the superset"), not how to fix it.
