-- Step 7. Run this one time in the Supabase SQL Editor.
create table if not exists boards (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, lesson_id)
);
alter table boards enable row level security;
create policy "read own boards" on boards for select using (auth.uid() = user_id);
create policy "add own boards" on boards for insert with check (auth.uid() = user_id);
create policy "update own boards" on boards for update using (auth.uid() = user_id);
