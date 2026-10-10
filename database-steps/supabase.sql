-- Run this one time in Supabase. Open SQL Editor > New query. Paste this file. Click Run.
create table if not exists progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, course_slug, lesson_id)
);
alter table progress enable row level security;
create policy "read own progress" on progress for select using (auth.uid() = user_id);
create policy "add own progress" on progress for insert with check (auth.uid() = user_id);
create policy "update own progress" on progress for update using (auth.uid() = user_id);
