-- Workout tracker schema. Ids are generated on the device (UUID v4) so writes
-- can be retried and queued offline. updated_at / deleted_at are set by the
-- client (last write wins); server_updated_at is set here and drives pulls.

create or replace function public.touch_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- Last write wins: an update carrying an older updated_at than the stored row
-- (e.g. a device syncing stale offline edits) is silently skipped.
create or replace function public.keep_newest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  units text not null default 'kg' check (units in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null,
  name text not null,
  json jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.enrollments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null,
  start_date date not null check (extract(isodow from start_date) = 1),
  is_active boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (program_id, user_id) references public.programs (id, user_id) on delete cascade
);

-- One active enrollment per user.
create unique index enrollments_one_active on public.enrollments (user_id)
  where is_active and deleted_at is null;

create table public.exercise_swaps (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  enrollment_id uuid not null,
  phase_id text not null,
  day_key text not null,
  planned_exercise_id text not null,
  replacement_exercise_id text not null,
  from_date date not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (enrollment_id, phase_id, day_key, planned_exercise_id, from_date),
  foreign key (enrollment_id, user_id) references public.enrollments (id, user_id) on delete cascade
);

create table public.sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  enrollment_id uuid not null,
  date date not null,
  week smallint not null check (week >= 1),
  phase_id text not null,
  day_key text,
  status text not null check (status in ('planned', 'in_progress', 'completed', 'skipped')),
  cardio_done boolean not null default false,
  notes text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (enrollment_id, date),
  foreign key (enrollment_id, user_id) references public.enrollments (id, user_id) on delete cascade
);

create table public.set_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  performed_on date not null,
  planned_exercise_id text not null,
  exercise_id text not null,
  set_index smallint not null check (set_index >= 0),
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  reps smallint not null check (reps >= 0),
  rir_actual smallint,
  mini_set_reps smallint[] not null default '{}',
  drop_weight_kg numeric(6, 2) check (drop_weight_kg >= 0),
  drop_reps smallint check (drop_reps >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (session_id, planned_exercise_id, set_index),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade
);

-- "Last time" lookups.
create index set_logs_history on public.set_logs (user_id, exercise_id, performed_on desc);

create table public.body_metrics (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 2) check (weight_kg > 0),
  waist_cm numeric(5, 1) check (waist_cm > 0),
  neck_cm numeric(5, 1) check (neck_cm > 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Pull cursors.
create index programs_pull on public.programs (user_id, server_updated_at);
create index enrollments_pull on public.enrollments (user_id, server_updated_at);
create index exercise_swaps_pull on public.exercise_swaps (user_id, server_updated_at);
create index sessions_pull on public.sessions (user_id, server_updated_at);
create index set_logs_pull on public.set_logs (user_id, server_updated_at);
create index body_metrics_pull on public.body_metrics (user_id, server_updated_at);

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'programs', 'enrollments', 'exercise_swaps', 'sessions', 'set_logs', 'body_metrics']
  loop
    -- Triggers fire in name order: keep_newest runs before touch_server_updated_at.
    execute format(
      'create trigger keep_newest before update on public.%I
       for each row execute function public.keep_newest()',
      t
    );
    execute format(
      'create trigger touch_server_updated_at before insert or update on public.%I
       for each row execute function public.touch_server_updated_at()',
      t
    );
  end loop;
end;
$$;
