-- Step 9. Teacher board. Run this one time in the Supabase SQL Editor.
create table if not exists lesson_boards (
  course_slug text not null,
  lesson_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (course_slug, lesson_id)
);
alter table lesson_boards enable row level security;
create policy "everyone reads teacher boards" on lesson_boards for select using (true);
create policy "teachers add boards" on lesson_boards for insert with check (is_teacher());
create policy "teachers change boards" on lesson_boards for update using (is_teacher());
create policy "teachers delete boards" on lesson_boards for delete using (is_teacher());
-- Send changes to students live.
alter publication supabase_realtime add table lesson_boards;
