-- Step 3. Run this one time in the Supabase SQL Editor.
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  seconds integer not null default 0,
  content text not null,
  created_at timestamptz not null default now()
);
alter table notes enable row level security;
create policy "read own notes" on notes for select using (auth.uid() = user_id);
create policy "add own notes" on notes for insert with check (auth.uid() = user_id);
create policy "delete own notes" on notes for delete using (auth.uid() = user_id);
