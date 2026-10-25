-- Every row belongs to one user, who alone can read and write it. Child rows
-- also carry composite foreign keys on (parent_id, user_id), so a row can't be
-- attached to another user's parent even if its id is known.

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'programs', 'enrollments', 'exercise_swaps', 'sessions', 'set_logs', 'body_metrics']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "Users manage their own rows" on public.%I
       for all to authenticated
       using (user_id = (select auth.uid()))
       with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;
