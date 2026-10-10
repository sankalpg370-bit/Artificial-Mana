-- Step 6. Run this one time in the Supabase SQL Editor.
create table if not exists quiz_results (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  score integer not null,
  total integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, lesson_id)
);
alter table quiz_results enable row level security;
create policy "read own results" on quiz_results for select using (auth.uid() = user_id);
create policy "add own results" on quiz_results for insert with check (auth.uid() = user_id);
create policy "update own results" on quiz_results for update using (auth.uid() = user_id);
