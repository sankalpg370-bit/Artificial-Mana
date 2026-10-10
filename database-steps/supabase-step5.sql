-- Step 5. Run this one time in the Supabase SQL Editor.
create table if not exists course_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_slug text not null,
  bookmarked boolean not null default false,
  last_lesson text,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug)
);
alter table course_state enable row level security;
create policy "read own state" on course_state for select using (auth.uid() = user_id);
create policy "add own state" on course_state for insert with check (auth.uid() = user_id);
create policy "update own state" on course_state for update using (auth.uid() = user_id);
